import hashlib
import json
from pathlib import Path
import subprocess
import sys

import pytest

from scripts import prepare_museum_data
from app.data.exhibits import (
    PROCESSED_DIR,
    clear_catalog_cache,
    get_all_buildings,
    get_all_exhibits,
    get_exhibit_by_id,
    get_hall_by_id,
    get_route_candidates,
)
from scripts.prepare_museum_data import clean_html, normalize_flag


BACKEND_DIR = Path(__file__).resolve().parents[1]
REPOSITORY_ROOT = BACKEND_DIR.parent


def test_prepared_json_is_valid_and_exhibit_ids_are_unique_strings():
    exhibits = json.loads((PROCESSED_DIR / "exhibits.json").read_text(encoding="utf-8"))
    buildings = json.loads((PROCESSED_DIR / "buildings.json").read_text(encoding="utf-8"))
    halls = json.loads((PROCESSED_DIR / "halls.json").read_text(encoding="utf-8"))
    report = json.loads((PROCESSED_DIR / "import_report.json").read_text(encoding="utf-8"))

    exhibit_ids = [item["id"] for item in exhibits]
    assert all(isinstance(exhibit_id, str) for exhibit_id in exhibit_ids)
    assert len(exhibit_ids) == len(set(exhibit_ids))
    assert len(buildings) == report["counts"]["buildings"]
    assert len(halls) == report["counts"]["halls"]
    assert report["counts"]["masterpieces"] == len(exhibits) == 97
    assert report["counts"]["collects"] == 0


def test_route_eligibility_and_hall_relationships_are_consistent():
    buildings = {item["id"]: item for item in get_all_buildings()}
    for exhibit in get_all_exhibits():
        if exhibit["route_eligible"]:
            building = buildings[exhibit["building_id"]]
            hall = get_hall_by_id(exhibit["building_id"], exhibit["hall_id"])
            assert exhibit["title"]
            assert exhibit["show_in_hall"] is True
            assert building["closed"] is False
            assert hall is not None
            assert hall["building_id"] == exhibit["building_id"]
    assert len(get_route_candidates("116")) == 27


def test_museum_hall_id_is_not_exposed_as_the_visitor_hall_number():
    exhibit = get_exhibit_by_id("3687")
    assert exhibit is not None
    assert exhibit["building_id"] == "116"
    assert exhibit["hall_id"] == "191"
    hall = get_hall_by_id("116", "191")
    assert hall == {
        "id": "191",
        "building_id": "116",
        "building_name": "Главное здание",
        "floor_id": "126",
        "floor_number": "1",
        "number": "6",
        "name": "Эллинистический и римский Египет. Коптское искусство",
        "floor_plan_url": "https://pushkinmuseum.art/json/svg/main_1floor.svg",
    }


def test_catalog_loader_caches_records_and_preserves_negative_years():
    clear_catalog_cache()
    exhibit = get_exhibit_by_id(3675)
    assert exhibit is not None
    assert exhibit["year"] == -1450
    assert exhibit["authors"] == []
    assert get_exhibit_by_id("missing") is None


def test_flag_normalization_and_html_cleanup_handle_source_variants():
    assert normalize_flag("1") is True
    assert normalize_flag(1) is True
    assert normalize_flag("0") is False
    assert normalize_flag(0) is False
    assert normalize_flag("") is None
    assert clean_html("<p>А &nbsp;Б &ndash; В</p><p><b>Текст</b></p>") == "А Б – В\n\nТекст"


def test_museum_text_excerpts_are_within_usage_limit():
    for exhibit in get_all_exhibits():
        assert len(exhibit["description"]) + len(exhibit["annotation"]) <= 500
        if exhibit["description"] or exhibit["annotation"]:
            assert exhibit["source_url"].startswith("https://pushkinmuseum.art/")


def test_offline_preparation_is_repeatable_from_an_unrelated_working_directory(tmp_path):
    before = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in PROCESSED_DIR.glob("*.json")
    }
    result = subprocess.run(
        [sys.executable, str(REPOSITORY_ROOT / "backend/scripts/prepare_museum_data.py")],
        cwd=tmp_path,
        check=True,
        capture_output=True,
        text=True,
    )
    after = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in PROCESSED_DIR.glob("*.json")
    }
    assert before == after
    assert "97 exhibits" in result.stdout


def test_failed_update_does_not_replace_raw_or_processed_files(monkeypatch):
    raw_before = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (REPOSITORY_ROOT / "data/raw").glob("*.json")
    }
    processed_before = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in PROCESSED_DIR.glob("*.json")
    }
    raw = {name: (REPOSITORY_ROOT / "data/raw" / f"{name}.json").read_bytes() for name in prepare_museum_data.SOURCES}
    metadata = json.loads((REPOSITORY_ROOT / "data/raw/source_manifest.json").read_text(encoding="utf-8"))["sources"]
    monkeypatch.setattr(prepare_museum_data, "_download_sources", lambda: (raw, metadata))

    def invalid_transform(*args, **kwargs):
        raise ValueError("simulated invalid downloaded source")

    monkeypatch.setattr(prepare_museum_data, "prepare_data", invalid_transform)
    monkeypatch.setattr(sys, "argv", ["prepare_museum_data.py", "--update"])
    with pytest.raises(ValueError, match="simulated invalid"):
        prepare_museum_data.main()

    raw_after = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in (REPOSITORY_ROOT / "data/raw").glob("*.json")
    }
    processed_after = {
        path.name: hashlib.sha256(path.read_bytes()).hexdigest()
        for path in PROCESSED_DIR.glob("*.json")
    }
    assert raw_before == raw_after
    assert processed_before == processed_after
