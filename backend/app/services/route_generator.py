"""Route generation service integrating Yandex AI Studio and verified Pushkin Museum catalog."""

import json
import logging
import re
import uuid
from typing import Any

from app.ai import ask
from app.config import settings
from app.data.exhibits import VERIFIED_EXHIBITS, get_all_exhibits, get_exhibit_by_id
from app.schemas.route import Challenge, RouteGenerateRequest, RouteGenerateResponse, Stop

logger = logging.getLogger("app.services.route_generator")


def _calculate_target_stop_count(duration_minutes: int) -> int:
    """Calculate realistic number of stops (4 to 6) based on available time."""
    if duration_minutes <= 40:
        return 4
    if duration_minutes <= 75:
        return 5
    return 6


def select_candidate_exhibits(interests: list[str], target_count: int) -> list[dict[str, Any]]:
    """Select candidate exhibits from verified catalog matching user interests."""
    normalized_interests = [i.strip().lower() for i in interests if i.strip()]
    exhibits = get_all_exhibits()

    def score(exhibit: dict[str, Any]) -> int:
        pts = 0
        tags = [t.lower() for t in exhibit.get("tags", [])]
        title_artist = (exhibit.get("title", "") + " " + exhibit.get("artist", "")).lower()

        for user_int in normalized_interests:
            for tag in tags:
                if user_int in tag or tag in user_int:
                    pts += 3
            if user_int in title_artist:
                pts += 2

        # Give slight baseline score to iconic masterpieces for balance
        if "шедевры" in tags:
            pts += 1
        return pts

    # Sort descending by relevance score
    scored = sorted(exhibits, key=score, reverse=True)

    # Return slightly more candidates than needed (e.g. target_count + 2..3) so AI can curate
    candidate_pool_size = min(len(scored), target_count + 3)
    candidates = scored[:candidate_pool_size]

    # Ensure we have at least target_count candidates
    if len(candidates) < target_count:
        candidates = exhibits[:target_count]

    return candidates


def _clean_json_markdown(text: str) -> str:
    """Remove markdown code blocks if the model wrapped JSON in ```json ... ```."""
    text = text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text, re.IGNORECASE)
    if match:
        return match.group(1).strip()
    return text


def build_fallback_route(
    request: RouteGenerateRequest,
    target_count: int,
    reason: str = "Режим проверенного кураторского маршрута",
) -> RouteGenerateResponse:
    """Build high quality curated fallback route when AI Studio is unavailable."""
    logger.info("Using verified fallback route generator. Reason: %s", reason)
    candidates = select_candidate_exhibits(request.interests, target_count)
    selected = candidates[:target_count]

    title_map = {
        "quest": "Тайны и загадки Пушкинского музея",
        "story": "Главные истории шедевров на Волхонке",
        "meditative": "Вдохновение и созерцание: классический маршрут",
    }
    title = title_map.get(request.style, "Шедевры Пушкинского музея: персональный взгляд")

    intro = (
        f"Кураторский маршрут из {len(selected)} главных произведений музея, "
        f"подобранный под ваш формат ({request.duration_minutes} мин.). "
        "Познакомьтесь с подлинниками мирового значения от античности до импрессионизма."
    )

    stops: list[Stop] = []
    for idx, ex in enumerate(selected, start=1):
        default_ch = ex.get("default_challenge", {})
        stops.append(
            Stop(
                position=idx,
                exhibit_id=ex["id"],
                title=ex["title"],
                artist=ex["artist"],
                date=ex["date"],
                image_url=ex.get("image_url"),
                location=ex.get("location"),
                description=ex["description"],
                personalization_reason=(
                    f"Произведение гармонично раскрывает тему '{', '.join(request.interests[:2]) or 'шедевров'}' "
                    f"и отлично подходит для темпа в {request.duration_minutes} минут."
                ),
                look_closer=default_ch.get("look_closer", "Обратите внимание на композицию и световые акценты мастера."),
                challenge=Challenge(
                    type="question",
                    question=default_ch.get("question", "Какая ключевая деталь передает замысел автора?"),
                    options=default_ch.get("options", ["Композиционный акцент", "Цветовой контраст", "Фактура материала"]),
                    correct_option=default_ch.get("correct_option", 0),
                    explanation=default_ch.get("explanation", "Мастер уделяет особое внимание смысловым деталям сюжета."),
                ),
                provenance_source=ex.get("provenance_source"),
            )
        )

    return RouteGenerateResponse(
        route_id=f"route-{uuid.uuid4().hex[:8]}",
        title=title,
        intro=intro,
        duration_minutes=request.duration_minutes,
        is_fallback=True,
        stops=stops,
    )


