"""Comprehensive tests for official routes import, normalization, and uniqueness checking."""

from fastapi.testclient import TestClient

from app.main import app as fastapi_app
from app.repositories import official_routes_repo
from app.schemas.official_route import OfficialRoute
from app.services.official_routes_importer import (
    OFFICIAL_ROUTES_RAW_DATA,
    import_official_routes,
)
from app.services.route_normalizer import (
    compute_sequence_hash,
    compute_set_hash,
    normalize_text,
    normalize_url,
)
from app.services.uniqueness_checker import check_route_uniqueness

client = TestClient(fastapi_app)


def setup_function():
    """Reset repository before each test."""
    official_routes_repo.clear_memory_store_for_tests()


# 1. Tests on Normalization & Hashing
def test_text_and_url_normalization():
    assert normalize_text("  «Шедевры   Главного   Здания»  ") == '"шедевры главного здания"'
    assert normalize_text("Импрессионизм — эпоха света") == "импрессионизм - эпоха света"
    assert normalize_url("https://PushkinMuseum.art/media/guides/?utm_source=test#frag") == "https://pushkinmuseum.art/media/guides"


def test_hash_properties():
    seq1 = ["monet-white-waterlilies", "degas-blue-dancers"]
    seq2 = ["degas-blue-dancers", "monet-white-waterlilies"]

    # Sequence hashes differ for different orders
    assert compute_sequence_hash(seq1) != compute_sequence_hash(seq2)
    # Set hashes are identical regardless of order
    assert compute_set_hash(seq1) == compute_set_hash(seq2)


# 2. Tests on Idempotency of Importer
def test_idempotent_import():
    # First import
    routes_first = import_official_routes()
    assert len(routes_first) == len(OFFICIAL_ROUTES_RAW_DATA)
    first_ids = [r.id for r in routes_first]

    # Second import (must not duplicate or crash)
    routes_second = import_official_routes()
    assert len(routes_second) == len(OFFICIAL_ROUTES_RAW_DATA)
    second_ids = [r.id for r in routes_second]

    assert first_ids == second_ids
    # Storage should contain exact count, no duplicates
    stored = official_routes_repo.get_all_routes(None)
    assert len(stored) == len(OFFICIAL_ROUTES_RAW_DATA)


# 3. Tests on Uniqueness Comparison

def test_exact_sequence_match():
    routes = import_official_routes()
    impressionism_route = next(r for r in routes if r.id == "official-impressionism-pushkin")

    # Identical sequence of exhibit IDs
    result = check_route_uniqueness(
        new_exhibit_ids=impressionism_route.exhibit_ids,
        new_title="Мой новый маршрут",
        official_routes=routes,
    )

    assert result.is_unique is False
    assert result.match_kind == "exact_sequence"
    assert result.similarity_score == 1.0
    assert result.matched_official_route_id == "official-impressionism-pushkin"
    assert len(result.overlapping_exhibits) == len(impressionism_route.exhibit_ids)


def test_permutation_match():
    routes = import_official_routes()
    impressionism_route = next(r for r in routes if r.id == "official-impressionism-pushkin")

    # Reversed order of the exact same exhibits
    reversed_ids = list(reversed(impressionism_route.exhibit_ids))

    result = check_route_uniqueness(
        new_exhibit_ids=reversed_ids,
        new_title="Импрессионисты наоборот",
        official_routes=routes,
    )

    assert result.is_unique is False
    assert result.match_kind == "permutation"
    assert result.similarity_score == 1.0
    assert result.matched_official_route_id == "official-impressionism-pushkin"
    assert len(result.overlapping_exhibits) == len(impressionism_route.exhibit_ids)


