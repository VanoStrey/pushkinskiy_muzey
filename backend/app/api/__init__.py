from fastapi import APIRouter

from app.api import ai, exhibits, hello, official_routes, route, routes

router = APIRouter(prefix="/api")
router.include_router(hello.router)
router.include_router(ai.router)
router.include_router(exhibits.router)
router.include_router(route.router)
router.include_router(routes.router)
router.include_router(official_routes.router)
