"""Compatibility tests for the full tour endpoint using the official JSON catalog."""

import json

from fastapi.testclient import TestClient

import app.services.route_generator as route_generator
from app.config import Settings
from app.data.exhibits import get_exhibit_by_id
from app.main import app as fastapi_app


def _fake_model_response(prompt: str, **kwargs) -> str:
    del kwargs
    candidates = json.loads(prompt)["candidates"]
    stops = [
        {"id": item["id"], "reason": "Подходит интересам посетителя.", "activity": "Найдите деталь, которая привлекла ваше внимание."}
        for item in candidates[:4]
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

    def fake_ask(prompt: str, instructions: str, timeout: float) -> str:
        assert instructions
        assert timeout == 50
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
    assert all(stop["challenge"]["type"] == "observation" for stop in payload["stops"])
    assert payload["is_fallback"] is False


def test_legacy_route_endpoint_rejects_ai_ids_outside_catalog(monkeypatch):
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder"))
    monkeypatch.setattr(
        route_generator,
        "ask",
        lambda *args, **kwargs: json.dumps(
            {"stops": [{"id": "van-gogh-red-vineyards", "reason": "x", "activity": "y"}]}
        ),
    )
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=_request_body())
    assert response.status_code == 502


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


def test_tour_endpoint_with_break_disabled(monkeypatch):
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))
    req = _request_body()
    req["include_break"] = False
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=req)

    assert response.status_code == 200
    payload = response.json()
    assert payload["has_break"] is False
    assert payload["break_after_stop"] is None
    assert payload["break_info"] is None


def test_tour_endpoint_preserves_topological_floor_order(monkeypatch):
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))
    req = {
        "interests": ["шедевры", "живопись", "скульптура"],
        "duration_minutes": 120,
        "group_type": "solo",
        "difficulty": "amateur",
        "style": "story",
        "include_break": True,
    }
    with TestClient(fastapi_app) as client:
        response = client.post("/api/route/generate", json=req)

    assert response.status_code == 200
    payload = response.json()
    stops = payload["stops"]
    assert len(stops) >= 4

    # Floors must be non-decreasing (e.g. all 1s then 2s, never 1 -> 2 -> 1)
    floors = [int(s["floor_number"] or 1) for s in stops]
    assert floors == sorted(floors), f"Floors should not alternate back and forth: {floors}"

    # If route transitions floors, break should be placed before the transition
    transition_indices = [i + 1 for i in range(len(floors) - 1) if floors[i] != floors[i + 1]]
    if transition_indices and payload["has_break"]:
        assert payload["break_after_stop"] == transition_indices[0]

