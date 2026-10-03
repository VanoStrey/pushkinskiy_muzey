"""Compatibility tests for the full tour endpoint using the official JSON catalog."""

import json

from fastapi.testclient import TestClient

import app.services.route_generator as route_generator
from app.config import Settings
from app.data.exhibits import get_exhibit_by_id
from app.main import app as fastapi_app


def _requested_candidates(prompt: str) -> list[dict]:
    """Emulate a compliant model: honour the pinned stop count from the prompt."""
    payload = json.loads(prompt)
    wanted = payload.get("required_stop_count") or 4
    return payload["candidates"][:wanted]


def _fake_model_response(prompt: str, **kwargs) -> str:
    del kwargs
    candidates = _requested_candidates(prompt)
    stops = [
        {
            "id": item["id"],
            "reason": "Подходит интересам посетителя.",
            "activity": "Какой материал использован в этом экспонате?",
            "challenge_type": "question",
            "options": ["Правильный вариант", "Неверный вариант А", "Неверный вариант Б"],
            "correct_option": 0,
            "explanation": "Это указано в данных каталога музея.",
        }
        for item in candidates
    ]
    return json.dumps({"stops": stops}, ensure_ascii=False)


def _fake_observation_model_response(prompt: str, **kwargs) -> str:
    del kwargs
    stops = [
        {"id": item["id"], "reason": "Подходит интересам посетителя.", "activity": "Найдите деталь, которая привлекла ваше внимание."}
        for item in _requested_candidates(prompt)
    ]
    return json.dumps({"stops": stops}, ensure_ascii=False)


def _request_body() -> dict[str, object]:
    return {
        "interests": ["Древний Египет"],
        "duration_minutes": 45,
        "group_type": "friends",
        "difficulty": "beginner",
        "style": "quest",
    }


def test_tour_endpoint_fallback_uses_real_museum_ids_and_observation_tasks(monkeypatch):
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=_request_body())

    assert response.status_code == 200
    payload = response.json()
    assert 4 <= len(payload["stops"]) <= 6
    for stop in payload["stops"]:
        exhibit = get_exhibit_by_id(stop["exhibit_id"])
        assert exhibit is not None
        assert stop["title"] == exhibit["title"]
        assert stop["artist"] == (", ".join(exhibit["authors"]) if exhibit["authors"] else None)
        assert stop["source_url"] == exhibit["source_url"]
        assert stop["challenge"]["type"] == "observation"
        assert stop["challenge"]["options"] == []
        assert stop["challenge"]["correct_option"] is None
    assert payload["is_fallback"] is True


def test_tour_endpoint_adapter_uses_shared_validated_ai_generator(monkeypatch):
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder"))
    prompts: list[str] = []

    def fake_ask(prompt: str, instructions: str, timeout: float, **kwargs) -> str:
        assert instructions
        assert timeout == 50
        # A quest route needs a raised output budget, otherwise the JSON with
        # quiz options comes back truncated.
        assert kwargs["max_output_tokens"] >= 3000
        prompts.append(prompt)
        return _fake_model_response(prompt)

    monkeypatch.setattr(route_generator, "ask", fake_ask)
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=_request_body())

    assert response.status_code == 200
    payload = response.json()
    assert 4 <= len(payload["stops"]) <= 6
    candidate_ids = {item["id"] for item in json.loads(prompts[0])["candidates"]}
    assert {stop["exhibit_id"] for stop in payload["stops"]} <= candidate_ids
    # style="quest" (the default request body) must produce a real multiple-choice
    # quiz from the AI, not just an unscored observation task.
    for stop in payload["stops"]:
        assert stop["challenge"]["type"] == "question"
        assert 2 <= len(stop["challenge"]["options"]) <= 4
        assert 0 <= stop["challenge"]["correct_option"] < len(stop["challenge"]["options"])
        assert stop["challenge"]["explanation"]
    assert payload["is_fallback"] is False


def test_tour_endpoint_story_style_uses_observation_not_quiz(monkeypatch):
    """Non-quest styles never promise a scored quiz, even when AI Studio is configured."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder"))
    monkeypatch.setattr(route_generator, "ask", lambda prompt, **kwargs: _fake_observation_model_response(prompt))
    req = _request_body()
    req["style"] = "story"
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=req)

    assert response.status_code == 200
    payload = response.json()
    assert payload["is_fallback"] is False
    for stop in payload["stops"]:
        assert stop["challenge"]["type"] == "observation"
        assert stop["challenge"]["options"] == []
        assert stop["challenge"]["correct_option"] is None


def test_tour_endpoint_quest_degrades_to_observation_when_ai_omits_quiz_fields(monkeypatch):
    """A quest request whose AI response forgets quiz fields must still succeed."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder"))
    monkeypatch.setattr(route_generator, "ask", lambda prompt, **kwargs: _fake_observation_model_response(prompt))
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=_request_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["is_fallback"] is False
    for stop in payload["stops"]:
        assert stop["challenge"]["type"] == "observation"


def test_tour_endpoint_serves_catalog_route_when_ai_breaks_its_contract(monkeypatch):
    """A visitor must never see an error because the model invented an id.

    The hallucinated stop is still rejected (see
    tests/test_routes.py::test_route_generator_requires_only_catalog_ids) — but
    the service degrades to the deterministic catalog route instead of a 502.
    """
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder"))
    calls: list[int] = []

    def bad_ask(*args, **kwargs):
        del args, kwargs
        calls.append(1)
        return json.dumps({"stops": [{"id": "van-gogh-red-vineyards", "reason": "x", "activity": "y"}]})

    monkeypatch.setattr(route_generator, "ask", bad_ask)
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=_request_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["is_fallback"] is True
    assert len(calls) == 2, "the broken generation should be retried once"
    for stop in payload["stops"]:
        assert get_exhibit_by_id(stop["exhibit_id"]) is not None


