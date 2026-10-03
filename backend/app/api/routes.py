from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.api.exhibits import ExhibitResponse, USAGE_NOTE, enrich_exhibit
from app.config import settings
from app.data.exhibits import get_all_buildings, get_route_candidates
from app.services.route_generator import RouteGenerationError, generate_route


logger = logging.getLogger("app.api.routes")
router = APIRouter(tags=["museum routes"])


class GenerateRouteRequest(BaseModel):
    audience: str = Field(min_length=2, max_length=120)
    interests: list[str] = Field(default_factory=list, max_length=8)
    duration_minutes: int = Field(ge=10, le=240)
    building_id: str = Field(default="116", min_length=1, max_length=40)

    @field_validator("audience")
    @classmethod
    def strip_audience(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 2:
            raise ValueError("audience must contain at least two non-space characters")
        return value

    @field_validator("interests")
    @classmethod
    def clean_interests(cls, values: list[str]) -> list[str]:
        cleaned = [value.strip() for value in values if value.strip()]
        if len(cleaned) > 8 or any(len(value) > 80 for value in cleaned):
            raise ValueError("provide at most eight interests, each no longer than 80 characters")
        return cleaned


class RouteStopResponse(BaseModel):
    exhibit: ExhibitResponse
    reason: str
    activity: str


class GenerateRouteResponse(BaseModel):
    building_id: str
    building_name: str | None
    audience: str
    duration_minutes: int
    stops: list[RouteStopResponse]
    explanation: str
    availability_note: str
    usage_note: str


AVAILABILITY_NOTE = (
    "Отбор использует show_in_hall и признаки закрытия зданий из загруженного набора. "
    "Они не подтверждают доступность экспоната или здания сегодня. Порядок остановок тематический; "
    "расстояния и кратчайший путь не рассчитываются."
)


@router.post("/routes/generate", response_model=GenerateRouteResponse)
def create_route(payload: GenerateRouteRequest) -> GenerateRouteResponse:
    candidates = get_route_candidates(payload.building_id)
    building = next((item for item in get_all_buildings() if item.get("id") == payload.building_id), None)
    if not candidates:
        return GenerateRouteResponse(
            building_id=payload.building_id,
            building_name=building.get("name") if building else None,
            audience=payload.audience,
            duration_minutes=payload.duration_minutes,
            stops=[],
            explanation="В официальном каталоге не найдено подходящих объектов для выбранного здания.",
            availability_note=AVAILABILITY_NOTE,
            usage_note=USAGE_NOTE,
        )
    if not settings.yandex_folder_id:
        raise HTTPException(status_code=503, detail="AI Studio is not configured: set YANDEX_FOLDER_ID")

    enriched = [enrich_exhibit(candidate) for candidate in candidates]
    try:
        generated = generate_route(
            candidates=enriched,
            audience=payload.audience.strip(),
            interests=[interest.strip()[:80] for interest in payload.interests if interest.strip()],
            duration_minutes=payload.duration_minutes,
        )
    except RouteGenerationError as exc:
        logger.warning("AI Studio returned an invalid route: %s", exc)
        raise HTTPException(status_code=502, detail="AI Studio returned an invalid route; please try again") from exc
    except Exception as exc:  # noqa: BLE001 - an AI Studio outage is a bad gateway
        logger.warning("AI Studio route generation failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"AI Studio call failed ({type(exc).__name__})") from exc

    by_id = {candidate["id"]: candidate for candidate in enriched}
    stops = [
        RouteStopResponse(
            exhibit=ExhibitResponse.model_validate(by_id[stop["id"]]),
            reason=stop["reason"],
            activity=stop["activity"],
        )
        for stop in generated
    ]
    if len(candidates) < 4:
        explanation = (
            f"В каталоге найдено только {len(candidates)} подходящих объектов, поэтому маршрут короче обычных 4–6 остановок."
        )
    else:
        explanation = "Экспонаты выбраны AI из подходящих записей официального каталога."
    return GenerateRouteResponse(
        building_id=payload.building_id,
        building_name=building.get("name") if building else None,
        audience=payload.audience.strip(),
        duration_minutes=payload.duration_minutes,
        stops=stops,
        explanation=explanation,
        availability_note=AVAILABILITY_NOTE,
        usage_note=USAGE_NOTE,
    )
