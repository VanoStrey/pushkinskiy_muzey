"""Pydantic schemas for route generation and museum stops."""

from typing import Literal
from pydantic import BaseModel, Field


class Challenge(BaseModel):
    type: Literal["question", "observation"] = "question"
    question: str = Field(..., description="Вопрос или интерактивное задание по экспонату")
    options: list[str] = Field(default_factory=list, max_length=4, description="Варианты ответа только для викторины")
    correct_option: int | None = Field(None, ge=0, description="Индекс правильного ответа; отсутствует у задания-наблюдения")
    explanation: str | None = Field(None, description="Пояснение, если оно есть; наблюдение не оценивается")


class Stop(BaseModel):
    position: int = Field(..., ge=1, description="Порядковый номер остановки в маршруте")
    exhibit_id: str = Field(..., description="Идентификатор верифицированного экспоната из каталога")
    title: str = Field(..., description="Название произведения")
    artist: str | None = Field(None, description="Автор из каталога, если указан")
    date: str | None = Field(None, description="Дата из каталога, если указана")
    image_url: str | None = Field(None, description="Ссылка на проверенное изображение экспоната")
    location: str | None = Field(None, description="Зал и здание музея")
    description: str = Field(..., description="Фрагмент текста из подготовленного музейного каталога")
    personalization_reason: str = Field(..., description="Почему экспонат включен в маршрут именно для этого гостя")
    look_closer: str = Field(..., description="Подсказка, на какую интересную деталь обратить внимание")
    challenge: Challenge = Field(..., description="Интерактивное задание или загадка")
    provenance_source: str | None = Field(None, description="Музейное происхождение и инвентарный номер")
    source_url: str | None = Field(None, description="Ссылка на карточку объекта в каталоге музея")
    hall_id: str | None = Field(None, description="Идентификатор зала из каталога музея")
    hall_number: str | None = Field(None, description="Отображаемый номер зала для посетителя")
    hall_name: str | None = Field(None, description="Название зала")
    floor_number: str | None = Field(None, description="Номер этажа музея (1 или 2)")
    building_id: str | None = Field(None, description="Идентификатор здания (116)")
    building_name: str | None = Field(None, description="Название здания")


class BreakInfo(BaseModel):
    title: str = Field(..., description="Название перерыва или точки отдыха")
    location: str = Field(..., description="Место расположения на территории музея")
    duration_minutes: int = Field(20, description="Рекомендуемая длительность отдыха в минутах")
    note: str = Field(..., description="Сведения о доступности и режиме работы")
    floor_number: str | None = Field(None, description="Этаж размещения")
    hall_number: str | None = Field(None, description="Номер зала, если перерыв в зале отдыха")


class RouteGenerateRequest(BaseModel):
    interests: list[str] = Field(
        default_factory=lambda: ["импрессионизм", "шедевры"],
        description="Темы и интересы посетителя",
    )
    duration_minutes: int = Field(
        default=60,
        ge=15,
        le=180,
        description="Желаемая продолжительность визита в минутах",
    )
    group_type: Literal["solo", "friends", "family", "couple"] = Field(
        default="solo",
        description="Состав группы: один, с друзьями, с семьей/детьми, пара",
    )
    difficulty: Literal["beginner", "amateur", "expert"] = Field(
        default="beginner",
        description="Уровень знакомства с искусством",
    )
    style: Literal["quest", "story", "meditative"] = Field(
        default="quest",
        description="Формат: квест с загадками, связная история, медитативное созерцание",
    )
    include_break: bool = Field(
        default=True,
        description="Включить в маршрут паузу для отдыха / кофе",
    )
    visitor_comment: str | None = Field(
        default=None,
        max_length=500,
        description="Краткий комментарий посетителя о своих интересах и пожеланиях",
    )


class RouteGenerateResponse(BaseModel):
    route_id: str = Field(..., description="Уникальный идентификатор сгенерированного маршрута")
    title: str = Field(..., description="Название маршрута")
    intro: str = Field(..., description="Вводная идея и концепция персонального путешествия")
    duration_minutes: int = Field(..., description="Рассчитанная продолжительность")
    is_fallback: bool = Field(
        default=False,
        description="Флаг: маршрут сформирован без вызова AI Studio",
    )
    stops: list[Stop] = Field(..., max_length=6, description="Список до 6 остановок из доступного каталога")
    has_break: bool = Field(default=False, description="Присутствует ли пауза для отдыха в маршруте")
    break_after_stop: int | None = Field(None, description="Номер остановки, после которой запланирован перерыв")
    break_info: BreakInfo | None = Field(None, description="Подтверждённая информация о месте отдыха/кофе")
