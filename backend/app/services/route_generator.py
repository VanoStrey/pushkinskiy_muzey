"""Generate a museum route using catalog records as the source of truth."""

from __future__ import annotations

import json
import logging
import random
import re
import uuid
from typing import Any

from app.ai import ask
from app.config import settings
from app.data.exhibits import get_route_candidates, get_route_pool, get_hall_by_id, get_building_by_id
from app.schemas.route import RouteGenerateRequest, RouteGenerateResponse, Stop, Challenge, BreakInfo


logger = logging.getLogger("app.services.route_generator")


class RouteGenerationError(ValueError):
    """Raised when AI Studio does not return a usable, catalog-backed route."""


_BASE_INSTRUCTIONS = """Ты составляешь образовательный маршрут по залам Пушкинского музея.
Используй только переданные факты и кандидатов. Не добавляй экспонаты, даты,
авторов, материалы, описания помещений или факты о доступности из своих знаний.
Если в запросе задан required_stop_count, верни РОВНО столько остановок — это время,
которое гость выделил на визит. Иначе выбери 4–6 кандидатов. Если кандидатов меньше
нужного числа, верни всех. Расположи остановки
как тематический рассказ. Не утверждай, что порядок кратчайший или что он
оптимален по расстоянию. Если в visitor передан comment (пожелание/комментарий гостя),
обязательно учти его и в поле reason подробно объясни выбор с отсылкой к интересам посетителя.
Учитывай уровень знакомства с искусством (difficulty) и состав группы (group_type) при
формулировке reason — для "beginner" пиши проще и ярче, для "expert" — тоньше и с деталями.
Каждый reason должен быть РАЗНЫМ и говорить именно об этом произведении (его сюжете,
технике, эпохе или роли в маршруте). Не повторяй одну формулировку для нескольких остановок
и не пиши общих фраз вида «ещё один пример направления».
Не цитируй дословно музейные описания.
"""

_QUEST_CLAUSE = """Формат посещения — «квест»: для каждой остановки придумай вопрос-загадку
(activity) об ЭТОМ ЖЕ экспонате, перед которым стоит гость. Вопрос должен касаться только
фактов этого экспоната (его автор, датировка, материал, страна, техника, сюжет из названия).
Запрещено спрашивать «какая из представленных картин...» и упоминать другие остановки:
гость видит перед собой один экспонат и его подпись.
Спрашивай про РАЗНЫЕ аспекты на разных остановках: материал или техника, страна или
культура, век или датировка, тип предмета, сюжет из названия. Не повторяй одну и ту же
формулировку вопроса дважды за маршрут и не спрашивай про автора — его имя гость и так
видит в подписи к экспонату.
Дай 3–4 варианта ответа (options): один верный из переданных фактов, остальные —
правдоподобные, но неверные. Укажи номер верного начиная с 0 (correct_option) и короткое
пояснение (explanation) со ссылкой на факт каталога.
Пример хорошего вопроса: «Из какого материала выполнена эта статуэтка?» —
варианты «эбеновое дерево и позолота» / «мрамор» / «бронза».
Верни только JSON без Markdown в формате:
{"stops":[{"id":"ID кандидата","reason":"...","activity":"текст загадки",
"challenge_type":"question","options":["...","...","..."],"correct_option":0,
"explanation":"..."}]}.
"""

_OBSERVATION_CLAUSE = """Формат посещения — наблюдение: сформулируй задание (activity), которое
просит гостя рассмотреть конкретную деталь экспоната на основе переданных фактов; оно не имеет
правильного ответа и не оценивается.
Верни только JSON без Markdown в формате:
{"stops":[{"id":"ID кандидата","reason":"...","activity":"...","challenge_type":"observation"}]}.
"""

