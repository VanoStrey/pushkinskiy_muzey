"""Idempotent importer for official Pushkin Museum routes and audio guides."""

import logging
from typing import Any

import ydb
from app.data.exhibits import get_all_exhibits, get_exhibit_by_id
from app.repositories import official_routes_repo
from app.schemas.official_route import OfficialRoute, OfficialRouteStop
from app.services.route_normalizer import (
    compute_sequence_hash,
    compute_set_hash,
    normalize_text,
    normalize_url,
)

logger = logging.getLogger("app.services.official_routes_importer")


def _match_catalog_exhibit(raw_stop: dict[str, Any]) -> dict[str, Any] | None:
    """Resolve a legacy slug only when museum title and author identify one real record."""
    title = normalize_text(str(raw_stop.get("title") or ""))
    artist = normalize_text(str(raw_stop.get("artist") or ""))
    legacy_id = raw_stop.get("exhibit_id")
    by_id = get_exhibit_by_id(legacy_id) if legacy_id else None
    if by_id:
        authors = [normalize_text(str(author)) for author in by_id.get("authors", [])]
        if normalize_text(str(by_id.get("title") or "")) == title and (not artist or artist in authors):
            return by_id

    matches = []
    for exhibit in get_all_exhibits():
        if normalize_text(str(exhibit.get("title") or "")) != title:
            continue
        authors = [normalize_text(str(author)) for author in exhibit.get("authors", [])]
        if artist and artist not in authors:
            continue
        matches.append(exhibit)
    return matches[0] if len(matches) == 1 else None

