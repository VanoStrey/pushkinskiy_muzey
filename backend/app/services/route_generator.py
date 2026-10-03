"""Generate a museum route using catalog records as the source of truth."""

from __future__ import annotations

import json
import re
import uuid
from typing import Any

from app.ai import ask
from app.config import settings
from app.data.exhibits import get_route_candidates, get_hall_by_id, get_building_by_id
from app.schemas.route import RouteGenerateRequest, RouteGenerateResponse, Stop, Challenge, BreakInfo


class RouteGenerationError(ValueError):
    """Raised when AI Studio does not return a usable, catalog-backed route."""


ROUTE_INSTRUCTIONS = """Ты составляешь образовательный маршрут по залам Пушкинского музея.
Используй только переданные факты и кандидатов. Не добавляй экспонаты, даты,
авторов, материалы, описания помещений или факты о доступности из своих знаний.
Выбери 4–6 кандидатов (либо всех, если кандидатов меньше четырёх) и расположи
их как тематический рассказ. Не утверждай, что порядок кратчайший или что он
оптимален по расстоянию. Если в visitor передан comment (пожелание/комментарий гостя),
обязательно учти его и в поле reason подробно объясни выбор с отсылкой к интересам посетителя.
Для каждой остановки напиши причину выбора (reason) и задание-наблюдение (activity),
которое не требует выдуманных сведений. Не цитируй дословно музейные описания.
Верни только JSON без Markdown в формате:
{"stops":[{"id":"ID кандидата","reason":"...","activity":"..."}]}.
"""


