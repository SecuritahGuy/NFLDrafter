"""Provider adapter for official FantasyPros NFL player news.

The adapter deliberately does not write to the database.  It returns a small,
provider-neutral batch that the shared news ingestion service can persist:

``items`` records contain stable ``news_id``/``source_record_id`` identifiers,
an epoch-millisecond ``published_at``, editorial fields, and explicit provider
player/team identifiers.  API credentials and the provider's raw response are
never included in the result.
"""

from __future__ import annotations

import hashlib
import re
from datetime import datetime, timezone
from html import unescape
from typing import Any
from urllib.parse import urlsplit, urlunsplit

from .fantasypros_api import FantasyProsClient

SOURCE_ID = "fantasypros"
SOURCE_NAME = "FantasyPros"
SOURCE_HOMEPAGE = "https://www.fantasypros.com/nfl/news/"
DEFAULT_NEWS_TTL_SECONDS = 6 * 60 * 60
_SPACE_RE = re.compile(r"\s+")


def _text(value: Any) -> str:
    if value is None:
        return ""
    return _SPACE_RE.sub(" ", unescape(str(value))).strip()


def _identifier(value: Any) -> str | None:
    value = _text(value)
    return value or None


def _canonical_url(value: Any, external_id: str) -> str:
    """Return a stable HTTPS URL without query strings or fragments."""
    candidate = _text(value)
    if candidate:
        parts = urlsplit(candidate)
        if parts.scheme in {"http", "https"} and parts.netloc:
            return urlunsplit(("https", parts.netloc.lower(), parts.path, "", ""))
    return f"{SOURCE_HOMEPAGE}{external_id}/"


def _epoch_ms(value: Any) -> int | None:
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        numeric = float(value)
        return int(numeric if numeric >= 10_000_000_000 else numeric * 1000)

    raw = _text(value)
    if not raw:
        return None
    if raw.isdigit():
        return _epoch_ms(int(raw))

    normalized = raw.replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        parsed = None
        for pattern in ("%a, %b %dth %I:%M%p UTC", "%a, %b %d %I:%M%p UTC"):
            try:
                parsed = datetime.strptime(raw, pattern).replace(
                    year=datetime.now(timezone.utc).year,
                    tzinfo=timezone.utc,
                )
                break
            except ValueError:
                continue
        if parsed is None:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1000)


def _categories(value: Any) -> list[str]:
    if isinstance(value, str):
        values = value.split(",")
    elif isinstance(value, (list, tuple, set)):
        values = value
    else:
        values = []
    normalized = {_text(item) for item in values if _text(item)}
    return sorted(normalized, key=str.casefold)


def normalize_fantasypros_news_item(item: Any) -> dict[str, Any] | None:
    """Normalize one API item, returning ``None`` for unusable records."""
    if not isinstance(item, dict):
        return None
    external_id = _identifier(item.get("id") or item.get("news_id"))
    title = _text(item.get("title") or item.get("headline"))
    published_at = _epoch_ms(
        item.get("created") or item.get("published_at") or item.get("published")
    )
    if not external_id or not title or published_at is None:
        return None

    source_record_id = f"{SOURCE_ID}:nfl-news:{external_id}"
    return {
        "news_id": hashlib.sha1(source_record_id.encode()).hexdigest(),
        "source": SOURCE_ID,
        "source_record_id": source_record_id,
        "external_id": external_id,
        "published_at": published_at,
        "url": _canonical_url(item.get("link") or item.get("url"), external_id),
        "title": title,
        "summary": _text(item.get("desc") or item.get("description")),
        "story": _text(item.get("impact") or item.get("analysis")),
        "author": _text(item.get("author")) or None,
        "categories": _categories(item.get("categories")),
        "player_ids": {
            SOURCE_ID: [player_id]
            if (player_id := _identifier(item.get("player_id")))
            else []
        },
        "team_ids": {
            SOURCE_ID: [team_id.upper()]
            if (team_id := _identifier(item.get("team_id")))
            else []
        },
    }


async def fetch_fantasypros_news(
    *,
    limit: int = 50,
    client: FantasyProsClient | None = None,
    force_refresh: bool = False,
    cache_only: bool = False,
) -> dict[str, Any]:
    """Fetch and normalize an official FantasyPros NFL news batch."""
    client = client or FantasyProsClient()
    safe_limit = max(1, min(int(limit), 100))
    response = await client.get_json(
        "/nfl/news",
        params={"limit": safe_limit},
        ttl_seconds=DEFAULT_NEWS_TTL_SECONDS,
        force_refresh=force_refresh,
        cache_only=cache_only,
    )
    payload = response.data if isinstance(response.data, dict) else {}
    raw_items = payload.get("items") or payload.get("news") or []
    if not isinstance(raw_items, list):
        raw_items = []

    unique: dict[str, dict[str, Any]] = {}
    for raw_item in raw_items:
        record = normalize_fantasypros_news_item(raw_item)
        if record:
            unique.setdefault(record["source_record_id"], record)
    items = sorted(
        unique.values(), key=lambda record: record["published_at"], reverse=True
    )
    return {
        "source": {
            "source_id": SOURCE_ID,
            "name": SOURCE_NAME,
            "homepage_url": SOURCE_HOMEPAGE,
            "source_type": "editorial",
        },
        "items": items,
        "fetched_at": int(response.fetched_at),
        "cache_status": response.cache_status,
        "requested_limit": safe_limit,
        "skipped": len(raw_items) - len(items),
    }
