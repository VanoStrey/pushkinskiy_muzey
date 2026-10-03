"""Normalization and hashing utilities for museum routes."""

import hashlib
import re
from urllib.parse import urlparse, urlunparse

STOP_WORDS_RU = {
    "и", "в", "во", "не", "что", "он", "на", "я", "с", "со", "как", "а", "то", "все", "она",
    "так", "его", "но", "да", "ты", "к", "у", "же", "вы", "за", "бы", "по", "только", "ее",
    "мне", "было", "вот", "от", "меня", "еще", "о", "из", "ему", "теперь", "когда", "даже",
    "ну", "вдруг", "ли", "если", "уже", "или", "ни", "быть", "был", "него", "до", "вас",
    "нибудь", "опять", "уж", "вам", "ведь", "там", "потом", "себя", "ничего", "ей", "может",
    "они", "тут", "где", "есть", "надо", "ней", "для", "мы", "тебя", "их", "чем", "была",
    "сам", "чтоб", "без", "будто", "чего", "раз", "тоже", "себе", "под", "будет", "ж",
    "тогда", "кто", "этот", "того", "потому", "этого", "какой", "совсем", "ним", "здесь",
    "этом", "один", "почти", "мой", "тем", "чтобы", "нее", "сейчас", "были", "куда", "зачем",
    "всех", "никогда", "можно", "при", "наконец", "два", "об", "другой", "хоть", "после",
    "над", "больше", "тот", "через", "эти", "нас", "про", "всего", "них", "какая", "много",
    "разве", "три", "эту", "моя", "впрочем", "хорошо", "свою", "этой", "перед", "иногда",
    "лучше", "чуть", "том", "нельзя", "такой", "им", "более", "всегда", "конечно", "всю",
    "между", "музей", "пушкинский", "гмии", "им"
}


def normalize_text(text: str) -> str:
    """Normalize text: strip, lowercase, unify quotes and dashes, collapse spaces."""
    if not text:
        return ""
    text = text.strip().lower()
    # Unify quotes
    text = re.sub(r"[«»“”„\"]", '"', text)
    # Unify dashes
    text = re.sub(r"[—–−]", "-", text)
    # Collapse multiple whitespaces
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_url(url: str) -> str:
    """Canonicalize URL: lowercase scheme/netloc, strip trailing slash and tracking query params."""
    if not url:
        return ""
    url = url.strip()
    parsed = urlparse(url)
    clean_path = parsed.path.rstrip("/") if parsed.path != "/" else "/"
    cleaned = urlunparse((parsed.scheme.lower(), parsed.netloc.lower(), clean_path, "", "", ""))
    return cleaned


def normalize_exhibit_id(ex_id: str) -> str:
    """Normalize exhibit ID."""
    return ex_id.strip().lower()


def compute_sequence_hash(exhibit_ids: list[str]) -> str:
    """Compute deterministic SHA-256 hash of ordered exhibit IDs sequence."""
    normalized = [normalize_exhibit_id(e) for e in exhibit_ids if e.strip()]
    payload = ",".join(normalized).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def compute_set_hash(exhibit_ids: list[str]) -> str:
    """Compute deterministic SHA-256 hash of sorted unique exhibit IDs set."""
    normalized = sorted({normalize_exhibit_id(e) for e in exhibit_ids if e.strip()})
    payload = ",".join(normalized).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def compute_jaccard_similarity(set_a: set[str], set_b: set[str]) -> float:
    """Compute Jaccard similarity index between two sets."""
    if not set_a and not set_b:
        return 0.0
    intersection = set_a.intersection(set_b)
    union = set_a.union(set_b)
    if not union:
        return 0.0
    return len(intersection) / len(union)


def stem_token(word: str) -> str:
    """Simple stemmer for Russian words stripping common inflection suffixes."""
    w = word.strip().lower()
    suffixes = (
        "ями", "ами", "ого", "его", "ому", "ему", "ыми", "ими", "ов", "ев", "ей", "ий", "ый",
        "ой", "ая", "яя", "ое", "ее", "ые", "ие", "ом", "ем", "ам", "ям", "ах", "ях",
        "ок", "ек", "ик", "а", "я", "о", "е", "ы", "и", "у", "ю", "ь"
    )
    for suffix in suffixes:
        if w.endswith(suffix) and len(w) - len(suffix) >= 3:
            return w[:-len(suffix)]
    return w


def tokenize_title(title: str) -> set[str]:
    """Tokenize and stem title into significant root tokens."""
    norm = normalize_text(title)
    words = re.findall(r"\b[а-яa-z0-9]{3,}\b", norm)
    return {stem_token(w) for w in words if w not in STOP_WORDS_RU}


def compute_title_similarity(title_a: str, title_b: str) -> float:
    """Compute similarity between two titles using token overlap and containment."""
    tokens_a = tokenize_title(title_a)
    tokens_b = tokenize_title(title_b)
    if not tokens_a or not tokens_b:
        return 0.0
    intersection = tokens_a.intersection(tokens_b)
    jaccard = len(intersection) / len(tokens_a.union(tokens_b))
    containment = len(intersection) / min(len(tokens_a), len(tokens_b))
    return max(jaccard, containment)
