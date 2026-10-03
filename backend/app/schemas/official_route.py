"""Pydantic schemas for official museum routes and uniqueness comparison."""

from typing import Literal
from pydantic import BaseModel, Field


class OfficialRouteStop(BaseModel):
    position: int = Field(..., ge=1, description="Порядковый номер остановки")
    title: str = Field(..., description="Название экспоната или зала")
    artist: str | None = Field(None, description="Автор произведения")
    date: str | None = Field(None, description="Год или период создания")
    hall: str | None = Field(None, description="Номер или название зала")
    building: str | None = Field(None, description="Здание музея (Главное здание или Галерея XIX–XX)")
    exhibit_id: str | None = Field(None, description="Идентификатор в фонде музея (если сопоставлен)")


class OfficialRoute(BaseModel):
    id: str = Field(..., description="Стабильный нормализованный идентификатор маршрута")
    title: str = Field(..., description="Название официального маршрута")
    description: str = Field(..., description="Описание маршрута")
    source_url: str = Field(..., description="Официальный URL источника")
    source_name: str = Field(..., description="Название источника (портал, tmatic, artefact)")
    collected_at: str = Field(..., description="Дата сбора в формате ISO 8601")
    sequence_hash: str = Field(..., description="SHA-256 хеш последовательности экспонатов")
    set_hash: str = Field(..., description="SHA-256 хеш отсортированного множества экспонатов")
    exhibit_ids: list[str] = Field(..., description="Список сопоставленных идентификаторов экспонатов")
    stops: list[OfficialRouteStop] = Field(..., description="Список остановок маршрута")
    verification_status: Literal["verified", "partial", "unverified"] = Field(
        default="verified", description="Статус верификации данных"
    )
    completeness_score: float = Field(
        default=1.0, ge=0.0, le=1.0, description="Оценка полноты извлеченных данных"
    )


class UniquenessCheckRequest(BaseModel):
    exhibit_ids: list[str] = Field(..., min_length=1, description="Список ID экспонатов проверяемого маршрута")
    title: str = Field(default="", description="Название проверяемого маршрута")


class UniquenessCheckResponse(BaseModel):
    is_unique: bool = Field(..., description="Флаг: является ли маршрут уникальным")
    match_kind: Literal[
        "exact_sequence",
        "permutation",
        "significant_overlap",
        "title_theme_similarity",
        "unique",
    ] = Field(..., description="Тип выявленного совпадения")
    similarity_score: float = Field(..., ge=0.0, le=1.0, description="Коэффициент сходства от 0.0 до 1.0")
    matched_official_route_id: str | None = Field(None, description="ID совпавшего официального маршрута")
    matched_official_route_title: str | None = Field(None, description="Название совпавшего официального маршрута")
    overlapping_exhibits: list[str] = Field(default_factory=list, description="Список пересекающихся экспонатов")
    explanation: str = Field(..., description="Человекочитаемое пояснение результата проверки")
