from fastapi import APIRouter

from app.api import ai, hello

router = APIRouter(prefix="/api")
router.include_router(hello.router)
router.include_router(ai.router)
