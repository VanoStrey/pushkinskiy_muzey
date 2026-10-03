"""The Cloud Functions handler serves the same FastAPI app as uvicorn."""

import base64
import json

from fastapi import Query
from pydantic import BaseModel

from app.main import app as fastapi_app
from index import handler


def gateway_event(
    method="GET", path="/api/hello", query=None, body=None, base64_body=False, **extra
):
    """A minimal API Gateway `payload_format_version: 1.0` event."""
    raw_body = body or ""
    if base64_body:
        raw_body = base64.b64encode(raw_body.encode()).decode()
    return {
        "version": "1.0",
        "httpMethod": method,
        "path": path,
        "headers": {"Content-Type": "application/json", "Accept": "application/json"},
        "multiValueQueryStringParameters": query,
        "body": raw_body,
        "isBase64Encoded": base64_body,
        **extra,
    }


def test_hello_through_function_handler():
    response = handler(gateway_event(), None)

    assert response["statusCode"] == 200
    assert response["headers"]["content-type"] == "application/json"
    assert response["isBase64Encoded"] is False
    assert json.loads(response["body"])["message"]


def test_unknown_path_returns_404():
    response = handler(gateway_event(path="/api/does-not-exist"), None)

    assert response["statusCode"] == 404


def test_template_path_falls_back_to_url():
    # Yandex payload 1.0 may put the spec template in `path` and the real path in `url`.
    response = handler(gateway_event(path="/api/{proxy+}", url="/api/hello?x=1"), None)

    assert response["statusCode"] == 200
    assert json.loads(response["body"])["message"]


def test_unhandled_error_returns_500_instead_of_raising():
    @fastapi_app.get("/api/_test_boom")
    def boom():
        raise RuntimeError("boom")

    try:
        response = handler(gateway_event(path="/api/_test_boom"), None)
    finally:
        fastapi_app.router.routes.pop()

    assert response["statusCode"] == 500


class EchoIn(BaseModel):
    text: str


def test_query_string_and_post_body_round_trip():
    @fastapi_app.post("/api/_test_echo")
    def echo(payload: EchoIn, tag: list[str] | None = Query(None)):
        return {"text": payload.text, "tag": tag}

    try:
        plain = handler(
            gateway_event(
                method="POST",
                path="/api/_test_echo",
                query={"tag": ["a", "b"]},
                body=json.dumps({"text": "привет"}),
            ),
            None,
        )
        single = handler(
            gateway_event(
                method="POST",
                path="/api/_test_echo",
                body=json.dumps({"text": "single"}),
                queryStringParameters={"tag": "a"},
            ),
            None,
        )
        encoded = handler(
            gateway_event(
                method="POST",
                path="/api/_test_echo",
                body=json.dumps({"text": "base64"}),
                base64_body=True,
            ),
            None,
        )
    finally:
        fastapi_app.router.routes.pop()

    assert plain["statusCode"] == 200
    assert json.loads(plain["body"]) == {"text": "привет", "tag": ["a", "b"]}
    assert json.loads(single["body"]) == {"text": "single", "tag": ["a"]}
    assert encoded["statusCode"] == 200
    assert json.loads(encoded["body"]) == {"text": "base64", "tag": None}