def _candidate_facts(exhibit: dict[str, Any]) -> dict[str, Any]:
    hall = exhibit.get("hall") or get_hall_by_id(exhibit.get("building_id", "116"), exhibit.get("hall_id", "")) or {}
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
    visitor_comment: str | None = None,
) -> list[dict[str, str]]:
    """Ask AI for stop IDs and generated guidance, then validate IDs and count."""
    if not candidates:
        return []

    expected_minimum = min(4, len(candidates))
    expected_maximum = min(6, len(candidates))
    visitor_data: dict[str, Any] = {
        "audience": audience,
        "interests": interests,
        "duration_minutes": duration_minutes,
    }
    if visitor_comment and visitor_comment.strip():
        visitor_data["comment"] = visitor_comment.strip()

    prompt = json.dumps(
        {
            "visitor": visitor_data,
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


# Canonical topological walking sequence for Main Building (116).
# Preserves enfilade continuity, clusters multiple exhibits in the same hall together,
# and avoids back-and-forth stair climbing between floors.
HALL_TOPOLOGICAL_ORDER_MAIN: dict[str, tuple[int, int]] = {
    # Floor 1 (from Entrance clockwise/around courtyards)
    "186": (1, 10),   # Зал 1 (Египет)
    "187": (1, 20),   # Зал 2 (Ближний Восток)
    "188": (1, 30),   # Зал 3 (Троя)
    "189": (1, 40),   # Зал 4 (Античность)
    "190": (1, 50),   # Зал 5 (Причерноморье)
    "191": (1, 60),   # Зал 6 (Эллинистический/Римский Египет, Копты)
    "192": (1, 70),   # Зал 7 (Византия, ранняя Италия)
    "196": (1, 80),   # Зал 11 (Голландия XVII в.)
    "195": (1, 90),   # Зал 10 (Рембрандт)
    "194": (1, 100),  # Зал 9 (Фландрия)
    "193": (1, 110),  # Зал 8 (Германия/Нидерланды XV–XVI)
    "197": (1, 120),  # Зал 14 (Греческий дворик)
    "198": (1, 130),  # Зал 15 (Итальянский дворик / перерыв)

    # Floor 2 (from Grand Staircase through Classical sculpture, White Hall, French & Baroque art)
    "199": (2, 10),   # Зал 16 (Древняя Греция)
    "200": (2, 20),   # Зал 16a (Эгейский мир)
    "213": (2, 30),   # Зал 29 (Микеланджело)
    "212": (2, 40),   # Зал 28 (Итальянская скульптура XV в.)
    "211": (2, 50),   # Зал 27 (Скульптура Германии/Нидерландов)
    "210": (2, 60),   # Зал 26 (Средние века)
    "209": (2, 70),   # Зал 25 (Древний Рим)
    "208": (2, 80),   # Зал 24 (Поздняя классика)
    "214": (2, 90),   # Зал 30 (Белый зал)
    "207": (2, 100),  # Зал 23 (Франция конец XVIII – XIX)
    "206": (2, 110),  # Зал 22 (Франция середина XVIII)
    "205": (2, 120),  # Зал 21 (Франция XVII)
    "204": (2, 130),  # Зал 20 (Выставочный)
    "203": (2, 140),  # Зал 19 (Выставочный/галерея)
    "202": (2, 150),  # Зал 18 (Испания и Италия XVII в.)
    "201": (2, 160),  # Зал 17 (Итальянское барокко)
}


def get_exhibit_topological_key(exhibit: dict[str, Any]) -> tuple[int, int, str]:
    """Returns (floor, hall_seq, exhibit_id) ensuring enfilade order and room clustering."""
    hall = exhibit.get("hall") or get_hall_by_id(exhibit.get("building_id", "116"), exhibit.get("hall_id", "")) or {}
    hall_id = str(hall.get("id") or exhibit.get("hall_id") or "")
    if hall_id in HALL_TOPOLOGICAL_ORDER_MAIN:
        floor, seq = HALL_TOPOLOGICAL_ORDER_MAIN[hall_id]
        return (floor, seq, str(exhibit.get("id", "")))

    floor_num = 1
    try:
        floor_num = int(hall.get("floor_number") or 1)
    except (ValueError, TypeError):
        pass

    num_str = str(hall.get("number") or "")
    digits = "".join(c for c in num_str if c.isdigit())
    hall_num = int(digits) if digits else 99
    return (floor_num, hall_num, str(exhibit.get("id", "")))


def select_candidate_exhibits(
    interests: list[str],
    target_count: int,
    building_id: str = "116",
    visitor_comment: str | None = None,
) -> list[dict[str, Any]]:
    """Select eligible records only from the processed museum catalog."""
    candidates = get_route_candidates(building_id)
    comment_terms = (
        [word for word in re.findall(r"\w{3,}", visitor_comment.casefold())]
        if visitor_comment
        else []
    )
    terms = [value.strip().casefold() for value in interests if value.strip()] + comment_terms

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
    *,
    candidates: list[dict[str, Any]],
    audience: str,
    interests: list[str],
    duration_minutes: int,
    visitor_comment: str | None = None,
) -> tuple[list[dict[str, str]], bool]:
    """Use the validated AI response when configured, otherwise use neutral observation tasks."""
    target_count = min(_target_stop_count(duration_minutes), len(candidates))
    if not candidates:
        return [], True
    if not settings.yandex_folder_id:
        def format_reason(cand: dict[str, Any]) -> str:
            if visitor_comment and visitor_comment.strip():
                short = visitor_comment.strip()[:50]
                return f"Подобран по вашему комментарию («{short}…»): шедевр постоянной экспозиции."
            return "Экспонат входит в официальную экспозицию выбранного здания."

        return [
            {
                "id": str(item["id"]),
                "reason": format_reason(item),
                "activity": "Осмотрите экспонат и отметьте одну деталь, которая привлекла ваше внимание.",
            }
            for item in candidates[:target_count]
        ], True
    return generate_route(
        candidates=candidates,
        audience=audience,
        interests=interests,
        duration_minutes=duration_minutes,
        visitor_comment=visitor_comment,
    ), False


def generate_personalized_route(request: RouteGenerateRequest) -> RouteGenerateResponse:
    """Adapt the shared official-catalog generator to the original tour UI contract."""
    target_count = _target_stop_count(request.duration_minutes)
    candidates = select_candidate_exhibits(
        request.interests,
        target_count,
        visitor_comment=request.visitor_comment,
    )
    audience = f"{request.group_type}; {request.difficulty}; формат {request.style}"
    if request.visitor_comment:
        audience += f"; комментарий: {request.visitor_comment}"
    generated, is_fallback = generate_catalog_stops(
        candidates=candidates,
        audience=audience,
        interests=request.interests,
        duration_minutes=request.duration_minutes,
        visitor_comment=request.visitor_comment,
    )
    by_id = {str(item["id"]): item for item in candidates}

    # Sort generated stops topologically so visitors experience a smooth, coherent enfilade journey
    generated_sorted = sorted(
        generated,
        key=lambda item: get_exhibit_topological_key(by_id[item["id"]])
    )

    stops: list[Stop] = []
    for position, item in enumerate(generated_sorted, start=1):
        exhibit = by_id[item["id"]]
        hall = exhibit.get("hall") or get_hall_by_id(exhibit.get("building_id", "116"), exhibit.get("hall_id", "")) or {}
        building = get_building_by_id(exhibit.get("building_id", "116")) or {}
        building_name = hall.get("building_name") or building.get("name") or "Главное здание"
        hall_label = hall.get("number")
        hall_name = hall.get("name")
        location = ", ".join(value for value in (building_name, f"Зал {hall_label}" if hall_label else None) if value)
        authors = exhibit.get("authors") or []
        date = exhibit.get("date_text") or (str(exhibit["year"]) if exhibit.get("year") is not None else None)
        source_text = str(exhibit.get("annotation") or exhibit.get("description") or "")[:500]
        image_urls = exhibit.get("image_urls") or []
        image_url = image_urls[0] if image_urls else None

        stops.append(
            Stop(
                position=position,
                exhibit_id=item["id"],
                title=exhibit.get("title") or "Название не указано в данных музея",
                artist=", ".join(authors) if authors else None,
                date=date,
                image_url=image_url,
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
                hall_id=str(hall.get("id")) if hall.get("id") else (str(exhibit.get("hall_id")) if exhibit.get("hall_id") else None),
                hall_number=str(hall_label) if hall_label else None,
                hall_name=hall_name,
                floor_number=str(hall.get("floor_number")) if hall.get("floor_number") else None,
                building_id=str(exhibit.get("building_id", "116")),
                building_name=building_name,
            )
        )

    # Break calculation
    has_break = False
    break_after_stop = None
    break_info = None

    if request.include_break and len(stops) >= 3:
        has_break = True
        # If route spans two floors, place break right before transitioning floors
        floor_transition_idx = None
        for i in range(len(stops) - 1):
            if stops[i].floor_number != stops[i + 1].floor_number:
                floor_transition_idx = i + 1
                break

        break_after_stop = floor_transition_idx if floor_transition_idx is not None else len(stops) // 2
        break_info = BreakInfo(
            title="Перерыв на отдых и кофе",
            location="Итальянский дворик (Зал 15) / Цокольный этаж",
            duration_minutes=15,
            note=(
                "Буфет в цокольном этаже Главного здания временно закрыт на техническое обслуживание "
                "(по данным сайта музея). Для комфортного отдыха и паузы рекомендуем Итальянский (зал 15) "
                "или Греческий дворик (зал 14) с диванами и естественным освещением."
            ),
            floor_number="1",
            hall_number="15",
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
        has_break=has_break,
        break_after_stop=break_after_stop,
        break_info=break_info,
    )