# Curated snapshot of official museum routes discovered on pushkinmuseum.art/media/guides,
# tmatic.travel and ar.culture.ru
OFFICIAL_ROUTES_RAW_DATA: list[dict[str, Any]] = [
    {
        "id": "official-impressionism-pushkin",
        "title": "Импрессионизм из коллекции Пушкинского музея",
        "description": "Официальный тематический аудиогид по залам французского импрессионизма и постимпрессионизма в Галерее искусства стран Европы и Америки XIX–XX веков.",
        "source_url": "https://pushkinmuseum.art/media/guides/index.php?lang=ru",
        "source_name": "pushkinmuseum.art / tmatic.travel",
        "collected_at": "2026-10-03T12:00:00Z",
        "verification_status": "verified",
        "stops": [
            {
                "position": 1,
                "title": "Бульвар Капуцинок в Париже",
                "artist": "Клод Моне",
                "date": "1873",
                "hall": "Зал 8",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "monet-boulevard-des-capucines",
            },
            {
                "position": 2,
                "title": "Голубые танцовщицы",
                "artist": "Эдгар Дега",
                "date": "Около 1897",
                "hall": "Зал 9",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "degas-blue-dancers",
            },
            {
                "position": 3,
                "title": "Белые кувшинки",
                "artist": "Клод Моне",
                "date": "1899",
                "hall": "Зал 8",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "monet-white-waterlilies",
            },
            {
                "position": 4,
                "title": "Пьеро и Арлекин (Масленица)",
                "artist": "Поль Сезанн",
                "date": "1888",
                "hall": "Зал 14",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "cezanne-pierrot-harlequin",
            },
            {
                "position": 5,
                "title": "Красные виноградники в Арле. Монмажур",
                "artist": "Винсент Ван Гог",
                "date": "1888",
                "hall": "Зал 11",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "van-gogh-red-vineyards",
            },
            {
                "position": 6,
                "title": "А, ты ревнуешь? (Aha oe feii?)",
                "artist": "Поль Гоген",
                "date": "1892",
                "hall": "Зал 12",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "gauguin-aha-oe-feii",
            },
        ],
    },
    {
        "id": "official-main-building-masterpieces",
        "title": "Шедевры Главного здания: от древности к Ренессансу",
        "description": "Обзорный экскурсионный маршрут по ключевым залам Главного здания музея на Волхонке 12: Древний Египет, Античность, Нидерланды и Ренессанс.",
        "source_url": "https://pushkinmuseum.art/media/guides/index.php?lang=ru",
        "source_name": "pushkinmuseum.art / tmatic.travel",
        "collected_at": "2026-10-03T12:00:00Z",
        "verification_status": "verified",
        "stops": [
            {
                "position": 1,
                "title": "Туалетная ложечка в виде плывущей девушки с цветком лотоса",
                "artist": "Древнеегипетский мастер",
                "date": "XIV в. до н.э.",
                "hall": "Зал 1",
                "building": "Главное здание",
                "exhibit_id": "egyptian-swimming-girl-spoon",
            },
            {
                "position": 2,
                "title": "Портрет юноши в золотом венке (Фаюмский портрет)",
                "artist": "Мастер эллинистического Египта",
                "date": "I–II в. н.э.",
                "hall": "Зал 3",
                "building": "Главное здание",
                "exhibit_id": "fayum-portrait-youth",
            },
            {
                "position": 3,
                "title": "Золотой век",
                "artist": "Лукас Кранах Старший",
                "date": "Около 1530",
                "hall": "Зал 8",
                "building": "Главное здание",
                "exhibit_id": "cranach-golden-age",
            },
            {
                "position": 4,
                "title": "Артаксеркс, Аман и Эсфирь",
                "artist": "Рембрандт Харменс ван Рейн",
                "date": "1660",
                "hall": "Зал 10",
                "building": "Главное здание",
                "exhibit_id": "rembrandt-ahasuerus-haman",
            },
            {
                "position": 5,
                "title": "Статуя Давида (Точный слепок Микеланджело)",
                "artist": "Микеланджело Буонарроти",
                "date": "1501–1504",
                "hall": "Зал 15 (Итальянский дворик)",
                "building": "Главное здание",
                "exhibit_id": "michelangelo-david-cast",
            },
        ],
    },
    {
        "id": "official-artefact-masterpieces-xix-xx",
        "title": "Как устроены шедевры XIX-XX веков",
        "description": "Большой мультимедийный путеводитель платформы ARTEFACT с дополненной реальностью по Галерее искусства стран Европы и Америки XIX–XX веков.",
        "source_url": "https://ar.culture.ru/ru/exhibition/kak-ustroeny-shedevry-xix-xx-vekov",
        "source_name": "ar.culture.ru / ARTEFACT",
        "collected_at": "2026-10-03T12:00:00Z",
        "verification_status": "verified",
        "stops": [
            {
                "position": 1,
                "title": "Бульвар Капуцинок в Париже",
                "artist": "Клод Моне",
                "date": "1873",
                "hall": "Зал 8",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "monet-boulevard-des-capucines",
            },
            {
                "position": 2,
                "title": "Голубые танцовщицы",
                "artist": "Эдгар Дега",
                "date": "Около 1897",
                "hall": "Зал 9",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "degas-blue-dancers",
            },
            {
                "position": 3,
                "title": "Красные виноградники в Арле",
                "artist": "Винсент Ван Гог",
                "date": "1888",
                "hall": "Зал 11",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "van-gogh-red-vineyards",
            },
            {
                "position": 4,
                "title": "А, ты ревнуешь?",
                "artist": "Поль Гоген",
                "date": "1892",
                "hall": "Зал 12",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "gauguin-aha-oe-feii",
            },
            {
                "position": 5,
                "title": "Девочка на шаре",
                "artist": "Пабло Пикассо",
                "date": "1905",
                "hall": "Зал 17",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "picasso-girl-on-ball",
            },
        ],
    },
    {
        "id": "official-seven-museum-kings-quest",
        "title": "Аудиогид-квест для детей: Семь музейных королей",
        "description": "Интерактивный познавательный маршрут-квест по Главному зданию музея, знакомящий юных посетителей с правителями и героями древних царств.",
        "source_url": "https://tmatic.travel/ru/view/activity/kvest-sem-muzejnykh-korolej_V8fX8lu/ru/stories",
        "source_name": "tmatic.travel / pushkinmuseum.art",
        "collected_at": "2026-10-03T12:00:00Z",
        "verification_status": "verified",
        "stops": [
            {
                "position": 1,
                "title": "Косметическая ложечка в виде девушки (Эпоха фараонов)",
                "artist": "Древний Египет",
                "date": "XIV в. до н.э.",
                "hall": "Зал 1",
                "building": "Главное здание",
                "exhibit_id": "egyptian-swimming-girl-spoon",
            },
            {
                "position": 2,
                "title": "Фаюмский юноша в венке",
                "artist": "Античный мастер",
                "date": "I–II в. н.э.",
                "hall": "Зал 3",
                "building": "Главное здание",
                "exhibit_id": "fayum-portrait-youth",
            },
            {
                "position": 3,
                "title": "Статуя Давида — царь Давид",
                "artist": "Микеланджело Буонарроти",
                "date": "1501–1504",
                "hall": "Зал 15",
                "building": "Главное здание",
                "exhibit_id": "michelangelo-david-cast",
            },
            {
                "position": 4,
                "title": "Царь Артаксеркс на пиру у Эсфири",
                "artist": "Рембрандт",
                "date": "1660",
                "hall": "Зал 10",
                "building": "Главное здание",
                "exhibit_id": "rembrandt-ahasuerus-haman",
            },
            {
                "position": 5,
                "title": "Золотой век — гармония природы",
                "artist": "Лукас Кранах Старший",
                "date": "Около 1530",
                "hall": "Зал 8",
                "building": "Главное здание",
                "exhibit_id": "cranach-golden-age",
            },
        ],
    },
    {
        "id": "official-picasso-masterpieces",
        "title": "Творчество Пабло Пикассо",
        "description": "Монографический аудиогид по произведениям Пабло Пикассо в залах Галереи искусства стран Европы и Америки XIX–XX веков.",
        "source_url": "https://tmatic.travel/ru/view/activity/3-tvorcestvo-pablo-pikasso_tPHO1nC/ru/stories",
        "source_name": "tmatic.travel / pushkinmuseum.art",
        "collected_at": "2026-10-03T12:00:00Z",
        "verification_status": "partial",
        "stops": [
            {
                "position": 1,
                "title": "Девочка на шаре",
                "artist": "Пабло Пикассо",
                "date": "1905",
                "hall": "Зал 17",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": "picasso-girl-on-ball",
            },
            {
                "position": 2,
                "title": "Старый еврей с мальчиком",
                "artist": "Пабло Пикассо",
                "date": "1903",
                "hall": "Зал 17",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": None,  # Not in core MVP exhibits catalog, marks partial coverage
            },
            {
                "position": 3,
                "title": "Портрет Амбруаза Воллара",
                "artist": "Пабло Пикассо",
                "date": "1910",
                "hall": "Зал 18",
                "building": "Галерея XIX–XX вв.",
                "exhibit_id": None,
            },
        ],
    },
]


