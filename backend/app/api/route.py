"""Route endpoints for generating personalized museum visits."""

import logging
from fastapi import APIRouter, HTTPException
from app.schemas.route import RouteGenerateRequest, RouteGenerateResponse
from app.services.route_generator import RouteGenerationError, generate_personalized_route

logger = logging.getLogger("app.api.route")

router = APIRouter(tags=["route"])


@router.post("/route/generate", response_model=RouteGenerateResponse)
def generate_route(payload: RouteGenerateRequest) -> RouteGenerateResponse:
    """Adapt the original tour API to the shared official-catalog route generator."""
    try:
        return generate_personalized_route(payload)
    except RouteGenerationError as exc:
        logger.warning("AI Studio returned an invalid route: %s", exc)
        raise HTTPException(status_code=502, detail="AI Studio returned an invalid route; please try again") from exc
    except Exception as exc:  # noqa: BLE001 - the provider failure is surfaced as a gateway error
        logger.warning("Route generation failed: %s", exc)
        raise HTTPException(status_code=502, detail="Route generation failed; please try again") from exc
