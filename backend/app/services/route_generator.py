"""Generate a museum route using catalog records as the source of truth."""

from __future__ import annotations

import json
import re
from typing import Any

from app.ai import ask


class RouteGenerationError(ValueError):
    """Raised when AI Studio does not return a usable, catalog-backed route."""


ROUTE_INSTRUCTIONS = """Ты составляешь образовательный маршрут по залам Пушкинского музея.
Используй только переданные факты и кандидатов. Не добавляй экспонаты, даты,
авторов, материалы, описания помещений или факты о доступности из своих знаний.
Выбери 4–6 кандидатов (либо всех, если кандидатов меньше четырёх) и расположи
их как тематический рассказ. Не утверждай, что порядок кратчайший или что он
оптимален по расстоянию. Для каждой остановки напиши короткую причину выбора и
задание-наблюдение, которое не требует выдуманных сведений. Не цитируй дословно
музейные описания. Верни только JSON без Markdown в формате:
{"stops":[{"id":"ID кандидата","reason":"...","activity":"..."}]}.
"""


def _candidate_facts(exhibit: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": exhibit["id"],
        "title": exhibit.get("title"),
        "authors": exhibit.get("authors", []),
        "date_text": exhibit.get("date_text"),
        "year": exhibit.get("year"),
        "type": exhibit.get("type"),
        "country": exhibit.get("country"),
        "material": exhibit.get("material"),
        "description": exhibit.get("description"),
        "annotation": exhibit.get("annotation"),
        "building_id": exhibit.get("building_id"),
        "hall": {
            "number": exhibit.get("hall", {}).get("number"),
            "name": exhibit.get("hall", {}).get("name"),
            "floor_number": exhibit.get("hall", {}).get("floor_number"),
        },
    }


def _parse_response(text: str) -> dict[str, Any]:
    content = text.strip()
    if content.startswith("```"):
        content = re.sub(r"^```(?:json)?\s*|\s*```$", "", content, flags=re.IGNORECASE)
    try:
        result = json.loads(content)
    except json.JSONDecodeError as exc:
        raise RouteGenerationError("AI Studio returned invalid JSON") from exc
    if not isinstance(result, dict) or not isinstance(result.get("stops"), list):
        raise RouteGenerationError("AI Studio response must contain a stops array")
    return result


def generate_route(
    *,
    candidates: list[dict[str, Any]],
    audience: str,
    interests: list[str],
    duration_minutes: int,
) -> list[dict[str, str]]:
    """Ask AI for stop IDs and generated guidance, then validate IDs and count."""
    if not candidates:
        return []

    expected_minimum = min(4, len(candidates))
    expected_maximum = min(6, len(candidates))
    prompt = json.dumps(
        {
            "visitor": {
                "audience": audience,
                "interests": interests,
                "duration_minutes": duration_minutes,
            },
            "candidate_count": len(candidates),
            "required_stops": {"min": expected_minimum, "max": expected_maximum},
            "candidates": [_candidate_facts(item) for item in candidates],
        },
        ensure_ascii=False,
    )
    response = _parse_response(ask(prompt, instructions=ROUTE_INSTRUCTIONS, timeout=50))
    candidate_ids = {str(item["id"]) for item in candidates}
    seen: set[str] = set()
    stops: list[dict[str, str]] = []

    for item in response["stops"]:
        if not isinstance(item, dict):
            raise RouteGenerationError("AI Studio returned a malformed stop")
        exhibit_id = item.get("id")
        if not isinstance(exhibit_id, (str, int)):
            raise RouteGenerationError("AI Studio returned a stop without an id")
        exhibit_id = str(exhibit_id)
        if exhibit_id not in candidate_ids:
            raise RouteGenerationError("AI Studio selected an id outside the candidate catalog")
        if exhibit_id in seen:
            raise RouteGenerationError("AI Studio returned a duplicate exhibit id")
        seen.add(exhibit_id)
        reason = item.get("reason")
        activity = item.get("activity")
        if not isinstance(reason, str) or not reason.strip() or not isinstance(activity, str) or not activity.strip():
            raise RouteGenerationError("AI Studio returned a stop without a reason or observation activity")
        stops.append({"id": exhibit_id, "reason": reason.strip(), "activity": activity.strip()})

    if not expected_minimum <= len(stops) <= expected_maximum:
        raise RouteGenerationError("AI Studio returned a route with an invalid number of stops")
    if len(candidates) < 4 and len(stops) != len(candidates):
        raise RouteGenerationError("AI Studio did not include every available candidate in the short route")
    return stops
