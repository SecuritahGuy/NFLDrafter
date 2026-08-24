"""PFF RSS feed provider.

This module only consumes publisher-supplied feed metadata and summaries.  It
does not fetch or store article bodies.
"""

from __future__ import annotations

import hashlib
import html
import re
import urllib.request
import xml.etree.ElementTree as ET
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any
from urllib.parse import urlsplit, urlunsplit


PFF_FEED_URL = "https://www.pff.com/feed"
MAX_SUMMARY_CHARS = 1_000

_TAG_RE = re.compile(r"<[^>]+>")
_SPACE_RE = re.compile(r"\s+")


class PFFFeedError(RuntimeError):
    """Raised when the PFF feed cannot be fetched or parsed."""


Transport = Callable[[urllib.request.Request, float], bytes]


def _default_transport(request: urllib.request.Request, timeout: float) -> bytes:
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _direct_child(element: ET.Element, *names: str) -> ET.Element | None:
    wanted = {name.lower() for name in names}
    return next(
        (child for child in element if _local_name(child.tag) in wanted),
        None,
    )


def _child_text(element: ET.Element, *names: str) -> str:
    child = _direct_child(element, *names)
    return "" if child is None else "".join(child.itertext()).strip()


def _clean_text(value: str, *, limit: int | None = None) -> str:
    cleaned = _SPACE_RE.sub(" ", html.unescape(_TAG_RE.sub(" ", value))).strip()
    if limit is not None and len(cleaned) > limit:
        cleaned = cleaned[: limit - 1].rstrip() + "…"
    return cleaned


def _canonical_url(value: str) -> str:
    value = html.unescape(value).strip()
    parts = urlsplit(value)
    if parts.scheme not in {"http", "https"} or not parts.netloc:
        return ""
    return urlunsplit(
        (parts.scheme.lower(), parts.netloc.lower(), parts.path, parts.query, "")
    )


def _entry_url(entry: ET.Element) -> str:
    # RSS uses text content. Atom uses href attributes and can expose multiple
    # links, so prefer rel="alternate" (or an unspecified relation).
    link = _direct_child(entry, "link")
    text_link = "" if link is None else (link.text or "")
    if text_link.strip():
        return _canonical_url(text_link)

    candidates = [
        child
        for child in entry
        if _local_name(child.tag) == "link" and child.attrib.get("href")
    ]
    alternate = next(
        (child for child in candidates if child.attrib.get("rel", "alternate") == "alternate"),
        candidates[0] if candidates else None,
    )
    return "" if alternate is None else _canonical_url(alternate.attrib["href"])


def _published_epoch_ms(value: str) -> int | None:
    if not value.strip():
        return None
    try:
        parsed = parsedate_to_datetime(value)
    except (TypeError, ValueError, OverflowError):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return int(parsed.timestamp() * 1_000)


def _categories(entry: ET.Element) -> list[str]:
    values: list[str] = []
    for child in entry:
        if _local_name(child.tag) != "category":
            continue
        value = child.attrib.get("term") or child.text or ""
        value = _clean_text(value)
        if value and value not in values:
            values.append(value)
    return values


def _parse_entry(entry: ET.Element) -> dict[str, Any] | None:
    title = _clean_text(_child_text(entry, "title"))
    url = _entry_url(entry)
    published_at = _published_epoch_ms(
        _child_text(entry, "pubdate", "published", "updated", "date")
    )
    if not title or not url or published_at is None:
        return None

    # Deliberately ignore content:encoded and Atom content. Feed descriptions
    # and summaries are sufficient evidence while avoiding article-body copies.
    summary = _clean_text(
        _child_text(entry, "description", "summary"), limit=MAX_SUMMARY_CHARS
    )
    identity = _child_text(entry, "guid", "id") or url
    news_id = hashlib.sha1(f"pff|{identity.strip()}".encode()).hexdigest()

    return {
        "news_id": news_id,
        "published_at": published_at,
        "source": "pff",
        "url": url,
        "title": title,
        "summary": summary,
        "story": "",
        "players": {},
        "keywords": _categories(entry),
    }


def parse_pff_feed(xml: bytes | str) -> list[dict[str, Any]]:
    """Normalize an RSS/Atom document into NewsItem-compatible mappings.

    Malformed entries are skipped. An invalid document or unsupported root is
    treated as a provider failure rather than silently returning no articles.
    Duplicate IDs and canonical URLs are collapsed, preserving feed order.
    """

    raw = xml.encode() if isinstance(xml, str) else xml
    if not raw.strip():
        raise PFFFeedError("PFF feed returned an empty response")
    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        raise PFFFeedError(f"PFF feed returned invalid XML: {exc}") from exc

    root_name = _local_name(root.tag)
    if root_name not in {"rss", "rdf", "feed"}:
        raise PFFFeedError(f"PFF feed returned unsupported root element: {root_name}")

    entry_name = "entry" if root_name == "feed" else "item"
    entries = [element for element in root.iter() if _local_name(element.tag) == entry_name]
    records: list[dict[str, Any]] = []
    seen_ids: set[str] = set()
    seen_urls: set[str] = set()
    for entry in entries:
        record = _parse_entry(entry)
        if record is None:
            continue
        if record["news_id"] in seen_ids or record["url"] in seen_urls:
            continue
        seen_ids.add(record["news_id"])
        seen_urls.add(record["url"])
        records.append(record)
    return records


@dataclass(slots=True)
class PFFRSSProvider:
    """Fetch and normalize PFF's public RSS feed."""

    feed_url: str = PFF_FEED_URL
    timeout: float = 30.0
    transport: Transport = field(default=_default_transport, repr=False)

    def load_articles(self, xml: bytes | str | None = None) -> list[dict[str, Any]]:
        """Load records, optionally parsing injected XML without network I/O."""

        if xml is None:
            request = urllib.request.Request(
                self.feed_url,
                headers={
                    "Accept": "application/rss+xml, application/xml;q=0.9, text/xml;q=0.8",
                    "User-Agent": "NFLDrafter/1.0 (+local fantasy research)",
                },
            )
            try:
                xml = self.transport(request, self.timeout)
            except Exception as exc:
                raise PFFFeedError(f"Unable to fetch PFF feed: {exc}") from exc
        return parse_pff_feed(xml)
