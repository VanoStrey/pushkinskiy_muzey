import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """All configuration comes from environment variables (see .env.template)."""

    app_name: str = os.getenv("APP_NAME", "hackathon-template")
    ydb_endpoint: str = os.getenv("YDB_ENDPOINT", "")
    ydb_database: str = os.getenv("YDB_DATABASE", "")
    ydb_connect_timeout: float = float(os.getenv("YDB_CONNECT_TIMEOUT", "10"))
    yandex_api_key: str = os.getenv("YANDEX_API_KEY", "")
    yandex_folder_id: str = os.getenv("YANDEX_FOLDER_ID", "")
    yandex_model: str = os.getenv("YANDEX_MODEL", "yandexgpt-5-lite/latest")
    route_overlap_threshold: float = float(os.getenv("ROUTE_OVERLAP_THRESHOLD", "0.5"))


settings = Settings()
