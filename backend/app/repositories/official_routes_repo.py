"""YDB repository for storing and querying official Pushkin Museum routes."""

import json
import logging
from typing import Any

import ydb
from app.schemas.official_route import OfficialRoute, OfficialRouteStop

logger = logging.getLogger("app.repositories.official_routes")

# In-memory store used when YDB is not configured (e.g. testing or local dev without YDB container)
_MEMORY_ROUTES_STORE: dict[str, OfficialRoute] = {}


CREATE_TABLE_QUERY = """
CREATE TABLE IF NOT EXISTS official_routes (
    id Utf8,
    title Utf8,
    description Utf8,
    source_url Utf8,
    source_name Utf8,
    collected_at Utf8,
    sequence_hash Utf8,
    set_hash Utf8,
    exhibit_ids Json,
    stops Json,
    verification_status Utf8,
    completeness_score Double,
    PRIMARY KEY (id)
);
"""

UPSERT_ROUTE_QUERY = """
DECLARE $id AS Utf8;
DECLARE $title AS Utf8;
DECLARE $description AS Utf8;
DECLARE $source_url AS Utf8;
DECLARE $source_name AS Utf8;
DECLARE $collected_at AS Utf8;
DECLARE $sequence_hash AS Utf8;
DECLARE $set_hash AS Utf8;
DECLARE $exhibit_ids AS Json;
DECLARE $stops AS Json;
DECLARE $verification_status AS Utf8;
DECLARE $completeness_score AS Double;

UPSERT INTO official_routes (
    id, title, description, source_url, source_name, collected_at,
    sequence_hash, set_hash, exhibit_ids, stops, verification_status, completeness_score
) VALUES (
    $id, $title, $description, $source_url, $source_name, $collected_at,
    $sequence_hash, $set_hash, $exhibit_ids, $stops, $verification_status, $completeness_score
);
"""

SELECT_ALL_ROUTES_QUERY = """
SELECT id, title, description, source_url, source_name, collected_at,
       sequence_hash, set_hash, exhibit_ids, stops, verification_status, completeness_score
FROM official_routes;
"""


def init_routes_table(pool: ydb.QuerySessionPool) -> None:
    """Ensure official_routes table exists in YDB."""
    try:
        pool.execute_with_retries(CREATE_TABLE_QUERY)
        logger.info("YDB official_routes table verified/created.")
    except Exception as exc:
        logger.warning("Could not initialize official_routes table in YDB: %s", exc)


def upsert_route(pool: ydb.QuerySessionPool | None, route: OfficialRoute) -> None:
    """Idempotently save or update an official route in YDB and memory store."""
    _MEMORY_ROUTES_STORE[route.id] = route

    if pool is None:
        return

    try:
        stops_json = json.dumps([s.model_dump() for s in route.stops], ensure_ascii=False)
        exhibit_ids_json = json.dumps(route.exhibit_ids, ensure_ascii=False)

        parameters = {
            "$id": (route.id, ydb.PrimitiveType.Utf8),
            "$title": (route.title, ydb.PrimitiveType.Utf8),
            "$description": (route.description, ydb.PrimitiveType.Utf8),
            "$source_url": (route.source_url, ydb.PrimitiveType.Utf8),
            "$source_name": (route.source_name, ydb.PrimitiveType.Utf8),
            "$collected_at": (route.collected_at, ydb.PrimitiveType.Utf8),
            "$sequence_hash": (route.sequence_hash, ydb.PrimitiveType.Utf8),
            "$set_hash": (route.set_hash, ydb.PrimitiveType.Utf8),
            "$exhibit_ids": (exhibit_ids_json, ydb.PrimitiveType.Json),
            "$stops": (stops_json, ydb.PrimitiveType.Json),
            "$verification_status": (route.verification_status, ydb.PrimitiveType.Utf8),
            "$completeness_score": (route.completeness_score, ydb.PrimitiveType.Double),
        }

        pool.execute_with_retries(UPSERT_ROUTE_QUERY, parameters)
    except Exception as exc:
        logger.warning("Failed to upsert official route %s to YDB: %s", route.id, exc)


def get_all_routes(pool: ydb.QuerySessionPool | None) -> list[OfficialRoute]:
    """Retrieve all official routes from YDB, falling back to memory store if YDB unavailable."""
    if pool is not None:
        try:
            result_sets = pool.execute_with_retries(SELECT_ALL_ROUTES_QUERY)
            if result_sets and result_sets[0].rows:
                routes: list[OfficialRoute] = []
                for row in result_sets[0].rows:
                    row_dict = dict(row)
                    exhibit_ids = json.loads(row_dict.get("exhibit_ids", "[]"))
                    stops_raw = json.loads(row_dict.get("stops", "[]"))
                    stops = [OfficialRouteStop(**s) for s in stops_raw]
                    routes.append(
                        OfficialRoute(
                            id=row_dict["id"],
                            title=row_dict["title"],
                            description=row_dict["description"],
                            source_url=row_dict["source_url"],
                            source_name=row_dict["source_name"],
                            collected_at=row_dict["collected_at"],
                            sequence_hash=row_dict["sequence_hash"],
                            set_hash=row_dict["set_hash"],
                            exhibit_ids=exhibit_ids,
                            stops=stops,
                            verification_status=row_dict.get("verification_status", "verified"),
                            completeness_score=float(row_dict.get("completeness_score", 1.0)),
                        )
                    )
                return routes
        except Exception as exc:
            logger.warning("Could not fetch official routes from YDB: %s. Using memory fallback.", exc)

    return list(_MEMORY_ROUTES_STORE.values())


def clear_memory_store_for_tests() -> None:
    """Clear memory store (used in unit tests)."""
    _MEMORY_ROUTES_STORE.clear()