def generate_personalized_route(request: RouteGenerateRequest) -> RouteGenerateResponse:
    """Generate a personalized museum route using Yandex AI Studio with verified catalog grounding."""
    target_count = _calculate_target_stop_count(request.duration_minutes)
    candidates = select_candidate_exhibits(request.interests, target_count)

    # If AI Studio is not configured, directly return verified fallback
    if not settings.yandex_folder_id:
        return build_fallback_route(request, target_count, reason="YANDEX_FOLDER_ID is not configured")

    system_instruction = (
        "Ты — ведущий научный сотрудник и арт-гид Государственного музея изобразительных искусств имени А.С. Пушкина. "
        "Твоя задача — составить увлекательный, культурно достоверный и живой персональный маршрут для посетителя. "
        "СТРОГИЕ ПРАВИЛА: "
        "1. Используй ТОЛЬКО предоставленные экспонаты по их точным 'exhibit_id'. Ни в коем случае не придумывай свои экспонаты или авторов! "
        f"2. Выбери ровно {target_count} экспонатов из предложенного списка кандидатов и выстрой их в логичную последовательность. "
        "3. Для каждого экспоната сформулируй: "
        "   - personalization_reason: почему именно это произведение интересно посетителю с учетом его предпочтений; "
        "   - look_closer: конкретную интригующую деталь на произведении, которую нужно рассмотреть вживую; "
        "   - challenge: интересную загадку/вопрос по деталям или истории произведения с 3 вариантами ответа, правильным индексом (0, 1 или 2) и пояснением. "
        "4. Ответ верни СТРОГО в формате чистого JSON без оберток и вводных слов."
    )

    candidates_summary = [
        {
            "exhibit_id": c["id"],
            "title": c["title"],
            "artist": c["artist"],
            "date": c["date"],
            "location": c.get("location"),
            "factual_context": c["description"][:180] + "...",
            "notable_details": c.get("key_details", []),
        }
        for c in candidates
    ]

    prompt = f"""
Составь персональный маршрут по Пушкинскому музею:
- Интересы гостя: {', '.join(request.interests) if request.interests else 'общее знакомство с шедеврами'}
- Время: {request.duration_minutes} минут
- Состав группы: {request.group_type}
- Уровень подготовки: {request.difficulty}
- Стиль: {request.style}
- Требуемое количество остановок: ровно {target_count}

Кандидаты из проверенного фонда музея (выбирай ТОЛЬКО из них):
{json.dumps(candidates_summary, ensure_ascii=False, indent=2)}

Формат ответа JSON:
{{
  "title": "Красивое авторское название маршрута",
  "intro": "Краткое кураторское вступление (2-3 предложения)",
  "stops": [
    {{
      "exhibit_id": "один из id кандидатов выше",
      "personalization_reason": "обращение к гостю: почему это интересно именно ему",
      "look_closer": "на какую именно деталь обратить внимание",
      "challenge": {{
        "question": "вопрос/загадка по произведению",
        "options": ["вариант 1", "вариант 2", "вариант 3"],
        "correct_option": 0,
        "explanation": "объяснение правильного ответа"
      }}
    }}
  ]
}}
"""

    try:
        raw_response = ask(prompt=prompt, instructions=system_instruction, timeout=45)
        cleaned_json = _clean_json_markdown(raw_response)
        data = json.loads(cleaned_json)

        raw_stops = data.get("stops", [])
        validated_stops: list[Stop] = []
        seen_ids: set[str] = set()

        for raw_stop in raw_stops:
            ex_id = raw_stop.get("exhibit_id")
            if not ex_id or ex_id in seen_ids:
                continue
            verified_ex = get_exhibit_by_id(ex_id)
            if not verified_ex:
                # Discard unknown hallucinated exhibit id
                continue

            seen_ids.add(ex_id)
            pos = len(validated_stops) + 1

            # Validate challenge
            raw_ch = raw_stop.get("challenge", {})
            def_ch = verified_ex.get("default_challenge", {})

            ch_options = raw_ch.get("options")
            if not isinstance(ch_options, list) or len(ch_options) < 2:
                ch_options = def_ch.get("options", ["Вариант А", "Вариант Б", "Вариант В"])

            correct_opt = raw_ch.get("correct_option")
            if not isinstance(correct_opt, int) or correct_opt < 0 or correct_opt >= len(ch_options):
                correct_opt = def_ch.get("correct_option", 0)

            ch_question = raw_ch.get("question") or def_ch.get("question", "Взгляните на эту деталь произведения:")
            ch_explanation = raw_ch.get("explanation") or def_ch.get("explanation", "Деталь раскрывает замысел художника.")

            challenge = Challenge(
                type="question",
                question=ch_question,
                options=ch_options,
                correct_option=correct_opt,
                explanation=ch_explanation,
            )

            validated_stops.append(
                Stop(
                    position=pos,
                    exhibit_id=verified_ex["id"],
                    title=verified_ex["title"],
                    artist=verified_ex["artist"],
                    date=verified_ex["date"],
                    image_url=verified_ex.get("image_url"),
                    location=verified_ex.get("location"),
                    description=verified_ex["description"],
                    personalization_reason=(
                        raw_stop.get("personalization_reason")
                        or f"Выбрано с учетом интереса к направлению '{', '.join(request.interests[:2]) or 'искусство'}'."
                    ),
                    look_closer=(
                        raw_stop.get("look_closer")
                        or def_ch.get("look_closer", "Приглядитесь к мазкам и деталям композиции.")
                    ),
                    challenge=challenge,
                    provenance_source=verified_ex.get("provenance_source"),
                )
            )

            if len(validated_stops) == target_count:
                break

        # If LLM returned fewer than 4 valid exhibits, complete from candidates
        if len(validated_stops) < 4:
            for cand in candidates:
                if cand["id"] not in seen_ids:
                    seen_ids.add(cand["id"])
                    def_ch = cand.get("default_challenge", {})
                    validated_stops.append(
                        Stop(
                            position=len(validated_stops) + 1,
                            exhibit_id=cand["id"],
                            title=cand["title"],
                            artist=cand["artist"],
                            date=cand["date"],
                            image_url=cand.get("image_url"),
                            location=cand.get("location"),
                            description=cand["description"],
                            personalization_reason=f"Гармонично дополняет ваш маршрут по Пушкинскому музею.",
                            look_closer=def_ch.get("look_closer", "Обратите внимание на детали."),
                            challenge=Challenge(
                                type="question",
                                question=def_ch.get("question", "Вопрос по произведению:"),
                                options=def_ch.get("options", ["Вариант 1", "Вариант 2", "Вариант 3"]),
                                correct_option=def_ch.get("correct_option", 0),
                                explanation=def_ch.get("explanation", "Пояснение."),
                            ),
                            provenance_source=cand.get("provenance_source"),
                        )
                    )
                if len(validated_stops) >= target_count:
                    break

        title = data.get("title") or "Персональный маршрут по Пушкинскому музею"
        intro = data.get("intro") or "Индивидуальный маршрут, собранный под ваши предпочтения."

        return RouteGenerateResponse(
            route_id=f"route-{uuid.uuid4().hex[:8]}",
            title=title,
            intro=intro,
            duration_minutes=request.duration_minutes,
            is_fallback=False,
            stops=validated_stops,
        )

    except Exception as exc:
        logger.warning("Error generating route via Yandex AI Studio: %s. Falling back to curated route.", exc)
        return build_fallback_route(request, target_count, reason=f"AI Studio error: {type(exc).__name__}")
