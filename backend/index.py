"""Cloud Functions entrypoint: `index.handler` (see .sourcecraft/ci.yaml)."""

from app.function_adapter import handler

__all__ = ["handler"]
