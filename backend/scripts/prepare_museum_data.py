#!/usr/bin/env python3
"""Prepare the official Pushkin Museum JSON catalog for the application.

Run from any working directory:
    python backend/scripts/prepare_museum_data.py
    python backend/scripts/prepare_museum_data.py --update

The default mode is fully offline. --update downloads all source files first,
validates and transforms them, then replaces the raw and processed directories.
"""

from __future__ import annotations

import argparse
import hashlib
import html
from html.parser import HTMLParser
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urljoin


ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
PROCESSED_DIR = ROOT / "backend" / "app" / "data" / "processed"
BASE_URL = "https://pushkinmuseum.art/"
SOURCES = {
    "masterpieces": "https://pushkinmuseum.art/json/masterpieces.json",
    "buildings": "https://pushkinmuseum.art/json/buildings.json",
    "collects": "https://pushkinmuseum.art/json/collects.json",
}
TEXT_LIMIT = 500


class DuplicateKeyError(ValueError):
    pass


def _unique_object(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise DuplicateKeyError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def parse_source(raw: bytes, name: str) -> dict[str, Any]:
    try:
        value = json.loads(raw.decode("utf-8-sig"), object_pairs_hook=_unique_object)
    except (UnicodeDecodeError, json.JSONDecodeError, DuplicateKeyError) as exc:
        raise ValueError(f"{name} is not valid UTF-8 JSON: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError(f"{name} must be a JSON object")
    return value


def _download_sources() -> tuple[dict[str, bytes], dict[str, dict[str, Any]]]:
    raw_by_name: dict[str, bytes] = {}
    fetched_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    metadata: dict[str, dict[str, Any]] = {}
    with tempfile.TemporaryDirectory(prefix="pushkin-museum-download-") as temp_dir:
        for name, url in SOURCES.items():
            path = Path(temp_dir) / f"{name}.json"
            result = subprocess.run(
                [
                    "curl",
                    "--fail",
                    "--location",
                    "--silent",
                    "--show-error",
                    "--max-time",
                    "60",
                    "--output",
                    str(path),
                    url,
                ],
                check=False,
                capture_output=True,
                text=True,
                timeout=70,
            )
            if result.returncode != 0:
                detail = result.stderr.strip() or f"curl exited with {result.returncode}"
                raise RuntimeError(f"Could not download {url}: {detail}")
            raw = path.read_bytes()
            parse_source(raw, f"downloaded {name}.json")
            raw_by_name[name] = raw
            metadata[name] = {
                "url": url,
                "fetched_at": fetched_at,
                "size_bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
            }
    return raw_by_name, metadata


def _string(value: Any) -> str | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, str):
        result = value.strip()
        return result or None
    if isinstance(value, (int, float)):
        return str(value)
    return None


def _localized(value: Any) -> str | None:
    if isinstance(value, dict):
        return _string(value.get("ru"))
    return _string(value)


def normalize_flag(value: Any) -> bool | None:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if value == 1:
            return True
        if value == 0:
            return False
        return None
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"1", "true", "yes", "да"}:
            return True
        if normalized in {"0", "false", "no", "нет"}:
            return False
    return None


class _PlainTextParser(HTMLParser):
    _BLOCK_TAGS = {
        "address", "article", "blockquote", "br", "div", "h1", "h2", "h3", "h4", "h5", "h6",
        "li", "ol", "p", "pre", "section", "table", "tr", "ul",
    }

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._suppressed = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        del attrs
        if tag in {"script", "style"}:
            self._suppressed += 1
        elif not self._suppressed and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"} and self._suppressed:
            self._suppressed -= 1
        elif not self._suppressed and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._suppressed:
            self.parts.append(data)


