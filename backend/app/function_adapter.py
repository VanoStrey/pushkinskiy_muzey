"""Run the FastAPI app inside Yandex Cloud Functions.

API Gateway calls the function with a `payload_format_version: 1.0` event.
`handler` turns that event into one ASGI request to the FastAPI app and turns
the ASGI response back into the dict the gateway expects.

One event loop lives for the whole function instance, and the app lifespan
(YDB driver, startup connection check) is entered once, on the first call.
Local development does not use this module: it runs uvicorn.
"""

import asyncio
import base64
import logging
import threading
from contextlib import AsyncExitStack
from urllib.parse import urlencode, urlsplit

from app.main import app

logger = logging.getLogger("app.function_adapter")

_loop: asyncio.AbstractEventLoop | None = None
_lifespan: AsyncExitStack | None = None
_lock = threading.Lock()


def _start() -> asyncio.AbstractEventLoop:
    global _loop, _lifespan
    if _loop is None:
        # Globals are set only after the lifespan started, so a failed start is retried.
        loop = asyncio.new_event_loop()
        stack = AsyncExitStack()
        try:
            loop.run_until_complete(stack.enter_async_context(app.router.lifespan_context(app)))
        except BaseException:
            loop.close()
            raise
        _loop, _lifespan = loop, stack
    return _loop


def _request_path(event: dict) -> str:
    path = event.get("path") or "/"
    # API Gateway puts the spec template (e.g. /api/{proxy+}) in `path` and
    # the real request path in `url`.
    if "{" in path and event.get("url"):
        path = urlsplit(event["url"]).path
    return path


def _build_scope(event: dict) -> dict:
    path = _request_path(event)
    query = event.get("multiValueQueryStringParameters") or {}
    if not query and event.get("queryStringParameters"):
        query = {k: [v] for k, v in event["queryStringParameters"].items()}
    headers = [
        (str(name).lower().encode("utf-8"), str(value).encode("utf-8"))
        for name, value in (event.get("headers") or {}).items()
    ]
    return {
        "type": "http",
        "asgi": {"version": "3.0", "spec_version": "2.4"},
        "http_version": "1.1",
        "method": (event.get("httpMethod") or "GET").upper(),
        "scheme": "https",
        "path": path,
        "raw_path": path.encode("utf-8"),
        "query_string": urlencode(query, doseq=True).encode("latin-1"),
        "root_path": "",
        "headers": headers,
        "client": None,
        "server": None,
    }


def _request_body(event: dict) -> bytes:
    body = event.get("body") or ""
    if event.get("isBase64Encoded"):
        return base64.b64decode(body)
    return body.encode("utf-8")


async def _call_app(scope: dict, body: bytes) -> dict:
    request_sent = False
    started = False
    status = 500
    headers: list[tuple[bytes, bytes]] = []
    chunks: list[bytes] = []

    async def receive() -> dict:
        nonlocal request_sent
        if not request_sent:
            request_sent = True
            return {"type": "http.request", "body": body, "more_body": False}
        return {"type": "http.disconnect"}

    async def send(message: dict) -> None:
        nonlocal status, headers, started
        if message["type"] == "http.response.start":
            started = True
            status = message["status"]
            headers = message.get("headers", [])
        elif message["type"] == "http.response.body":
            chunks.append(message.get("body", b""))

    try:
        await app(scope, receive, send)
    except Exception:
        # Starlette has usually sent its 500 already; return that instead of
        # letting the error escape the handler (the gateway would answer 502).
        logger.exception("Unhandled error in %s %s", scope["method"], scope["path"])
        if not started:
            status, headers, chunks = 500, [], [b"Internal Server Error"]

    multi_headers: dict[str, list[str]] = {}
    for name, value in headers:
        multi_headers.setdefault(name.decode("latin-1"), []).append(value.decode("latin-1"))

    raw = b"".join(chunks)
    try:
        response_body, is_base64 = raw.decode("utf-8"), False
    except UnicodeDecodeError:
        response_body, is_base64 = base64.b64encode(raw).decode("ascii"), True

    return {
        "statusCode": status,
        "headers": {name: ", ".join(values) for name, values in multi_headers.items()},
        "multiValueHeaders": multi_headers,
        "body": response_body,
        "isBase64Encoded": is_base64,
    }


def handler(event: dict, context=None) -> dict:
    """Cloud Functions entrypoint (`index.handler`)."""
    with _lock:
        loop = _start()
        return loop.run_until_complete(_call_app(_build_scope(event), _request_body(event)))
