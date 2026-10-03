from fastapi.testclient import TestClient

import app.api.ai
from app.config import Settings
from app.main import app as fastapi_app


def test_ask_returns_model_answer(monkeypatch):
    monkeypatch.setattr(app.api.ai, "settings", Settings(yandex_folder_id="test-folder", yandex_model="test-model/latest"))
    monkeypatch.setattr(app.api.ai, "ask", lambda prompt: f"answer to: {prompt}")

    with TestClient(fastapi_app) as client:
        response = client.post("/api/ai/ask", json={"prompt": "Привет"})

    assert response.status_code == 200
    assert response.json() == {"model": "test-model/latest", "answer": "answer to: Привет"}


def test_ask_returns_503_when_not_configured(monkeypatch):
    monkeypatch.setattr(app.api.ai, "settings", Settings(yandex_folder_id=""))

    with TestClient(fastapi_app) as client:
        response = client.post("/api/ai/ask", json={"prompt": "Привет"})

    assert response.status_code == 503


def test_ask_returns_502_when_model_fails(monkeypatch):
    monkeypatch.setattr(app.api.ai, "settings", Settings(yandex_folder_id="test-folder"))

    def failing_ask(prompt):
        raise RuntimeError("boom")

    monkeypatch.setattr(app.api.ai, "ask", failing_ask)

    with TestClient(fastapi_app) as client:
        response = client.post("/api/ai/ask", json={"prompt": "Привет"})

    assert response.status_code == 502