# Fixed interest tags coming from the frontend (and free-text comments) rarely appear
# verbatim in the processed catalog (titles/authors/types/countries are in Russian art-
# historical vocabulary, not UI labels like "древний мир"). Without this expansion the
# keyword filter below scores everything 0 and always returns the same first records.
_INTEREST_SYNONYM_RULES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("импрессион", ("моне", "дега", "ренуар", "писсарро", "сислей")),
    ("постимпрессион", ("сезанн", "гоген", "ван гог", "лотрек", "синьяк", "руссо")),
    ("загадк", ("египет", "погребальн", "реликварий", "демон", "аллегори", "византий")),
    ("тайн", ("египет", "погребальн", "демон", "аллегори", "византий")),
    ("символ", ("аллегори", "демон", "византий", "реликварий")),
    ("древн", ("египет", "греция", "археология", "статер", "древние цивилизации")),
    ("египет", ("египет",)),
    ("возрожден", ("кранах", "боттичелли", "микеланджело", "бронзино", "пармиджанино")),
    ("ренессанс", ("кранах", "боттичелли", "микеланджело", "бронзино")),
    ("человек", ("портрет", "рембрандт", "пикассо", "серов", "врубель")),
    ("эмоци", ("портрет", "рембрандт", "пикассо")),
    ("скульптур", ("скульптура", "роден", "микеланджело", "слепки", "статуя")),
)


def _build_route_instructions(style: str) -> str:
    clause = _QUEST_CLAUSE if style == "quest" else _OBSERVATION_CLAUSE
    return _BASE_INSTRUCTIONS + clause


def _expand_search_terms(interests: list[str], visitor_comment: str | None) -> list[str]:
    """Map fixed UI interest tags and free-text comments to vocabulary that actually
    appears in the processed museum catalog, so the keyword filter has real effect."""
    base_words = [value.strip().casefold() for value in interests if value.strip()]
    comment_words = re.findall(r"\w{3,}", visitor_comment.casefold()) if visitor_comment else []
    haystack = " ".join(base_words + comment_words)
    expanded = list(base_words) + comment_words
    for key, synonyms in _INTEREST_SYNONYM_RULES:
        if key in haystack:
            expanded.extend(synonyms)
    return expanded


def _compose_fallback_description(exhibit: dict[str, Any]) -> str:
    """Build a one-line factual summary strictly from verified catalog fields.

    The processed open dataset currently has an empty `annotation`/`description`
    for every record, so without this, every stop showed the same boilerplate
    "no description" line. This composes a unique, verifiable sentence per
    exhibit from fields that are always present in the catalog.
    """
    sentences: list[str] = []
    header_parts = [str(exhibit[field]) for field in ("type", "country") if exhibit.get(field)]
    if header_parts:
        sentences.append(", ".join(header_parts) + ".")
    authors = exhibit.get("authors") or []
    if authors:
        sentences.append(f"Автор: {', '.join(authors)}.")
    if exhibit.get("material"):
        sentences.append(f"Материал: {exhibit['material']}.")
    if exhibit.get("date_text"):
        sentences.append(f"Датировка: {exhibit['date_text']}.")
    elif exhibit.get("year") is not None:
        sentences.append(f"Датировка: {exhibit['year']}.")
    if exhibit.get("inventory_number"):
        sentences.append(f"Инвентарный номер: {exhibit['inventory_number']}.")
    if not exhibit.get("building_id"):
        sentences.append("Здание и зал не указаны в открытых данных музея — уточните на сайте.")
    elif not exhibit.get("hall_id"):
        # Be explicit instead of implying a hall we cannot verify: the open
        # dataset publishes no hall numbers for the Gallery building.
        sentences.append("Номер зала не указан в открытых данных музея — уточните на входе.")
    text = " ".join(sentences).strip()
    return text or "В открытой выгрузке музея нет дополнительного описания этого экспоната."


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


