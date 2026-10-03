# Инструкции для AI-ассистента

Этот файл читает SourceCraft Assistant (и другие агенты). Следуй ему при любых изменениях в репозитории.

## Структура и запуск

```
backend/                 FastAPI (Python 3.12, uv)
  app/main.py            создание приложения, lifespan (YDB-клиент)
  app/config.py          настройки только из переменных окружения
  app/db.py              YDB: драйвер, пул сессий, зависимость get_ydb_pool
  app/ai.py              AI Studio: функция ask(prompt) для вызова модели
  app/api/               эндпоинты /api/... (один модуль = один роутер)
  app/function_adapter.py  запуск FastAPI внутри Cloud Function, НЕ трогать
  index.py               точка входа Cloud Function (index.handler), НЕ трогать
  tests/                 pytest
frontend/                Vite + React + TypeScript + Tailwind, FSD
  index.html             HTML-оболочка SPA
  vite.config.ts         алиас @/ → src/, прокси /api на бэкенд в dev-режиме
  src/main.tsx           точка входа: рендерит App из src/app
  src/                   слои FSD: app, pages, widgets, features, entities, shared
deploy/api-gateway.yaml  спецификация API Gateway для облака
.sourcecraft/ci.yaml     CI/CD SourceCraft (сам создаёт ресурсы в облаке)
```

- Локально: `cp .env.template .env && docker compose up`, затем http://localhost:5173/. Код бэкенда и фронтенда перезагружается сам.
- Тесты бэкенда: `cd backend && uv run pytest`. Новую зависимость добавляй через `uv add <пакет>`.
- Сборка фронтенда: `cd frontend && npm run build && npm run lint` (результат в `frontend/dist`). Новую зависимость добавляй через `npm install <пакет>`.
- В контейнеры смонтированы только `backend/app` и `frontend/src`. После добавления зависимостей или правки конфигов (`vite.config.ts`, `package.json`, `index.html`, `pyproject.toml`) пересобери контейнеры: `docker compose up --build`.

## Главный принцип

**Простое лучше сложного.** За архитектурную сложность на хакатоне баллов не дают. Не добавляй слои, абстракции, очереди, кэши и паттерны «на будущее». Пиши минимальный понятный код, который решает задачу.

## API

- Все эндпоинты живут под `/api/...` (без версии в пути: на хакатоне версионирование API не нужно). Новый ресурс — новый файл `backend/app/api/<resource>.py` со своим `APIRouter`, подключённый в `backend/app/api/__init__.py`. Документация API генерируется автоматически: `/api/docs`.
- Запросы и ответы описывай Pydantic-моделями.
- На каждый новый эндпоинт добавь тест по образцу `backend/tests/test_hello.py`.
- Фронтенд обращается к API только по относительному пути `/api/...` через `@/shared/api`. Никаких абсолютных URL и хостов: в облаке фронтенд и API обслуживаются с одного домена через API Gateway, локально — через прокси dev-сервера Vite.

## Слои фронтенда (FSD)

Feature-Sliced Design, слои сверху вниз: `app` → `pages` → `widgets` → `features` → `entities` → `shared`.

- Слой может импортировать только из слоёв **ниже** себя. Слайсы одного слоя не импортируют друг друга.
- Импорт из слайса — только через его публичный API (`index.ts`): `import { HelloMessage } from "@/features/hello"`.
- Внутри слайса — сегменты: `ui/` (компоненты), `api/` (запросы), `model/` (состояние, типы), `lib/` (утилиты).
- `src/app` — корневой компонент `App`, провайдеры, глобальные стили, роутинг.
- `src/pages/<page>` — страница целиком. Какая страница показывается, решает `src/app/app.tsx`.
- `src/features/<feature>` — пользовательское действие или сценарий (загрузка, форма, кнопка).
- `src/entities/<entity>` — бизнес-сущность (например, пользователь или заказ) и её отображение.
- `src/shared` — переиспользуемое без бизнес-логики: `shared/api` (fetch-обёртка), `shared/ui`, `shared/lib`.

## Статический фронтенд (SPA)

Фронтенд — одностраничное приложение: `npm run build` собирает статические файлы в `frontend/dist`, CI кладёт их в Object Storage. Сервера у фронтенда нет.

- Все данные загружаются в браузере: компонент + запрос к `/api/...`. Вся серверная логика — только в бэкенде.
- Никакого SSR и серверного кода во фронтенде; не подключай Next.js и похожие фреймворки.
- Роутинг — только клиентский. Когда нужна вторая страница, поставь `npm install react-router` и опиши маршруты в `src/app/app.tsx` (`BrowserRouter` + `Routes`), страницы бери из `src/pages`. API Gateway на любой неизвестный путь отдаёт `index.html`, поэтому прямые ссылки вида `/artworks/42` работают.
- Файлы из `frontend/public` копируются в корень сборки как есть (картинки, иконки).
- Переменные окружения фронтенда (`VITE_*`) попадают в код, который видит любой пользователь. Секретов в них быть не может.

## Serverless-бэкенд

