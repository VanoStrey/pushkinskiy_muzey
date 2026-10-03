"""Route endpoints for generating personalized museum visits."""

import logging
from fastapi import APIRouter
from app.schemas.route import RouteGenerateRequest, RouteGenerateResponse
from app.services.route_generator import generate_personalized_route

logger = logging.getLogger("app.api.route")

router = APIRouter(tags=["route"])


@router.post("/route/generate", response_model=RouteGenerateResponse)
def generate_route(payload: RouteGenerateRequest) -> RouteGenerateResponse:
    """Generate a personalized museum route of 4-6 exhibits using AI and verified Pushkin Museum data."""
    return generate_personalized_route(payload)
