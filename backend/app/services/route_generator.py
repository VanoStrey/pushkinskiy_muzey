"""Generate a museum route using catalog records as the source of truth."""

from __future__ import annotations

import json
import re
import uuid
from typing import Any

from app.ai import ask
from app.config import settings
from app.data.exhibits import get_route_candidates
from app.schemas.route import RouteGenerateRequest, RouteGenerateResponse, Stop, Challenge


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
    hall = exhibit.get("hall") or {}
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
        "hall": {"number": hall.get("number"), "name": hall.get("name"), "floor_number": hall.get("floor_number")},
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


def select_candidate_exhibits(
    interests: list[str], target_count: int, building_id: str = "116"
) -> list[dict[str, Any]]:
    """Select eligible records only from the processed museum catalog."""
    candidates = get_route_candidates(building_id)
    terms = [value.strip().casefold() for value in interests if value.strip()]

    def score(exhibit: dict[str, Any]) -> int:
        searchable = " ".join(
            [
                str(exhibit.get("title") or ""),
                " ".join(exhibit.get("authors") or []),
                str(exhibit.get("type") or ""),
                str(exhibit.get("country") or ""),
                str(exhibit.get("material") or ""),
                str(exhibit.get("annotation") or ""),
            ]
        ).casefold()
        return sum(1 for term in terms if term in searchable)

    candidates.sort(key=score, reverse=True)
    return candidates[: min(len(candidates), max(4, target_count + 3))]


def _target_stop_count(duration_minutes: int) -> int:
    return 4 if duration_minutes <= 40 else 5 if duration_minutes <= 75 else 6


def generate_catalog_stops(
    *, candidates: list[dict[str, Any]], audience: str, interests: list[str], duration_minutes: int
) -> tuple[list[dict[str, str]], bool]:
    """Use the validated AI response when configured, otherwise use neutral observation tasks."""
    target_count = min(_target_stop_count(duration_minutes), len(candidates))
    if not candidates:
        return [], True
    if not settings.yandex_folder_id:
        return [
            {
                "id": str(item["id"]),
                "reason": "Экспонат входит в официальную экспозицию выбранного здания.",
                "activity": "Осмотрите экспонат и отметьте одну деталь, которая привлекла ваше внимание.",
            }
            for item in candidates[:target_count]
        ], True
    return generate_route(
        candidates=candidates,
        audience=audience,
        interests=interests,
        duration_minutes=duration_minutes,
    ), False


def generate_personalized_route(request: RouteGenerateRequest) -> RouteGenerateResponse:
    """Adapt the shared official-catalog generator to the original tour UI contract."""
    target_count = _target_stop_count(request.duration_minutes)
    candidates = select_candidate_exhibits(request.interests, target_count)
    audience = f"{request.group_type}; {request.difficulty}; формат {request.style}"
    generated, is_fallback = generate_catalog_stops(
        candidates=candidates,
        audience=audience,
        interests=request.interests,
        duration_minutes=request.duration_minutes,
    )
    by_id = {str(item["id"]): item for item in candidates}
    stops: list[Stop] = []
    for position, item in enumerate(generated, start=1):
        exhibit = by_id[item["id"]]
        hall = exhibit.get("hall") or {}
        building_name = hall.get("building_name") or exhibit.get("building_name")
        hall_label = hall.get("number") or hall.get("name")
        location = ", ".join(value for value in (building_name, f"Зал {hall_label}" if hall_label else None) if value)
        authors = exhibit.get("authors") or []
        date = exhibit.get("date_text") or (str(exhibit["year"]) if exhibit.get("year") is not None else None)
        source_text = str(exhibit.get("annotation") or exhibit.get("description") or "")[:500]
        stops.append(
            Stop(
                position=position,
                exhibit_id=item["id"],
                title=exhibit.get("title") or "Название не указано в данных музея",
                artist=", ".join(authors) if authors else None,
                date=date,
                image_url=None,
                location=location or None,
                description=source_text or "В открытой выгрузке музея нет описания этого экспоната.",
                personalization_reason=item["reason"],
                look_closer="Сначала осмотрите экспонат целиком, затем выполните задание-наблюдение.",
                challenge=Challenge(
                    type="observation",
                    question=item["activity"],
                    options=[],
                    correct_option=None,
                    explanation="Задание на наблюдение не имеет правильного ответа и не оценивается.",
                ),
                provenance_source=exhibit.get("inventory_number"),
                source_url=exhibit.get("source_url"),
            )
        )

    title = "Ваш маршрут по Пушкинскому музею"
    return RouteGenerateResponse(
        route_id=f"museum-route-{uuid.uuid4().hex[:10]}",
        title=title,
        intro=(
            "Остановки основаны на официальном каталоге музея. "
            "Задания помогают внимательно рассмотреть экспонаты; ответы не оцениваются."
        ),
        duration_minutes=request.duration_minutes,
        is_fallback=is_fallback,
        stops=stops,
    )