def test_duration_drives_the_number_of_stops(monkeypatch):
    """The form promises 5 masterpieces for an hour and 6 for a long visit, so the
    model must be pinned to that count instead of always returning the minimum."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder"))

    def fake_ask(prompt: str, **kwargs) -> str:
        del kwargs
        payload = json.loads(prompt)
        wanted = payload["required_stop_count"]
        assert wanted is not None, "the personal tour must pin the stop count"
        candidates = payload["candidates"][:wanted]
        return json.dumps(
            {
                "stops": [
                    {
                        "id": item["id"],
                        "reason": "Причина.",
                        "activity": "Из какого материала сделан экспонат?",
                        "challenge_type": "question",
                        "options": ["верный", "неверный", "тоже неверный"],
                        "correct_option": 0,
                        "explanation": "По данным каталога.",
                    }
                    for item in candidates
                ]
            },
            ensure_ascii=False,
        )

    monkeypatch.setattr(route_generator, "ask", fake_ask)
    with TestClient(fastapi_app) as client:
        counts = {}
        for minutes in (60, 180):
            body = _request_body()
            body["duration_minutes"] = minutes
            response = client.post("/api/route/generate", json=body)
            assert response.status_code == 200
            counts[minutes] = len(response.json()["stops"])

    assert counts[60] == 5
    assert counts[180] == 6


def test_exhibits_without_a_building_are_reachable_and_not_mislabelled(monkeypatch):
    """27 catalog objects (Japanese prints, Malevich, Vrubel, the numismatics)
    carry no building in the dataset; they must be routable, and their location
    must not be passed off as the Main Building."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))
    body = _request_body()
    body["interests"] = ["шедевры"]
    body["visitor_comment"] = "интересует японская графика и гравюры"
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=body)

    assert response.status_code == 200
    stops = response.json()["stops"]
    assert any("Графика" in (stop["description"] or "") for stop in stops)
    for stop in stops:
        if stop["building_id"] is None:
            assert stop["building_name"] is None
            assert "уточните на сайте" in stop["location"]


def test_tour_endpoint_spatial_metadata_and_break_info(monkeypatch):
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=_request_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload["has_break"] is True
    assert payload["break_after_stop"] == len(payload["stops"]) // 2
    assert payload["break_info"] is not None
    assert payload["break_info"]["hall_number"] == "15"
    assert "Главного здания" in payload["break_info"]["note"]

    for stop in payload["stops"]:
        assert stop["building_id"] == "116"
        assert stop["hall_id"] is not None
        assert stop["hall_number"] is not None
        assert stop["floor_number"] in ("1", "2")


def test_tour_endpoint_with_visitor_comment(monkeypatch):
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))
    req = _request_body()
    req["visitor_comment"] = "Хочу увидеть саркофаги и золото Египта"
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=req)

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["stops"]) >= 4
    # Fallback reason reflects visitor comment
    assert any("саркофаги" in stop["personalization_reason"] or "комментарию" in stop["personalization_reason"] for stop in payload["stops"])


def test_candidate_pool_differs_between_interests(monkeypatch):
    """Different interests must reach the model as different candidate pools.

    The UI interest tags do not appear verbatim in the catalog, so without the
    synonym expansion every request scored 0 and sent the same first records.
    """
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder"))
    prompts: list[str] = []

    def fake_ask(prompt: str, **kwargs) -> str:
        del kwargs
        prompts.append(prompt)
        return _fake_model_response(prompt)

    monkeypatch.setattr(route_generator, "ask", fake_ask)

    with TestClient(fastapi_app) as client:
        for interests in (["импрессионизм"], ["древний мир"]):
            body = _request_body()
            body["interests"] = interests
            assert client.post("/api/route/generate", json=body).status_code == 200

    pools = [{item["id"] for item in json.loads(prompt)["candidates"]} for prompt in prompts]
    assert pools[0] != pools[1]


def test_impressionism_interest_reaches_impressionist_works(monkeypatch):
    """The Gallery building (117) has no hall numbers in the open dataset, so the
    strict `route_eligible` rule used to exclude Monet, Degas and Renoir entirely
    and an "импрессионизм" request could never be satisfied."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))
    body = _request_body()
    body["interests"] = ["импрессионизм"]
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=body)

    assert response.status_code == 200
    artists = " ".join(stop["artist"] or "" for stop in response.json()["stops"])
    assert any(name in artists for name in ("Моне", "Дега", "Ренуар", "Писсарро"))


def test_description_is_built_from_catalog_fields_and_differs_per_stop(monkeypatch):
    """The open dataset has no annotation text, so descriptions are composed from
    verified catalog fields instead of one shared boilerplate line."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=_request_body())

    assert response.status_code == 200
    stops = response.json()["stops"]
    descriptions = [stop["description"] for stop in stops]
    assert len(set(descriptions)) == len(descriptions)
    for stop in stops:
        exhibit = get_exhibit_by_id(stop["exhibit_id"])
        assert exhibit is not None
        # Every fact in the description comes from the catalog record itself.
        if exhibit.get("inventory_number"):
            assert exhibit["inventory_number"] in stop["description"]
