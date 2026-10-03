"""Cached access to the prepared official museum catalog."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any


PROCESSED_DIR = Path(__file__).resolve().parent / "processed"


@lru_cache(maxsize=1)
def _all_exhibits() -> tuple[dict[str, Any], ...]:
    path = PROCESSED_DIR / "exhibits.json"
    with path.open(encoding="utf-8") as source:
        records = json.load(source)
    if not isinstance(records, list):
        raise ValueError(f"{path} must contain a JSON array")
    result: list[dict[str, Any]] = []
    seen: set[str] = set()
    for record in records:
        if not isinstance(record, dict) or not isinstance(record.get("id"), str):
            raise ValueError(f"{path} contains an exhibit without a string id")
        if record["id"] in seen:
            raise ValueError(f"{path} contains duplicate exhibit id {record['id']}")
        seen.add(record["id"])
        result.append(record)
    return tuple(result)


@lru_cache(maxsize=1)
def _all_buildings() -> tuple[dict[str, Any], ...]:
    path = PROCESSED_DIR / "buildings.json"
    with path.open(encoding="utf-8") as source:
        records = json.load(source)
    if not isinstance(records, list):
        raise ValueError(f"{path} must contain a JSON array")
    return tuple(record for record in records if isinstance(record, dict))


@lru_cache(maxsize=1)
def _all_halls() -> tuple[dict[str, Any], ...]:
    path = PROCESSED_DIR / "halls.json"
    with path.open(encoding="utf-8") as source:
        records = json.load(source)
    if not isinstance(records, list):
        raise ValueError(f"{path} must contain a JSON array")
    return tuple(record for record in records if isinstance(record, dict))


def get_all_exhibits() -> list[dict[str, Any]]:
    """Return all successfully read exhibits, including incomplete records."""
    return list(_all_exhibits())


def get_exhibit_by_id(exhibit_id: str | int) -> dict[str, Any] | None:
    wanted = str(exhibit_id)
    return next((exhibit for exhibit in _all_exhibits() if exhibit["id"] == wanted), None)


def get_all_buildings() -> list[dict[str, Any]]:
    return list(_all_buildings())


def get_building_by_id(building_id: str | int) -> dict[str, Any] | None:
    wanted = str(building_id)
    return next((building for building in _all_buildings() if building.get("id") == wanted), None)


def get_hall_by_id(building_id: str | int, hall_id: str | int) -> dict[str, Any] | None:
    building_key, hall_key = str(building_id), str(hall_id)
    return next(
        (
            hall
            for hall in _all_halls()
            if hall.get("building_id") == building_key and hall.get("id") == hall_key
        ),
        None,
    )


def get_route_candidates(building_id: str | int = "116") -> list[dict[str, Any]]:
    wanted = str(building_id)
    return [
        exhibit
        for exhibit in _all_exhibits()
        if exhibit.get("building_id") == wanted and exhibit.get("route_eligible") is True
    ]


def clear_catalog_cache() -> None:
    """Clear cached files; useful for tests or an in-process data refresh."""
    _all_exhibits.cache_clear()
    _all_buildings.cache_clear()
    _all_halls.cache_clear()
