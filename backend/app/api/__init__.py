from fastapi import APIRouter

from app.api import ai, hello, official_routes, route

router = APIRouter(prefix="/api")
router.include_router(hello.router)
router.include_router(ai.router)
router.include_router(route.router)
router.include_router(official_routes.router)