def _validate_quiz_fields(item: dict[str, Any]) -> tuple[list[str] | None, int | None, str | None]:
    """Validate AI-provided quiz fields; return (None, None, None) if missing/invalid
    instead of raising, so a quest-style stop can gracefully degrade to an observation
    task rather than failing the whole route over one malformed quiz."""
    raw_options = item.get("options")
    if not isinstance(raw_options, list) or not (2 <= len(raw_options) <= 4):
        return None, None, None
    if not all(isinstance(opt, str) and opt.strip() for opt in raw_options):
        return None, None, None
    options = [opt.strip() for opt in raw_options]
    raw_correct = item.get("correct_option")
    if not isinstance(raw_correct, int) or isinstance(raw_correct, bool) or not (0 <= raw_correct < len(options)):
        return None, None, None
    raw_explanation = item.get("explanation")
    if not isinstance(raw_explanation, str) or not raw_explanation.strip():
        return None, None, None
    return options, raw_correct, raw_explanation.strip()


def _shuffle_options(seed: str, options: list[str], correct_option: int) -> tuple[list[str], int]:
    """Move the correct answer off position zero, deterministically per exhibit."""
    correct_value = options[correct_option]
    shuffled = options[:]
    random.Random(seed).shuffle(shuffled)
    return shuffled, shuffled.index(correct_value)


def generate_route(
    *,
    candidates: list[dict[str, Any]],
    audience: str,
    interests: list[str],
    duration_minutes: int,
    visitor_comment: str | None = None,
    style: str = "observation",
    target_count: int | None = None,
) -> list[dict[str, Any]]:
    """Ask AI for stop IDs and generated guidance, then validate IDs and count.

    `target_count` pins the number of stops to what the visit length implies;
    without it the model is free to pick 4–6 and always takes the minimum, so a
    three-hour visit got the same four stops as a one-hour one.
    """
    if not candidates:
        return []

    if target_count is None:
        expected_minimum = min(4, len(candidates))
        expected_maximum = min(6, len(candidates))
    else:
        expected_minimum = expected_maximum = min(target_count, len(candidates))
    visitor_data: dict[str, Any] = {
        "audience": audience,
        "interests": interests,
        "duration_minutes": duration_minutes,
        "style": style,
    }
    if visitor_comment and visitor_comment.strip():
        visitor_data["comment"] = visitor_comment.strip()

    prompt = json.dumps(
        {
            "visitor": visitor_data,
            "candidate_count": len(candidates),
            "required_stops": {"min": expected_minimum, "max": expected_maximum},
            "required_stop_count": expected_minimum if expected_minimum == expected_maximum else None,
            "candidates": [_candidate_facts(item) for item in candidates],
        },
        ensure_ascii=False,
    )
    response = _parse_response(
        ask(
            prompt,
            instructions=_build_route_instructions(style),
            timeout=50,
            # A six-stop quest with four options per stop does not fit the
            # default budget and would come back as truncated JSON.
            max_output_tokens=6000 if style == "quest" else 3000,
        )
    )
    candidate_ids = {str(item["id"]) for item in candidates}
    seen: set[str] = set()
    stops: list[dict[str, Any]] = []

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

        options, correct_option, explanation = (None, None, None)
        if style == "quest":
            options, correct_option, explanation = _validate_quiz_fields(item)
            if options is not None:
                # The model almost always puts the correct answer first; shuffle
                # so the quiz cannot be won by always picking option one.
                options, correct_option = _shuffle_options(exhibit_id, options, correct_option)
        challenge_type = "question" if options is not None else "observation"

        stops.append(
            {
                "id": exhibit_id,
                "reason": reason.strip(),
                "activity": activity.strip(),
                "challenge_type": challenge_type,
                "options": options or [],
                "correct_option": correct_option,
                "explanation": explanation,
            }
        )

    if not expected_minimum <= len(stops) <= expected_maximum:
        raise RouteGenerationError("AI Studio returned a route with an invalid number of stops")
    if len(candidates) < 4 and len(stops) != len(candidates):
        raise RouteGenerationError("AI Studio did not include every available candidate in the short route")
    return stops


