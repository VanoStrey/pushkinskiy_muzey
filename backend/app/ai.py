"""Calls to Yandex AI Studio through its OpenAI-compatible API.

Locally the call is authorized with `YANDEX_API_KEY`. In Cloud Functions the
key is not needed: the function's service account gets an IAM token from the
metadata service (the same way YDB does with `YDB_METADATA_CREDENTIALS=1`).
"""

import json
import urllib.request

import openai

from app.config import settings

BASE_URL = "https://ai.api.cloud.yandex.net/v1"
METADATA_TOKEN_URL = "http://169.254.169.254/computeMetadata/v1/instance/service-accounts/default/token"


def _api_key() -> str:
    if settings.yandex_api_key:
        return settings.yandex_api_key
    request = urllib.request.Request(METADATA_TOKEN_URL, headers={"Metadata-Flavor": "Google"})
    with urllib.request.urlopen(request, timeout=2) as response:
        return json.load(response)["access_token"]


def ask(prompt: str, instructions: str = "", timeout: float = 50) -> str:
    """Send one prompt to the model from `YANDEX_MODEL` and return its text answer."""
    if not settings.yandex_folder_id:
        raise RuntimeError("YANDEX_FOLDER_ID is not set")
    client = openai.OpenAI(
        api_key=_api_key(),
        base_url=BASE_URL,
        project=settings.yandex_folder_id,
        timeout=timeout,
        max_retries=1,
    )
    response = client.responses.create(
        model=f"gpt://{settings.yandex_folder_id}/{settings.yandex_model}",
        instructions=instructions,
        input=prompt,
        temperature=0.3,
        max_output_tokens=1500,
    )
    return response.output_text