def build_normalized_official_route(raw_route: dict[str, Any]) -> OfficialRoute:
    """Normalize and validate raw official route data into OfficialRoute schema."""
    norm_id = normalize_text(raw_route["id"]).replace(" ", "-")
    norm_title = normalize_text(raw_route["title"])
    norm_desc = raw_route.get("description", "").strip()
    norm_url = normalize_url(raw_route["source_url"])
    source_name = raw_route.get("source_name", "pushkinmuseum.art")
    collected_at = raw_route.get("collected_at", "2026-10-03T12:00:00Z")

    stops: list[OfficialRouteStop] = []
    exhibit_ids: list[str] = []
    matched_exhibit_count = 0

    for raw_stop in raw_route.get("stops", []):
        verified_item = _match_catalog_exhibit(raw_stop)

        if verified_item:
            matched_exhibit_count += 1
            resolved_id = verified_item["id"]
            exhibit_ids.append(resolved_id)
        else:
            # Do not retain obsolete slugs as if they were museum catalog IDs.
            resolved_id = None

        stops.append(
            OfficialRouteStop(
                position=raw_stop.get("position", len(stops) + 1),
                title=raw_stop.get("title", ""),
                artist=raw_stop.get("artist"),
                date=raw_stop.get("date"),
                hall=raw_stop.get("hall"),
                building=raw_stop.get("building"),
                exhibit_id=resolved_id,
            )
        )

    # Compute deterministic hashes
    seq_hash = compute_sequence_hash(exhibit_ids)
    set_hash = compute_set_hash(exhibit_ids)

    # Calculate completeness score based on verified exhibit matching and stop metadata
    total_stops = max(len(stops), 1)
    completeness = round(matched_exhibit_count / total_stops, 2)
    if matched_exhibit_count == total_stops and total_stops:
        verification_status = "verified"
    elif matched_exhibit_count:
        verification_status = "partial"
    else:
        verification_status = "unverified"

    return OfficialRoute(
        id=norm_id,
        title=norm_title,
        description=norm_desc,
        source_url=norm_url,
        source_name=source_name,
        collected_at=collected_at,
        sequence_hash=seq_hash,
        set_hash=set_hash,
        exhibit_ids=exhibit_ids,
        stops=stops,
        verification_status=verification_status,
        completeness_score=completeness,
    )


def import_official_routes(
    pool: ydb.QuerySessionPool | None = None,
    raw_data: list[dict[str, Any]] | None = None,
) -> list[OfficialRoute]:
    """Idempotently import official museum routes into YDB and memory repository.

    Running this function multiple times produces the exact same records without duplicates.
    """
    data_to_import = raw_data if raw_data is not None else OFFICIAL_ROUTES_RAW_DATA
    imported_routes: list[OfficialRoute] = []

    if pool is not None:
        official_routes_repo.init_routes_table(pool)

    for item in data_to_import:
        route = build_normalized_official_route(item)
        official_routes_repo.upsert_route(pool, route)
        imported_routes.append(route)
        logger.info(
            "Imported official route: id=%s title=%s stops=%d verified_exhibits=%d",
            route.id,
            route.title,
            len(route.stops),
            len(route.exhibit_ids),
        )

    return imported_routes
