import logging
from contextlib import asynccontextmanager

import ydb
from fastapi import FastAPI

from app.api import router as api_router
from app.config import settings
from app.db import check_connection, create_driver

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    driver = create_driver(settings)
    pool = ydb.QuerySessionPool(driver) if driver else None
    app.state.ydb_driver = driver
    app.state.ydb_pool = pool
    check_task = check_connection(driver, settings) if driver else None
    yield
    if check_task:
        check_task.cancel()
    if pool:
        pool.stop()
    if driver:
        driver.stop(timeout=1)


app = FastAPI(
    title=settings.app_name,
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
app.include_router(api_router)