В облаке бэкенд работает как **Yandex Cloud Function** (Python 3.12). Тот же FastAPI-код запускается через `app/function_adapter.py`; локально — через uvicorn. Писать код под функцию отдельно не нужно.

- **Без состояния.** Не храни данные в памяти процесса или в файлах между запросами — экземпляры функции создаются и удаляются в любой момент. Всё, что нужно сохранить, — в YDB или Object Storage.
- **Таймаут запроса — 60 секунд.** Долгую работу (например, длинный вызов модели) разбивай на части или делай быстрее; фоновых задач после ответа нет.
- **Холодный старт.** Первый запрос к новому экземпляру медленнее. Не делай тяжёлой работы при импорте модулей.
- Вся конфигурация — из переменных окружения через `app/config.py`. Никаких захардкоженных адресов, ключей, ID каталогов. Новую переменную добавь в `app/config.py`, в `.env.template` с комментарием и, если она нужна в облаке, в `--environment` шага `deploy-function` в `.sourcecraft/ci.yaml`.
- Секреты (ключи сторонних API, токены) никогда не коммить. В `.env.template` оставляй пустое значение, в облако секрет попадает из секретов репозитория SourceCraft: `NAME: ${{ secrets.NAME }}` в `env` куба `deploy-function` и `,NAME=$NAME` в `--environment`. Пошагово описано в README, раздел «Свои переменные окружения».
- Зависимости бэкенда попадают в функцию из `uv.lock` автоматически (CI делает `uv export`).

## Доступ к YDB

База — YDB (не PostgreSQL). Язык запросов — **YQL**. Клиент создаётся при старте приложения (`app/main.py`), в эндпоинтах бери пул сессий через зависимость:

```python
import ydb
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.db import get_ydb_pool

router = APIRouter(tags=["items"])


class Item(BaseModel):
    id: int
    title: str


@router.get("/items/{item_id}", response_model=Item)
def get_item(item_id: int, pool: ydb.QuerySessionPool = Depends(get_ydb_pool)) -> Item:
    result_sets = pool.execute_with_retries(
        """
        DECLARE $id AS Uint64;
        SELECT id, title FROM items WHERE id = $id;
        """,
        {"$id": (item_id, ydb.PrimitiveType.Uint64)},
    )
    rows = result_sets[0].rows
    if not rows:
        raise HTTPException(status_code=404, detail="Item not found")
    return Item(**dict(rows[0]))
```

Правила и отличия от Postgres:

- Эндпоинты с YDB объявляй обычным `def` (не `async def`): клиент синхронный, FastAPI выполнит их в пуле потоков.
- Всегда используй `execute_with_retries` и параметры `$name` с `DECLARE`. Не подставляй значения в строку запроса.
- У каждой таблицы обязателен `PRIMARY KEY`. Автоинкремента по умолчанию нет — используй `Serial`/`BigSerial` или генерируй ID (например, UUID строкой `Utf8`).
- Типы: строки — `Utf8` (текст) или `String` (байты), числа — `Int64`/`Uint64`/`Double`, время — `Timestamp`, JSON — `Json`.
- Вместо `INSERT ... ON CONFLICT` используй `UPSERT INTO`.
- Схему создавай YQL-запросом `CREATE TABLE IF NOT EXISTS ...` (например, отдельным скриптом или при старте). JOIN-ы есть, но держи модель данных простой.
- Локально база доступна по `grpc://ydb:2136`, `/local`; веб-интерфейс YDB — http://localhost:8765. В облаке базу YDB Serverless создаёт CI, адрес приходит в функцию через `YDB_ENDPOINT` / `YDB_DATABASE`, аутентификация — сервисный аккаунт функции. Код менять не нужно.
- Документация YQL: https://ydb.tech/docs/ru/yql/reference/

## AI Studio

- Вызовы Yandex AI Studio делаются **только из бэкенда**. Фронтенд ходит в свой `/api/...`, а бэкенд уже обращается к AI Studio.
- Ключи никогда не попадают во фронтенд: никаких `VITE_*` с ключами, никаких ключей в коде и в репозитории.
- Модель вызывай через готовую функцию `ask` из `app/ai.py`, не создавай свой клиент:

  ```python
  from app.ai import ask

  answer = ask("Расскажи про картину", instructions="Ты экскурсовод")
  ```

  Пример эндпоинта — `backend/app/api/ai.py` (`POST /api/ai/ask`), в тестах подменяй `ask` через `monkeypatch`, без сетевых вызовов.
- Настройки: `YANDEX_API_KEY`, `YANDEX_FOLDER_ID` и `YANDEX_MODEL` из переменных окружения (через `app/config.py`). Клиент — пакет `openai` с OpenAI-совместимым endpoint AI Studio.
- OpenAI-совместимый endpoint: `https://ai.api.cloud.yandex.net/v1`, модель в формате `gpt://<folder_id>/<model>`.
- В облаке API-ключ не нужен: функция работает от сервисного аккаунта подключения, IAM-токен берётся из сервиса метаданных (так же, как для YDB через `YDB_METADATA_CREDENTIALS=1`). Локально используй `YANDEX_API_KEY`.