def select_candidate_exhibits(
    interests: list[str],
    target_count: int,
    building_id: str = "116",
    visitor_comment: str | None = None,
) -> list[dict[str, Any]]:
    """Select eligible records only from the processed museum catalog, scored by how
    well they match the visitor's interests/comment (expanded to catalog vocabulary)."""
    candidates = get_route_candidates(building_id)
    terms = _expand_search_terms(interests, visitor_comment)

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

    pool_size = min(len(candidates), max(target_count + 3, 18))
    scored = [(score(item), item) for item in candidates]
    if any(points > 0 for points, _ in scored):
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [item for _, item in scored[:pool_size]]

    # No keyword overlap at all (unusual free-text interests with no catalog
    # vocabulary match): vary the pool deterministically per request instead of
    # always returning the same first N catalog records in file order.
    rng = random.Random("|".join(sorted(terms)) or "default")
    shuffled = candidates[:]
    rng.shuffle(shuffled)
    return shuffled[:pool_size]


def select_personal_candidates(
    interests: list[str],
    target_count: int,
    visitor_comment: str | None = None,
) -> list[dict[str, Any]]:
    """Candidate pool for personal tours: the whole dataset of open buildings.

    Unlike `select_candidate_exhibits` (kept for the strict catalog endpoint),
    this spans every open building, so interests like "импрессионизм" can
    actually be matched — those works live in building 117, which the strict
    `route_eligible` rule excludes because the dataset has no hall numbers for
    it. Objects whose display location IS confirmed still rank first.
    """
    pool = get_route_pool()
    terms = _expand_search_terms(interests, visitor_comment)

    def score(exhibit: dict[str, Any]) -> tuple[int, int]:
        searchable = " ".join(
            [
                str(exhibit.get("title") or ""),
                " ".join(exhibit.get("authors") or []),
                str(exhibit.get("type") or ""),
                str(exhibit.get("country") or ""),
                str(exhibit.get("material") or ""),
                str(exhibit.get("date_text") or ""),
            ]
        ).casefold()
        matches = sum(1 for term in terms if term in searchable)
        confirmed = 1 if exhibit.get("route_eligible") is True else 0
        return (matches, confirmed)

    pool_size = min(len(pool), max(target_count + 4, 16))
    scored = [(score(item), item) for item in pool]
    if any(points[0] > 0 for points, _ in scored):
        scored.sort(key=lambda pair: pair[0], reverse=True)
        return [item for _, item in scored[:pool_size]]

    # No keyword overlap at all: still vary the pool per request instead of
    # always handing the model the same first N records in file order.
    rng = random.Random("|".join(sorted(terms)) or "default")
    shuffled = pool[:]
    rng.shuffle(shuffled)
    return shuffled[:pool_size]


def _target_stop_count(duration_minutes: int) -> int:
    return 4 if duration_minutes <= 40 else 5 if duration_minutes <= 75 else 6


def generate_catalog_stops(
    *,
    candidates: list[dict[str, Any]],
    audience: str,
    interests: list[str],
    duration_minutes: int,
    visitor_comment: str | None = None,
    style: str = "observation",
    pin_stop_count: bool = False,
    fallback_on_error: bool = False,
) -> tuple[list[dict[str, Any]], bool]:
    """Use the validated AI response when configured, otherwise use neutral observation tasks.

    With `fallback_on_error` a visitor never sees an error because the model
    broke its contract: the generation is retried once and then falls back to
    the deterministic catalog route with `is_fallback=True`. The strict catalog
    endpoint keeps the raising behaviour so a broken contract stays visible.
    """
    target_count = min(_target_stop_count(duration_minutes), len(candidates))
    if not candidates:
        return [], True

    def catalog_stops() -> list[dict[str, Any]]:
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
                "challenge_type": "observation",
                "options": [],
                "correct_option": None,
                "explanation": None,
            }
            for item in candidates[:target_count]
        ]

    if not settings.yandex_folder_id:
        return catalog_stops(), True

    attempts = 2 if fallback_on_error else 1
    for attempt in range(1, attempts + 1):
        try:
            return generate_route(
                candidates=candidates,
                audience=audience,
                interests=interests,
                duration_minutes=duration_minutes,
                visitor_comment=visitor_comment,
                style=style,
                target_count=target_count if pin_stop_count else None,
            ), False
        except RouteGenerationError:
            if not fallback_on_error:
                raise
            if attempt == attempts:
                logger.warning("AI Studio broke the route contract twice; serving the catalog route")
                return catalog_stops(), True
    return catalog_stops(), True


