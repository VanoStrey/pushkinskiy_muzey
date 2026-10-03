"""Service for comparing generated museum routes against official catalog to verify uniqueness."""

import logging
from typing import Any

import ydb
from app.config import settings
from app.repositories import official_routes_repo
from app.schemas.official_route import OfficialRoute, UniquenessCheckResponse
from app.services.route_normalizer import (
    compute_jaccard_similarity,
    compute_sequence_hash,
    compute_set_hash,
    compute_title_similarity,
    normalize_exhibit_id,
    normalize_text,
)

logger = logging.getLogger("app.services.uniqueness_checker")


def check_route_uniqueness(
    new_exhibit_ids: list[str],
    new_title: str = "",
    pool: ydb.QuerySessionPool | None = None,
    official_routes: list[OfficialRoute] | None = None,
    custom_threshold: float | None = None,
) -> UniquenessCheckResponse:
    """Compare a new route against all official museum routes to detect duplicates or heavy overlap.

    Evaluation checks in order:
    1. Exact ordered sequence match (hash match, score 1.0)
    2. Permutation match (same set in different order, score 1.0)
    3. Significant exhibit set overlap (Jaccard or coverage >= threshold)
    4. Title / theme collision with exhibit overlap (title similarity >= 0.65)
    5. Unique route
    """
    clean_new_ids = [normalize_exhibit_id(e) for e in new_exhibit_ids if e and e.strip()]
    new_set = set(clean_new_ids)
    threshold = custom_threshold if custom_threshold is not None else settings.route_overlap_threshold

    # Get routes from database/memory or passed explicitly
    routes = official_routes if official_routes is not None else official_routes_repo.get_all_routes(pool)

    # Edge case: empty official catalog
    if not routes or not clean_new_ids:
        return UniquenessCheckResponse(
            is_unique=True,
            match_kind="unique",
            similarity_score=0.0,
            matched_official_route_id=None,
            matched_official_route_title=None,
            overlapping_exhibits=[],
            explanation="Официальный каталог пуст либо список экспонатов не передан; маршрут признан уникальным.",
        )

    new_seq_hash = compute_sequence_hash(clean_new_ids)
    new_set_hash = compute_set_hash(clean_new_ids)
    normalized_new_title = normalize_text(new_title)

    highest_similarity = 0.0
    best_candidate_explanation = "Маршрут оригинален и не повторяет официальные программы музея."

    for off in routes:
        off_ids = [normalize_exhibit_id(e) for e in off.exhibit_ids if e and e.strip()]
        off_set = set(off_ids)
        intersection = new_set.intersection(off_set)
        overlapping_list = sorted(intersection)

        # 1. Exact ordered sequence match
        if new_seq_hash == off.sequence_hash and len(clean_new_ids) == len(off_ids):
            return UniquenessCheckResponse(
                is_unique=False,
                match_kind="exact_sequence",
                similarity_score=1.0,
                matched_official_route_id=off.id,
                matched_official_route_title=off.title,
                overlapping_exhibits=overlapping_list,
                explanation=(
                    f"Маршрут полностью дублирует последовательность официальной программы "
                    f"«{off.title}» (100% совпадение залов)."
                ),
            )

        # 2. Permutation match (same set, different order)
        if new_set_hash == off.set_hash and len(new_set) == len(off_set) and len(new_set) > 0:
            return UniquenessCheckResponse(
                is_unique=False,
                match_kind="permutation",
                similarity_score=1.0,
                matched_official_route_id=off.id,
                matched_official_route_title=off.title,
                overlapping_exhibits=overlapping_list,
                explanation=(
                    f"Маршрут содержит ровно тот же набор экспонатов, что и официальный гид "
                    f"«{off.title}», но в другом порядке обхода."
                ),
            )

        # 3. Significant overlap calculation
        jaccard = compute_jaccard_similarity(new_set, off_set)
        coverage_new = len(intersection) / len(new_set) if new_set else 0.0
        overlap_score = max(jaccard, coverage_new)

        if overlap_score > highest_similarity:
            highest_similarity = overlap_score

        if overlap_score >= threshold:
            pct = int(overlap_score * 100)
            return UniquenessCheckResponse(
                is_unique=False,
                match_kind="significant_overlap",
                similarity_score=round(overlap_score, 2),
                matched_official_route_id=off.id,
                matched_official_route_title=off.title,
                overlapping_exhibits=overlapping_list,
                explanation=(
                    f"Маршрут существенно пересекается ({pct}%) с официальной программой "
                    f"«{off.title}». Пересекающиеся экспонаты: {', '.join(overlapping_list)}."
                ),
            )

        # 4. Title & theme similarity collision
        if normalized_new_title:
            title_sim = compute_title_similarity(normalized_new_title, off.title)
            if title_sim >= 0.65 and len(intersection) >= 1:
                return UniquenessCheckResponse(
                    is_unique=False,
                    match_kind="title_theme_similarity",
                    similarity_score=round(title_sim, 2),
                    matched_official_route_id=off.id,
                    matched_official_route_title=off.title,
                    overlapping_exhibits=overlapping_list,
                    explanation=(
                        f"Название и концепция маршрута созвучны официальной программе «{off.title}» "
                        f"(сходство названий: {int(title_sim * 100)}%), при наличии общих экспонатов."
                    ),
                )

    return UniquenessCheckResponse(
        is_unique=True,
        match_kind="unique",
        similarity_score=round(highest_similarity, 2),
        matched_official_route_id=None,
        matched_official_route_title=None,
        overlapping_exhibits=[],
        explanation=best_candidate_explanation,
    )
