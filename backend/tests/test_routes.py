import json

from fastapi.testclient import TestClient

import app.services.route_generator
from app.api.exhibits import enrich_exhibit
from app.config import Settings
from app.data.exhibits import get_route_candidates
from app.main import app as fastapi_app
from app.services.route_generator import RouteGenerationError, generate_route


def _fake_model_response(prompt: str, *args, **kwargs) -> str:
    del args, kwargs
    candidates = json.loads(prompt)["candidates"]
    stops = [
        {"id": item["id"], "reason": "Подходит интересам посетителя.", "activity": "Найдите деталь, которая привлекла внимание."}
        for item in candidates[:4]
    ]
    return json.dumps({"stops": stops}, ensure_ascii=False)


def test_exhibit_api_returns_catalog_location_by_visitor_number():
    with TestClient(fastapi_app) as client:
        response = client.get("/api/exhibits?building_id=116")

    assert response.status_code == 200
    payload = response.json()
    assert payload["count"] == 27
    exhibit = next(item for item in payload["items"] if item["id"] == "3687")
    assert exhibit["hall_id"] == "191"
    assert exhibit["hall"]["number"] == "6"
    assert exhibit["hall"]["floor_number"] == "1"
    assert exhibit["hall"]["building_id"] == "116"


def test_route_api_uses_ai_ids_but_canonical_catalog_details(monkeypatch):
    monkeypatch.setattr(app.services.route_generator, "settings", Settings(yandex_folder_id="test-folder"))
    prompts = []

    def fake_ask(prompt, instructions, timeout, **kwargs):
        del kwargs
        prompts.append(prompt)
        return _fake_model_response(prompt)

    monkeypatch.setattr(app.services.route_generator, "ask", fake_ask)
    with TestClient(fastapi_app) as client:
        response = client.post(
            "/api/routes/generate",
            json={
                "audience": "подростки",
                "interests": ["Древний Египет"],
                "duration_minutes": 45,
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["stops"]) == 4
    assert payload["building_id"] == "116"
    assert "кратчайший путь" in payload["availability_note"]
    assert "Портрет юноши в золотом венке" in json.dumps(json.loads(prompts[0]), ensure_ascii=False)
    first = next(stop["exhibit"] for stop in payload["stops"] if stop["exhibit"]["id"] == "3687")
    assert first["title"] == "Портрет юноши в золотом венке"
    assert first["hall"]["number"] == "6"
    assert first["source_url"] == "https://pushkinmuseum.art/data/fonds/ancient_east/1_1_a/1_1_a_5776/index.php"


def test_route_api_uses_neutral_observations_when_ai_studio_is_not_configured(monkeypatch):
    monkeypatch.setattr(app.services.route_generator, "settings", Settings(yandex_folder_id=""))
    with TestClient(fastapi_app) as client:
        response = client.post(
            "/api/routes/generate",
            json={"audience": "подростки", "duration_minutes": 45},
        )
    assert response.status_code == 200
    assert response.json()["stops"]
    assert response.json()["stops"][0]["activity"]


def test_route_api_rejects_ids_outside_candidate_catalog(monkeypatch):
    monkeypatch.setattr(app.services.route_generator, "settings", Settings(yandex_folder_id="test-folder"))
    monkeypatch.setattr(
        app.services.route_generator,
        "ask",
        lambda *args, **kwargs: json.dumps(
            {"stops": [{"id": "not-in-catalog", "reason": "x", "activity": "y"}]}
        ),
    )
    with TestClient(fastapi_app) as client:
        response = client.post(
            "/api/routes/generate",
            json={"audience": "подростки", "duration_minutes": 45},
        )
    assert response.status_code == 502


def test_route_api_returns_explanation_when_no_candidates_exist(monkeypatch):
    monkeypatch.setattr(app.services.route_generator, "settings", Settings(yandex_folder_id=""))
    with TestClient(fastapi_app) as client:
        response = client.post(
            "/api/routes/generate",
            json={"audience": "подростки", "duration_minutes": 45, "building_id": "118"},
        )
    assert response.status_code == 200
    assert response.json()["stops"] == []
    assert "не найдено" in response.json()["explanation"]


def test_route_generator_requires_only_catalog_ids(monkeypatch):
    candidates = [enrich_exhibit(item) for item in get_route_candidates("116")[:4]]
    monkeypatch.setattr(
        app.services.route_generator,
        "ask",
        lambda *args, **kwargs: json.dumps(
            {"stops": [{"id": "not-in-catalog", "reason": "x", "activity": "y"}]}
        ),
    )
    try:
        generate_route(candidates=candidates, audience="test", interests=[], duration_minutes=30)
    except RouteGenerationError as exc:
        assert "outside the candidate catalog" in str(exc)
    else:
        raise AssertionError("unknown AI-selected id must be rejected")


def test_short_route_uses_all_available_candidates(monkeypatch):
    candidates = [enrich_exhibit(item) for item in get_route_candidates("116")[:3]]
    monkeypatch.setattr(app.services.route_generator, "ask", _fake_model_response)
    stops = generate_route(candidates=candidates, audience="test", interests=[], duration_minutes=30)
    assert [stop["id"] for stop in stops] == [item["id"] for item in candidates]
