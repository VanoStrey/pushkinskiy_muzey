from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.data.exhibits import get_all_buildings, get_all_exhibits, get_hall_by_id


router = APIRouter(tags=["museum catalog"])


class HallResponse(BaseModel):
    id: str
    building_id: str
    building_name: str | None = None
    floor_id: str
    floor_number: str | None = None
    number: str | None = None
    name: str | None = None
    floor_plan_url: str | None = None


class ExhibitResponse(BaseModel):
    id: str
    inventory_number: str | None = None
    title: str | None = None
    authors: list[str]
    date_text: str | None = None
    year: int | str | None = None
    type: str | None = None
    country: str | None = None
    material: str | None = None
    description: str
    annotation: str
    building_id: str | None = None
    hall_id: str | None = None
    building_name: str | None = None
    hall: HallResponse | None = None
    image_urls: list[str]
    source_url: str | None = None
    show_in_hall: bool | None = None
    route_eligible: bool


class ExhibitListResponse(BaseModel):
    building_id: str
    building_name: str | None
    count: int
    items: list[ExhibitResponse]
    usage_note: str


USAGE_NOTE = (
    "Тексты приведены фрагментами до 500 символов с указанием источника; "
    "изображения не встроены. Откройте карточку музея по ссылке для дополнительных материалов."
)


def enrich_exhibit(exhibit: dict[str, Any]) -> dict[str, Any]:
    item = dict(exhibit)
    building = next(
        (record for record in get_all_buildings() if record.get("id") == item.get("building_id")),
        None,
    )
    item["building_name"] = building.get("name") if building else None
    hall = get_hall_by_id(item.get("building_id") or "", item.get("hall_id") or "")
    item["hall"] = hall
    return item


@router.get("/exhibits", response_model=ExhibitListResponse)
def list_exhibits(
    building_id: str = Query(default="116", min_length=1, max_length=40),
    route_eligible_only: bool = True,
) -> ExhibitListResponse:
    building = next((item for item in get_all_buildings() if item.get("id") == building_id), None)
    exhibits = [item for item in get_all_exhibits() if item.get("building_id") == building_id]
    if route_eligible_only:
        exhibits = [item for item in exhibits if item.get("route_eligible") is True]
    items = [ExhibitResponse.model_validate(enrich_exhibit(item)) for item in exhibits]
    return ExhibitListResponse(
        building_id=building_id,
        building_name=building.get("name") if building else None,
        count=len(items),
        items=items,
        usage_note=USAGE_NOTE,
    )