def clean_html(value: Any) -> str:
    source = _string(value)
    if source is None:
        return ""
    parser = _PlainTextParser()
    parser.feed(source)
    parser.close()
    text = html.unescape("".join(parser.parts)).replace("\xa0", " ")
    text = re.sub(r"[\t\r\f\v ]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _limited_texts(description: Any, annotation: Any) -> tuple[str, str]:
    """Keep museum-authored excerpts within the published 500-character limit."""
    description_text = clean_html(description)
    annotation_text = clean_html(annotation)
    if len(description_text) > TEXT_LIMIT:
        description_text = description_text[: TEXT_LIMIT - 1].rstrip() + "…"
        return description_text, ""
    remaining = TEXT_LIMIT - len(description_text)
    if len(annotation_text) > remaining:
        if remaining <= 0:
            annotation_text = ""
        elif remaining == 1:
            annotation_text = "…"
        else:
            annotation_text = annotation_text[: remaining - 1].rstrip() + "…"
    return description_text, annotation_text


def _sorted_keys(mapping: dict[str, Any]) -> list[str]:
    return sorted(mapping, key=lambda value: (0, int(value)) if value.isdigit() else (1, value))


def _authors(value: Any) -> list[str]:
    if isinstance(value, str) or value is None:
        return []
    if isinstance(value, dict) and "ru" in value:
        name = _localized(value)
        return [name] if name else []
    entries = value.values() if isinstance(value, dict) else value if isinstance(value, list) else []
    result: list[str] = []
    for entry in entries:
        name = _localized(entry)
        if name and name not in result:
            result.append(name)
    return result


def _urls_from_gallery(value: Any) -> list[str]:
    found: list[str] = []

    def visit(item: Any) -> None:
        if isinstance(item, dict):
            for key in _sorted_keys({str(k): v for k, v in item.items()}):
                visit(item[key] if key in item else item.get(key))
        elif isinstance(item, list):
            for child in item:
                visit(child)
        else:
            candidate = _string(item)
            if candidate and (candidate.startswith("/") or candidate.startswith("http://") or candidate.startswith("https://")):
                absolute = urljoin(BASE_URL, candidate)
                if absolute not in found:
                    found.append(absolute)

    visit(value)
    return found


def _source_url(value: Any) -> str | None:
    path = _string(value)
    return urljoin(BASE_URL, path) if path else None


def _items(mapping: dict[str, Any] | list[Any]) -> list[tuple[str, Any]]:
    if isinstance(mapping, dict):
        return [(key, mapping[key]) for key in _sorted_keys(mapping)]
    return [(str(index), value) for index, value in enumerate(mapping)]


def prepare_data(
    sources: dict[str, dict[str, Any]],
    source_metadata: dict[str, dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    raw_exhibits = sources["masterpieces"]
    raw_buildings = sources["buildings"]
    raw_collects = sources["collects"]
    if not any(key.isdigit() and isinstance(item, dict) for key, item in raw_exhibits.items()):
        raise ValueError("masterpieces.json contains no usable exhibit records")
    if not any(key.isdigit() and isinstance(item, dict) for key, item in raw_buildings.items()):
        raise ValueError("buildings.json contains no usable building records")

    buildings: list[dict[str, Any]] = []
    building_by_id: dict[str, dict[str, Any]] = {}
    halls: list[dict[str, Any]] = []
    halls_by_key: dict[tuple[str, str], dict[str, Any]] = {}
    malformed_buildings: list[str] = []
    malformed_floors = 0
    malformed_halls = 0

    for building_id, raw in _items(raw_buildings):
        if not isinstance(raw, dict):
            malformed_buildings.append(building_id)
            continue
        building_id = str(building_id)
        name = _localized(raw.get("name"))
        closed = normalize_flag(raw.get("closed"))
        building = {
            "id": building_id,
            "name": name,
            "source_url": _source_url(raw.get("path")),
            "closed": closed,
            "closed_source": raw.get("closed"),
        }
        buildings.append(building)
        building_by_id[building_id] = building

        floors = raw.get("floors")
        if floors is None or floors == "":
            continue
        if not isinstance(floors, (dict, list)):
            malformed_floors += 1
            continue
        for floor_id, floor in _items(floors):
            if not isinstance(floor, dict):
                malformed_floors += 1
                continue
            raw_halls = floor.get("halls")
            if raw_halls is None or raw_halls == "":
                continue
            if not isinstance(raw_halls, (dict, list)):
                malformed_halls += 1
                continue
            floor_plan_url = _source_url(floor.get("plan"))
            for hall_id, hall in _items(raw_halls):
                if not isinstance(hall, dict):
                    malformed_halls += 1
                    continue
                hall_id = str(hall_id)
                key = (building_id, hall_id)
                if key in halls_by_key:
                    raise ValueError(f"duplicate hall id {hall_id} in building {building_id}")
                normalized_hall = {
                    "id": hall_id,
                    "building_id": building_id,
                    "building_name": name,
                    "floor_id": str(floor_id),
                    "floor_number": _string(floor.get("number")),
                    "number": _string(hall.get("number")),
                    "name": _localized(hall.get("name")),
                    "floor_plan_url": floor_plan_url,
                }
                halls.append(normalized_hall)
                halls_by_key[key] = normalized_hall

    exhibits: list[dict[str, Any]] = []
    skipped_exhibits: list[dict[str, str]] = []
    unresolved_buildings: list[dict[str, str]] = []
    unresolved_halls: list[dict[str, str]] = []
    missing_locations: list[str] = []
    missing_titles: list[str] = []
    eligible_by_building: dict[str, int] = {}

    for exhibit_id, raw in _items(raw_exhibits):
        exhibit_id = str(exhibit_id)
        if not isinstance(raw, dict):
            skipped_exhibits.append({"id": exhibit_id, "reason": "record is not an object"})
            continue

        title = _localized(raw.get("name"))
        if not title:
            missing_titles.append(exhibit_id)
        description, annotation = _limited_texts(raw.get("text"), raw.get("annotation"))
        building_id = _string(raw.get("building"))
        hall_id = _string(raw.get("hall"))
        building = building_by_id.get(building_id or "")
        hall = halls_by_key.get((building_id or "", hall_id or ""))
        if building_id and building is None:
            unresolved_buildings.append({"exhibit_id": exhibit_id, "building_id": building_id})
        if building_id and hall_id and hall is None:
            unresolved_halls.append(
                {"exhibit_id": exhibit_id, "building_id": building_id, "hall_id": hall_id}
            )
        if not building_id or not hall_id:
            missing_locations.append(exhibit_id)
        show_in_hall = normalize_flag(raw.get("show_in_hall"))
        route_eligible = bool(
            title
            and building
            and hall
            and show_in_hall is True
            and building["closed"] is False
        )
        if route_eligible and building_id:
            eligible_by_building[building_id] = eligible_by_building.get(building_id, 0) + 1

        exhibit = {
            "id": exhibit_id,
            "inventory_number": _string(raw.get("inv_num")),
            "title": title,
            "authors": _authors(raw.get("authors")),
            "date_text": _localized((raw.get("period") or {}).get("text")) if isinstance(raw.get("period"), dict) else None,
            "year": raw.get("year"),
            "type": _localized(raw.get("type")),
            "country": _localized(raw.get("country")),
            "material": _localized(raw.get("material")),
            "description": description,
            "annotation": annotation,
            "building_id": building_id,
            "hall_id": hall_id,
            "image_urls": _urls_from_gallery(raw.get("gallery")),
            "source_url": _source_url(raw.get("path")),
            "show_in_hall": show_in_hall,
            "route_eligible": route_eligible,
        }
        exhibits.append(exhibit)

    source_counts = {
        "masterpieces": len(raw_exhibits),
        "buildings": len(raw_buildings),
        "collects": len(raw_collects),
        "halls": len(halls),
    }
    report = {
        "sources": source_metadata,
        "counts": {
            **source_counts,
            "processed_exhibits": len(exhibits),
            "skipped_exhibits": len(skipped_exhibits),
            "route_eligible_by_building": eligible_by_building,
            "route_eligible_main_building_116": eligible_by_building.get("116", 0),
        },
        "quality": {
            "malformed_building_ids": malformed_buildings,
            "malformed_floor_records": malformed_floors,
            "malformed_hall_records": malformed_halls,
            "skipped_exhibits": skipped_exhibits,
            "exhibits_missing_title": missing_titles,
            "exhibits_missing_building_or_hall": missing_locations,
            "unresolved_building_references": unresolved_buildings,
            "unresolved_hall_references": unresolved_halls,
        },
        "legacy_migration": {
            "mappings": {},
            "unmatched_records": [],
            "note": "The source repository did not contain a legacy exhibit catalog, prepared route data, or route importer.",
        },
        "availability_note": (
            "show_in_hall and building.closed reflect the downloaded source data and do not confirm real-time access. "
            "Hall numbers do not establish walking order or shortest paths."
        ),
        "usage_note": (
            "Museum-authored text excerpts are limited to 500 characters per exhibit and require attribution plus "
            "a direct source link. Image URLs are retained as references; the application does not embed images."
        ),
    }
    return {
        "exhibits.json": exhibits,
        "buildings.json": buildings,
        "halls.json": halls,
        "import_report.json": [report],
    }


def _write_json(path: Path, data: Any) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _replace_directory(staged: Path, destination: Path) -> None:
    backup = destination.with_name(f".{destination.name}.backup")
    if backup.exists():
        shutil.rmtree(backup)
    had_destination = destination.exists()
    if had_destination:
        os.replace(destination, backup)
    try:
        os.replace(staged, destination)
    except Exception:
        if had_destination and backup.exists() and not destination.exists():
            os.replace(backup, destination)
        raise
    else:
        if backup.exists():
            shutil.rmtree(backup)


def _write_processed(outputs: dict[str, list[dict[str, Any]]]) -> None:
    staged = PROCESSED_DIR.with_name(f".{PROCESSED_DIR.name}.new")
    if staged.exists():
        shutil.rmtree(staged)
    staged.mkdir(parents=True)
    try:
        for filename, records in outputs.items():
            # import_report is represented as one item by the common output type.
            data = records[0] if filename == "import_report.json" else records
            _write_json(staged / filename, data)
        _replace_directory(staged, PROCESSED_DIR)
    finally:
        if staged.exists():
            shutil.rmtree(staged)


def _write_raw(raw_by_name: dict[str, bytes], metadata: dict[str, dict[str, Any]]) -> None:
    staged = RAW_DIR.with_name(".raw.new")
    if staged.exists():
        shutil.rmtree(staged)
    staged.mkdir(parents=True)
    try:
        for name, raw in raw_by_name.items():
            (staged / f"{name}.json").write_bytes(raw)
        _write_json(staged / "source_manifest.json", {"sources": metadata})
        _replace_directory(staged, RAW_DIR)
    finally:
        if staged.exists():
            shutil.rmtree(staged)


def _read_local_sources() -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    raw_by_name: dict[str, bytes] = {}
    sources: dict[str, dict[str, Any]] = {}
    manifest_path = RAW_DIR / "source_manifest.json"
    metadata: dict[str, dict[str, Any]] = {}
    if manifest_path.exists():
        manifest = parse_source(manifest_path.read_bytes(), "source_manifest.json")
        value = manifest.get("sources", {})
        if not isinstance(value, dict):
            raise ValueError("source_manifest.json must contain a sources object")
        metadata = value

    for name, url in SOURCES.items():
        path = RAW_DIR / f"{name}.json"
        if not path.is_file():
            raise FileNotFoundError(f"Missing {path}; run this script with --update to download source files")
        raw = path.read_bytes()
        data = parse_source(raw, path.name)
        record = metadata.get(name, {})
        expected_hash = record.get("sha256") if isinstance(record, dict) else None
        if expected_hash and hashlib.sha256(raw).hexdigest() != expected_hash:
            raise ValueError(f"{path} does not match the SHA-256 in source_manifest.json")
        sources[name] = data
        raw_by_name[name] = raw
        if not isinstance(record, dict) or not record:
            metadata[name] = {
                "url": url,
                "fetched_at": None,
                "size_bytes": len(raw),
                "sha256": hashlib.sha256(raw).hexdigest(),
            }
    return sources, metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--update",
        action="store_true",
        help="download all three official JSON sources before processing",
    )
    args = parser.parse_args()

    if args.update:
        raw_by_name, metadata = _download_sources()
        sources = {name: parse_source(raw, name) for name, raw in raw_by_name.items()}
    else:
        sources, metadata = _read_local_sources()
        raw_by_name = {}

    # Complete parsing and transformation before replacing any last-known-good output.
    outputs = prepare_data(sources, metadata)
    if args.update:
        _write_raw(raw_by_name, metadata)
    _write_processed(outputs)

    report = outputs["import_report.json"][0]
    counts = report["counts"]
    print(
        "Prepared "
        f"{counts['processed_exhibits']} exhibits, {counts['buildings']} buildings, {counts['halls']} halls; "
        f"{counts['route_eligible_main_building_116']} route-eligible in building 116."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
