import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.ai import ask
from app.config import settings

logger = logging.getLogger("app.api.ai")

router = APIRouter(tags=["ai"])


class AskRequest(BaseModel):
    prompt: str


class AskResponse(BaseModel):
    model: str
    answer: str


@router.post("/ai/ask", response_model=AskResponse)
def ask_model(payload: AskRequest) -> AskResponse:
    if not settings.yandex_folder_id:
        raise HTTPException(status_code=503, detail="AI Studio is not configured: set YANDEX_FOLDER_ID")
    try:
        answer = ask(payload.prompt)
    except Exception as exc:  # noqa: BLE001 - any AI Studio failure is a bad gateway
        logger.warning("AI Studio call failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI Studio call failed ({type(exc).__name__})")
    return AskResponse(model=settings.yandex_model, answer=answer)