def generate_personalized_route(request: RouteGenerateRequest) -> RouteGenerateResponse:
    """Adapt the shared official-catalog generator to the original tour UI contract."""
    target_count = _target_stop_count(request.duration_minutes)
    candidates = select_personal_candidates(
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
        style=request.style,
        pin_stop_count=True,
        fallback_on_error=True,
    )
    by_id = {str(item["id"]): item for item in candidates}
    stops: list[Stop] = []
    for position, item in enumerate(generated, start=1):
        exhibit = by_id[item["id"]]
        exhibit_building_id = exhibit.get("building_id") or ""
        hall = exhibit.get("hall") or get_hall_by_id(exhibit_building_id, exhibit.get("hall_id", "")) or {}
        building = get_building_by_id(exhibit_building_id) or {}
        # Never invent a building: part of the dataset carries no location at all.
        building_name = hall.get("building_name") or building.get("name") or None
        hall_label = hall.get("number")
        hall_name = hall.get("name")
        if building_name:
            location = ", ".join(
                (building_name, f"Зал {hall_label}" if hall_label else "зал уточните на входе")
            )
        else:
            location = "Здание и зал уточните на сайте музея"
        authors = exhibit.get("authors") or []
        date = exhibit.get("date_text") or (str(exhibit["year"]) if exhibit.get("year") is not None else None)
        source_text = str(exhibit.get("annotation") or exhibit.get("description") or "")[:500]
        image_urls = exhibit.get("image_urls") or []
        image_url = image_urls[0] if image_urls else None

        challenge_type = item.get("challenge_type", "observation")
        if challenge_type == "question":
            challenge = Challenge(
                type="question",
                question=item["activity"],
                options=item.get("options") or [],
                correct_option=item.get("correct_option"),
                explanation=item.get("explanation"),
            )
        else:
            challenge = Challenge(
                type="observation",
                question=item["activity"],
                options=[],
                correct_option=None,
                explanation="Задание на наблюдение не имеет правильного ответа и не оценивается.",
            )

        stops.append(
            Stop(
                position=position,
                exhibit_id=item["id"],
                title=exhibit.get("title") or "Название не указано в данных музея",
                artist=", ".join(authors) if authors else None,
                date=date,
                image_url=image_url,
                location=location or None,
                description=source_text or _compose_fallback_description(exhibit),
                personalization_reason=item["reason"],
                look_closer=(
                    "Внимательно рассмотрите экспонат, прежде чем отвечать на вопрос ниже."
                    if challenge_type == "question"
                    else "Сначала осмотрите экспонат целиком, затем выполните задание-наблюдение."
                ),
                challenge=challenge,
                provenance_source=exhibit.get("inventory_number"),
                source_url=exhibit.get("source_url"),
                hall_id=str(hall.get("id")) if hall.get("id") else (str(exhibit.get("hall_id")) if exhibit.get("hall_id") else None),
                hall_number=str(hall_label) if hall_label else None,
                hall_name=hall_name,
                floor_number=str(hall.get("floor_number")) if hall.get("floor_number") else None,
                building_id=str(exhibit_building_id) if exhibit_building_id else None,
                building_name=building_name,
            )
        )

    # Break calculation
    has_break = False
    break_after_stop = None
    break_info = None

    if request.include_break and len(stops) >= 3:
        has_break = True
        break_after_stop = len(stops) // 2
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
