"""YDB driver lifecycle.

The driver and a query session pool are created once at startup and shared
via `app.state`. Endpoints get the pool with `Depends(get_ydb_pool)`.
Credentials are resolved by `ydb.credentials_from_env_variables()`:
`YDB_ANONYMOUS_CREDENTIALS=1` for local YDB, `YDB_METADATA_CREDENTIALS=1`
in Cloud Functions (the function's service account).
"""

import asyncio
import logging

import ydb
from fastapi import HTTPException, Request

from app.config import Settings

logger = logging.getLogger("app.db")


def create_driver(settings: Settings) -> ydb.Driver | None:
    if not settings.ydb_endpoint or not settings.ydb_database:
        logger.warning("YDB is not configured: set YDB_ENDPOINT and YDB_DATABASE")
        return None
    return ydb.Driver(
        endpoint=settings.ydb_endpoint,
        database=settings.ydb_database,
        credentials=ydb.credentials_from_env_variables(),
    )


def _wait(driver: ydb.Driver, settings: Settings) -> None:
    try:
        driver.wait(timeout=settings.ydb_connect_timeout, fail_fast=True)
    except Exception as exc:  # noqa: BLE001 - any failure is only logged
        logger.error(
            "YDB connection failed: endpoint=%s database=%s error=%s",
            settings.ydb_endpoint,
            settings.ydb_database,
            exc,
        )
    else:
        logger.info(
            "YDB connection succeeded: endpoint=%s database=%s",
            settings.ydb_endpoint,
            settings.ydb_database,
        )


def check_connection(driver: ydb.Driver, settings: Settings) -> asyncio.Task:
    """Check the connection in the background so startup is never blocked."""
    return asyncio.create_task(asyncio.to_thread(_wait, driver, settings))


def get_ydb_pool(request: Request) -> ydb.QuerySessionPool:
    """FastAPI dependency: the shared YDB query session pool."""
    pool = getattr(request.app.state, "ydb_pool", None)
    if pool is None:
        raise HTTPException(status_code=503, detail="YDB is not configured")
    return pool
