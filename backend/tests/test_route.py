"""Tests for POST /api/route/generate endpoint and route generator service."""

import json
from unittest.mock import patch
from fastapi.testclient import TestClient

from app.config import Settings
from app.data.exhibits import VERIFIED_EXHIBITS
from app.main import app as fastapi_app
from app.services import route_generator

client = TestClient(fastapi_app)


def test_generate_route_fallback_when_no_folder_id(monkeypatch):
    """When YANDEX_FOLDER_ID is empty, it returns a verified fallback route without errors."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id=""))

    payload = {
        "interests": ["импрессионизм", "шедевры"],
        "duration_minutes": 60,
        "group_type": "friends",
        "difficulty": "beginner",
        "style": "quest",
    }
    response = client.post("/api/route/generate", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["is_fallback"] is True
    assert 4 <= len(data["stops"]) <= 6
    assert data["duration_minutes"] == 60
    assert "Пушкин" in data["title"] or "маршрут" in data["title"].lower()

    # All exhibits must be from verified collection
    valid_ids = {e["id"] for e in VERIFIED_EXHIBITS}
    for stop in data["stops"]:
        assert stop["exhibit_id"] in valid_ids
        assert stop["title"]
        assert stop["artist"]
        assert stop["description"]
        assert stop["challenge"]["question"]
        assert len(stop["challenge"]["options"]) >= 2
        assert 0 <= stop["challenge"]["correct_option"] < len(stop["challenge"]["options"])


def test_generate_route_with_successful_ai(monkeypatch):
    """When Yandex AI Studio responds with valid JSON, it formats the personalized route."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder-id"))

    mock_llm_json = json.dumps({
        "title": "Свет и цвет: от импрессионистов до Пикассо",
        "intro": "Маршрут-исследование для компании друзей, где каждый экспонат открывает тайну красок.",
        "stops": [
            {
                "exhibit_id": "van-gogh-red-vineyards",
                "personalization_reason": "Идеально подходит для любителей цвета и экспрессии.",
                "look_closer": "Посмотрите на рельефное солнце на горизонте.",
                "challenge": {
                    "question": "Какая деталь на картине показывает время суток?",
                    "options": ["Ослепительное солнце", "Светящиеся фонари", "Лунный серп"],
                    "correct_option": 0,
                    "explanation": "Солнце на горизонте заливает виноградники желтым цветом.",
                },
            },
            {
                "exhibit_id": "monet-white-waterlilies",
                "personalization_reason": "Позволяет погрузиться в медитативный мир Живерни.",
                "look_closer": "Найдите кувшинки без явной линии горизонта.",
                "challenge": {
                    "question": "Под влиянием какого искусства Моне создал этот сад?",
                    "options": ["Японская гравюра", "Античный Рим", "Русское зодчество"],
                    "correct_option": 0,
                    "explanation": "Моне вдохновлялся японской гравюрой укиё-э.",
                },
            },
            {
                "exhibit_id": "degas-blue-dancers",
                "personalization_reason": "Динамика и ритм танца для молодой компании.",
                "look_closer": "Взгляните на угол зрения сверху вниз.",
                "challenge": {
                    "question": "Сколько девушек изображено по версии некоторых исследователей?",
                    "options": ["Одна балерина в разных фазах", "Четыре сестры", "Две балерины"],
                    "correct_option": 0,
                    "explanation": "Многие исследователи считают, что это фазы движения одной балерины.",
                },
            },
            {
                "exhibit_id": "picasso-girl-on-ball",
                "personalization_reason": "Шедевр розового периода о балансе и дружбе.",
                "look_closer": "Заметьте белую лошадь на заднем плане.",
                "challenge": {
                    "question": "Какая форма противопоставлена устойчивому кубу атлета?",
                    "options": ["Шар", "Конус", "Цилиндр"],
                    "correct_option": 0,
                    "explanation": "Шар подчеркивает хрупкость и баланс.",
                },
            },
            {
                "exhibit_id": "gauguin-aha-oe-feii",
                "personalization_reason": "Завершение маршрута яркими красками Таити.",
                "look_closer": "Прочтите надпись на таитянском внизу полотна.",
                "challenge": {
                    "question": "Что означает надпись на картине?",
                    "options": ["А, ты ревнуешь?", "Добрый вечер", "Священное солнце"],
                    "correct_option": 0,
                    "explanation": "В переводе с таитянского: А, ты ревнуешь?",
                },
            },
        ],
    })

    with patch("app.services.route_generator.ask", return_value=mock_llm_json):
        response = client.post(
            "/api/route/generate",
            json={
                "interests": ["импрессионизм", "цвет"],
                "duration_minutes": 60,
                "group_type": "friends",
                "difficulty": "beginner",
                "style": "quest",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_fallback"] is False
    assert data["title"] == "Свет и цвет: от импрессионистов до Пикассо"
    assert len(data["stops"]) == 5
    assert data["stops"][0]["exhibit_id"] == "van-gogh-red-vineyards"
    assert data["stops"][0]["artist"] == "Винсент Ван Гог"
    assert data["stops"][0]["title"] == "Красные виноградники в Арле. Монмажур"


def test_generate_route_ai_error_graceful_fallback(monkeypatch):
    """When Yandex AI Studio raises an exception or times out, the service falls back gracefully."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder-id"))

    with patch("app.services.route_generator.ask", side_effect=RuntimeError("AI Studio connection timeout")):
        response = client.post(
            "/api/route/generate",
            json={
                "interests": ["древний мир", "египет"],
                "duration_minutes": 30,
                "group_type": "solo",
                "difficulty": "amateur",
                "style": "story",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_fallback"] is True
    assert len(data["stops"]) == 4  # 30 min gives 4 stops
    assert any("египет" in s["description"].lower() or "фаюм" in s["description"].lower() for s in data["stops"])


def test_generate_route_ai_returns_malformed_json_fallback(monkeypatch):
    """When AI returns broken non-JSON text, service doesn't crash and falls back gracefully."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder-id"))

    with patch("app.services.route_generator.ask", return_value="Извините, я не могу составить JSON"):
        response = client.post(
            "/api/route/generate",
            json={
                "interests": ["скульптура"],
                "duration_minutes": 45,
                "group_type": "family",
                "difficulty": "beginner",
                "style": "quest",
            },
        )

    assert response.status_code == 200
    data = response.json()
    assert data["is_fallback"] is True
    assert 4 <= len(data["stops"]) <= 6


def test_generate_route_filters_hallucinated_ids(monkeypatch):
    """If AI invents non-existent exhibit IDs, they are filtered out and completed from verified collection."""
    monkeypatch.setattr(route_generator, "settings", Settings(yandex_folder_id="test-folder-id"))

    hallucinated_response = json.dumps({
        "title": "Вымышленный маршрут",
        "intro": "Введение",
        "stops": [
            {
                "exhibit_id": "mona-lisa-louvre",  # Non-existent in Pushkin verified catalog
                "personalization_reason": "Шедевр",
                "look_closer": "Улыбка",
                "challenge": {"question": "Q?", "options": ["A", "B"], "correct_option": 0, "explanation": "E"},
            },
            {
                "exhibit_id": "van-gogh-red-vineyards",  # Valid
                "personalization_reason": "Винсент",
                "look_closer": "Солнце",
                "challenge": {"question": "Q2?", "options": ["A", "B"], "correct_option": 0, "explanation": "E2"},
            },
        ],
    })

    with patch("app.services.route_generator.ask", return_value=hallucinated_response):
        response = client.post(
            "/api/route/generate",
            json={"interests": ["шедевры"], "duration_minutes": 60},
        )

    assert response.status_code == 200
    data = response.json()
    valid_ids = {e["id"] for e in VERIFIED_EXHIBITS}
    for stop in data["stops"]:
        assert stop["exhibit_id"] in valid_ids
        assert stop["exhibit_id"] != "mona-lisa-louvre"
    assert len(data["stops"]) >= 4


def test_generate_route_validation_error():
    """Invalid payload parameters (e.g. negative duration) return HTTP 422."""
    response = client.post(
        "/api/route/generate",
        json={"duration_minutes": -5},
    )
    assert response.status_code == 422