def test_significant_overlap():
    routes = import_official_routes()
    impressionism_route = next(r for r in routes if r.id == "official-impressionism-pushkin")

    # 4 exhibits from impressionism official route (which has 6 exhibits) + 1 new exhibit
    # Overlap = 4 / 5 = 80% >= 50% threshold
    partially_overlapping_ids = impressionism_route.exhibit_ids[:4] + ["rembrandt-ahasuerus-haman"]

    result = check_route_uniqueness(
        new_exhibit_ids=partially_overlapping_ids,
        new_title="Свет и краски",
        official_routes=routes,
        custom_threshold=0.5,
    )

    assert result.is_unique is False
    assert result.match_kind == "significant_overlap"
    assert result.similarity_score >= 0.5
    assert result.matched_official_route_id == "official-impressionism-pushkin"
    assert len(result.overlapping_exhibits) == 4


def test_title_theme_similarity():
    test_official = OfficialRoute(
        id="official-test-monet",
        title="Мир Клода Моне и водяные лилии",
        description="Гид по саду Моне в Живерни",
        source_url="https://pushkinmuseum.art/test",
        source_name="pushkin",
        collected_at="2026-10-03T12:00:00Z",
        sequence_hash="dummy1",
        set_hash="dummy2",
        exhibit_ids=["monet-white-waterlilies", "degas-blue-dancers", "gauguin-aha-oe-feii"],
        stops=[],
        verification_status="verified",
        completeness_score=1.0,
    )

    # 1 common exhibit, strong title overlap with stemmed words
    new_ids = ["monet-white-waterlilies", "van-gogh-red-vineyards", "picasso-girl-on-ball", "cranach-golden-age"]
    new_title = "Клод Моне: водяные лилии и тайны сада"

    result = check_route_uniqueness(
        new_exhibit_ids=new_ids,
        new_title=new_title,
        official_routes=[test_official],
        custom_threshold=0.5,
    )

    assert result.is_unique is False
    assert result.match_kind == "title_theme_similarity"
    assert result.similarity_score >= 0.65
    assert result.matched_official_route_id == "official-test-monet"


def test_unique_route():
    routes = import_official_routes()

    # Carefully selected mix across different galleries ensuring max overlap <= 33% < 50%
    distinct_ids = [
        "cezanne-pierrot-harlequin",  # Impressionism only
        "fayum-portrait-youth",       # Main Building only
        "picasso-girl-on-ball",       # Artefact / Picasso only
    ]

    result = check_route_uniqueness(
        new_exhibit_ids=distinct_ids,
        new_title="Диалоги эпох через тысячелетия",
        official_routes=routes,
        custom_threshold=0.5,
    )

    assert result.is_unique is True
    assert result.match_kind == "unique"
    assert result.matched_official_route_id is None


def test_empty_catalog():
    result = check_route_uniqueness(
        new_exhibit_ids=["van-gogh-red-vineyards", "monet-white-waterlilies"],
        new_title="Тестовый маршрут",
        official_routes=[],
    )
    assert result.is_unique is True
    assert result.match_kind == "unique"
    assert result.similarity_score == 0.0


def test_unknown_or_missing_exhibit_ids():
    routes = import_official_routes()

    # Pass unknown IDs and empty strings
    result = check_route_uniqueness(
        new_exhibit_ids=["unknown-exhibit-1", "", "   ", "unknown-exhibit-2"],
        new_title="Абсолютно неизвестные экспонаты",
        official_routes=routes,
    )
    assert result.is_unique is True
    assert result.match_kind == "unique"


# 4. API Endpoints Tests
def test_api_list_official_routes():
    response = client.get("/api/routes/official")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
    assert any(r["id"] == "official-impressionism-pushkin" for r in data)


def test_api_check_uniqueness_endpoint():
    routes = import_official_routes()
    imp_ids = next(r.exhibit_ids for r in routes if r.id == "official-impressionism-pushkin")

    response = client.post(
        "/api/routes/check-uniqueness",
        json={
            "exhibit_ids": imp_ids,
            "title": "Проверка дубликата",
        },
    )
    assert response.status_code == 200
    res = response.json()
    assert res["is_unique"] is False
    assert res["match_kind"] == "exact_sequence"


def test_api_import_endpoint():
    response = client.post("/api/routes/import-official")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 5
