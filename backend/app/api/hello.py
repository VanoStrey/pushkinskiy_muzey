import logging
from typing import Literal

import ydb
from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.ai import ask
from app.config import settings

logger = logging.getLogger("app.api.hello")

router = APIRouter(tags=["hello"])


class YdbStatus(BaseModel):
    status: Literal["ok", "unavailable", "not_configured"]
    detail: str


class LlmStatus(BaseModel):
    status: Literal["ok", "unavailable", "not_configured"]
    model: str
    question: str
    answer: str
    detail: str


class HelloResponse(BaseModel):
    message: str
    ydb: YdbStatus
    llm: LlmStatus


LLM_QUESTION = "В каком московском музее самая большая коллекция произведений искусства?"


def check_ydb(request: Request) -> YdbStatus:
    """Run `SELECT 1` against YDB. Never raises: hello must answer even without a database."""
    driver = getattr(request.app.state, "ydb_driver", None)
    pool = getattr(request.app.state, "ydb_pool", None)
    if driver is None or pool is None:
        return YdbStatus(status="not_configured", detail="YDB_ENDPOINT and YDB_DATABASE are not set")
    try:
        driver.wait(timeout=settings.ydb_connect_timeout, fail_fast=True)
        pool.execute_with_retries("SELECT 1;", retry_settings=ydb.RetrySettings(max_retries=1))
    except Exception as exc:  # noqa: BLE001 - any failure means "unavailable"
        logger.warning("YDB check failed: %s", exc)
        return YdbStatus(status="unavailable", detail=f"YDB query failed ({type(exc).__name__})")
    return YdbStatus(status="ok", detail=f"SELECT 1 succeeded in {settings.ydb_database}")


def check_llm() -> LlmStatus:
    """Ask the model a demo question. Never raises: hello must answer even without AI Studio."""
    common = {"model": settings.yandex_model, "question": LLM_QUESTION}
    if not settings.yandex_folder_id:
        return LlmStatus(status="not_configured", answer="", detail="YANDEX_FOLDER_ID is not set", **common)
    try:
        answer = ask(LLM_QUESTION, timeout=20)
    except Exception as exc:  # noqa: BLE001 - any failure means "unavailable"
        logger.warning("AI Studio check failed: %s", exc)
        return LlmStatus(
            status="unavailable", answer="", detail=f"AI Studio call failed ({type(exc).__name__})", **common
        )
    return LlmStatus(status="ok", answer=answer, detail="", **common)


@router.get("/hello", response_model=HelloResponse)
def hello(request: Request) -> HelloResponse:
    return HelloResponse(message="Hello from the FastAPI backend!", ydb=check_ydb(request), llm=check_llm())
