"""Demo tests: copy this pattern for your own endpoints."""

import logging
import time

from fastapi import Depends
from fastapi.testclient import TestClient

import app.api.hello
import app.main
from app.config import Settings
from app.db import get_ydb_pool
from app.main import app as fastapi_app


def test_hello_returns_message(monkeypatch):
    monkeypatch.setattr(app.main, "settings", Settings(ydb_endpoint="", ydb_database=""))
    monkeypatch.setattr(app.api.hello, "settings", Settings(yandex_folder_id=""))

    with TestClient(fastapi_app) as client:
        response = client.get("/api/hello")

    assert response.status_code == 200
    assert response.json()["message"]
    assert response.json()["ydb"]["status"] == "not_configured"
    assert response.json()["llm"]["status"] == "not_configured"


def test_hello_shows_model_answer(monkeypatch):
    monkeypatch.setattr(
        app.api.hello, "settings", Settings(yandex_folder_id="test-folder", yandex_model="test-model/latest")
    )
    questions = []

    def fake_ask(prompt, timeout):
        questions.append(prompt)
        return "Третьяковская галерея"

    monkeypatch.setattr(app.api.hello, "ask", fake_ask)

    with TestClient(fastapi_app) as client:
        response = client.get("/api/hello")

    llm = response.json()["llm"]
    assert llm["status"] == "ok"
    assert llm["model"] == "test-model/latest"
    assert llm["answer"] == "Третьяковская галерея"
    assert questions == [llm["question"]]


def test_hello_survives_model_failure(monkeypatch):
    monkeypatch.setattr(app.api.hello, "settings", Settings(yandex_folder_id="test-folder"))

    def failing_ask(prompt, timeout):
        raise TimeoutError("AI Studio is slow")

    monkeypatch.setattr(app.api.hello, "ask", failing_ask)

    with TestClient(fastapi_app) as client:
        response = client.get("/api/hello")

    assert response.status_code == 200
    assert response.json()["llm"]["status"] == "unavailable"


class FakeDriver:
    def wait(self, timeout, fail_fast):
        pass


class FakePool:
    def __init__(self):
        self.queries = []

    def execute_with_retries(self, query, retry_settings=None):
        self.queries.append(query)
        return []

    def stop(self):
        pass


def test_hello_reports_working_ydb():
    with TestClient(fastapi_app) as client:
        # Replace whatever the lifespan created with a database that answers.
        pool = FakePool()
        fastapi_app.state.ydb_driver = FakeDriver()
        fastapi_app.state.ydb_pool = pool
        response = client.get("/api/hello")
        fastapi_app.state.ydb_driver = None
        fastapi_app.state.ydb_pool = None

    assert response.status_code == 200
    assert response.json()["ydb"]["status"] == "ok"
    assert pool.queries == ["SELECT 1;"]


def test_startup_is_not_blocked_by_unreachable_ydb(monkeypatch, caplog):
    # A non-routable address hangs instead of refusing, like a real network problem.
    unreachable = Settings(
        ydb_endpoint="grpc://10.255.255.1:2136", ydb_database="/local", ydb_connect_timeout=3
    )
    monkeypatch.setattr(app.main, "settings", unreachable)
    monkeypatch.setattr(app.api.hello, "settings", unreachable)
    monkeypatch.setenv("YDB_ANONYMOUS_CREDENTIALS", "1")

    with caplog.at_level(logging.INFO, logger="app.db"):
        started = time.monotonic()
        with TestClient(fastapi_app) as client:
            elapsed = time.monotonic() - started
            # hello waits for YDB at most ydb_connect_timeout, then still answers.
            response = client.get("/api/hello")
            deadline = time.monotonic() + 10
            while "YDB connection failed" not in caplog.text and time.monotonic() < deadline:
                time.sleep(0.1)

    assert response.status_code == 200
    assert response.json()["ydb"]["status"] == "unavailable"
    assert elapsed < unreachable.ydb_connect_timeout
    assert "YDB connection failed" in caplog.text


def test_ydb_dependency_returns_503_when_not_configured(monkeypatch):
    monkeypatch.setattr(app.main, "settings", Settings(ydb_endpoint="", ydb_database=""))

    @fastapi_app.get("/api/_test_ydb")
    def uses_ydb(pool=Depends(get_ydb_pool)):
        return {"ok": True}

    try:
        with TestClient(fastapi_app) as client:
            response = client.get("/api/_test_ydb")
    finally:
        fastapi_app.router.routes.pop()

    assert response.status_code == 503
    assert response.json()["detail"] == "YDB is not configured"
