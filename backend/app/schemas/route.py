"""Pydantic schemas for route generation and museum stops."""

from typing import Literal
from pydantic import BaseModel, Field


class Challenge(BaseModel):
    type: Literal["question", "observation"] = "question"
    question: str = Field(..., description="Вопрос или интерактивное задание по экспонату")
    options: list[str] = Field(..., min_length=2, max_length=4, description="Варианты ответа")
    correct_option: int = Field(..., ge=0, description="Индекс правильного ответа (начиная с 0)")
    explanation: str = Field(..., description="Пояснение к ответу после взаимодействия")


class Stop(BaseModel):
    position: int = Field(..., ge=1, description="Порядковый номер остановки в маршруте")
    exhibit_id: str = Field(..., description="Идентификатор верифицированного экспоната из каталога")
    title: str = Field(..., description="Название произведения")
    artist: str = Field(..., description="Автор произведения")
    date: str = Field(..., description="Год или период создания")
    image_url: str | None = Field(None, description="Ссылка на проверенное изображение экспоната")
    location: str | None = Field(None, description="Зал и здание музея")
    description: str = Field(..., description="Достоверный исторический рассказ об экспонате")
    personalization_reason: str = Field(..., description="Почему экспонат включен в маршрут именно для этого гостя")
    look_closer: str = Field(..., description="Подсказка, на какую интересную деталь обратить внимание")
    challenge: Challenge = Field(..., description="Интерактивное задание или загадка")
    provenance_source: str | None = Field(None, description="Музейное происхождение и инвентарный номер")


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


class RouteGenerateResponse(BaseModel):
    route_id: str = Field(..., description="Уникальный идентификатор сгенерированного маршрута")
    title: str = Field(..., description="Название маршрута")
    intro: str = Field(..., description="Вводная идея и концепция персонального путешествия")
    duration_minutes: int = Field(..., description="Рассчитанная продолжительность")
    is_fallback: bool = Field(
        default=False,
        description="Флаг: является ли маршрут проверенным кураторским резервом (при недоступности AI)",
    )
    stops: list[Stop] = Field(
        ...,
        min_length=4,
        max_length=6,
        description="Список из 4–6 последовательных остановок маршрута",
    )
