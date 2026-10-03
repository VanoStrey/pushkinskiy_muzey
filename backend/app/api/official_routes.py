"""API endpoints for official Pushkin Museum routes and uniqueness verification."""

import logging
import ydb
from fastapi import APIRouter, Request
from app.repositories import official_routes_repo
from app.schemas.official_route import (
    OfficialRoute,
    UniquenessCheckRequest,
    UniquenessCheckResponse,
)
from app.services.official_routes_importer import import_official_routes
from app.services.uniqueness_checker import check_route_uniqueness

logger = logging.getLogger("app.api.official_routes")

router = APIRouter(prefix="/routes", tags=["official-routes"])


def _safe_get_ydb_pool(request: Request) -> ydb.QuerySessionPool | None:
    """Safely get YDB pool from app.state without throwing 503 if unconfigured."""
    return getattr(request.app.state, "ydb_pool", None)


@router.get("/official", response_model=list[OfficialRoute])
def list_official_routes(request: Request) -> list[OfficialRoute]:
    """Retrieve all imported official routes of the Pushkin Museum."""
    pool = _safe_get_ydb_pool(request)
    routes = official_routes_repo.get_all_routes(pool)
    if not routes:
        # If not yet loaded into storage, run initial idempotent import
        routes = import_official_routes(pool)
    return routes


@router.post("/check-uniqueness", response_model=UniquenessCheckResponse)
def verify_uniqueness(payload: UniquenessCheckRequest, request: Request) -> UniquenessCheckResponse:
    """Verify if a generated route is unique or collides with an official museum route."""
    pool = _safe_get_ydb_pool(request)
    # Ensure official routes are populated
    routes = official_routes_repo.get_all_routes(pool)
    if not routes:
        routes = import_official_routes(pool)

    return check_route_uniqueness(
        new_exhibit_ids=payload.exhibit_ids,
        new_title=payload.title,
        official_routes=routes,
    )


@router.post("/import-official", response_model=list[OfficialRoute])
def trigger_import(request: Request) -> list[OfficialRoute]:
    """Trigger idempotent import of official museum routes."""
    pool = _safe_get_ydb_pool(request)
    return import_official_routes(pool)
