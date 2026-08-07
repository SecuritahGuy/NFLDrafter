"""NFL news ingestion with player-relevance scoring.

Pulls articles from ESPN's public, no-auth news feed, stores each as a
``NewsItem`` snapshot, and scores each article's ``players`` mapping by scanning
the story body and headline for player name mentions. The score reflects how
relevant an article is to a given player (mention count + keyword boost), which
downstream code can aggregate into per-player news features.
"""

from __future__ import annotations

import hashlib
import html as html_module
import re
import time
import urllib.request
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal
from ..models import NewsItem, Player
from .player_matching import normalize_name

_ESPN_NEWS_BASE = (
    "https://site.web.api.espn.com/apis/site/v2/sports/football/nfl/news"
)
_ESPN_STORY_BASE = "https://content.core.api.espn.com/v1/sports/news"

# Per-story keyword presence boost applied to a player's relevance score.
_KEYWORD_BOOST = 2.0
# Base score per full-name mention found in the article body.
_MENTION_SCORE = 1.0
# Extra boost when the player's name appears in the headline.
_HEADLINE_BOOST = 3.0

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and value != value:  # NaN
        return None
    s = str(value).strip()
    if s in {"", "nan", "None"}:
        return None
    return value


def _strip_html(raw: str | None) -> str:
    if not raw:
        return ""
    text = _TAG_RE.sub(" ", raw)
    text = html_module.unescape(text)
    return _WS_RE.sub(" ", text).strip()


def _parse_epoch_ms(published: str | None) -> int | None:
    if not published:
        return None
    try:
        from datetime import datetime

        dt = datetime.fromisoformat(published.replace("Z", "+00:00"))
        return int(dt.timestamp() * 1000)
    except ValueError:
        return None


def _story_url(article_id: int | str) -> str:
    return f"{_ESPN_STORY_BASE}/{article_id}"


@dataclass(slots=True)
class ESPNNewsProvider:
    """HTTP provider for ESPN's public NFL news feed."""

    limit: int = 50

    def load_articles(self) -> list[dict[str, Any]]:
        """Fetch the news list (headline/summary level)."""
        url = f"{_ESPN_NEWS_BASE}?limit={self.limit}"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=60) as resp:
            payload = json_load(resp.read())
        return payload.get("articles") or []

    def load_story(self, article: dict[str, Any]) -> dict[str, Any]:
        """Fetch the full story body + keywords for one article."""
        article_id = article.get("id")
        req = urllib.request.Request(
            _story_url(article_id), headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            payload = json_load(resp.read())
        headlines = payload.get("headlines") or []
        return headlines[0] if headlines else {}


def json_load(raw: bytes) -> dict[str, Any]:
    import json

    return json.loads(raw)


def _parse_news_record(article: dict[str, Any], story: dict[str, Any]) -> dict[str, Any] | None:
    """Normalize an ESPN article into a NewsItem payload."""
    headline = _clean(article.get("headline") or article.get("title"))
    description = _clean(article.get("description"))
    if not headline:
        return None

    published = _parse_epoch_ms(story.get("published") or article.get("published"))
    if published is None:
        return None

    web_links = (story.get("links") or {}).get("web") or {}
    url = (
        (web_links.get("self") or {}).get("href")
        if isinstance(web_links, dict)
        else None
    ) or (article.get("links") or {}).get("web", {}).get("href")
    if not url:
        url = _story_url(article.get("id"))

    story_text = _strip_html(story.get("story"))
    keywords = story.get("keywords") or []

    return {
        "news_id": hashlib.sha1(f"espn|{article.get('id')}".encode()).hexdigest(),
        "published_at": published,
        "source": "espn",
        "url": str(url),
        "title": str(headline),
        "summary": str(description or story_text[:400]),
        "story": story_text,
        "players": {},  # filled by scorer
        "keywords": list(keywords),
        "created_at": int(time.time()),
    }


def _score_players(
    rec: dict[str, Any],
    player_index: dict[str, list[tuple[str, str]]],
) -> dict[str, float]:
    """Score article-to-player relevance from headline, keywords, and body.

    Args:
        rec: Normalized news record.
        player_index: maps normalized player name -> list of (player_id, display name).

    Returns:
        {player_id: score} with score = keyword boost + body mention count +
        headline boost. Only players mentioned at least once are included.
    """
    title_text = normalize_name(rec["title"])
    story_text = normalize_name(rec["story"])
    combined = f"{title_text} {story_text}"

    scores: dict[str, float] = {}
    for normalized, entries in player_index.items():
        if not normalized:
            continue
        # Strip spaces so "DeAndre Hopkins" matches "deandre hopkins".
        token = normalized.replace(" ", "")
        if token not in combined.replace(" ", ""):
            continue
        score = _MENTION_SCORE
        if token in title_text.replace(" ", ""):
            score += _HEADLINE_BOOST
        for player_id, _display in entries:
            for keyword in rec["keywords"]:
                if normalize_name(keyword) == normalized:
                    score += _KEYWORD_BOOST
                    break
            scores[player_id] = max(scores.get(player_id, 0.0), score)

    return scores


def _build_player_index(players: list[Player]) -> dict[str, list[tuple[str, str]]]:
    """Index players by normalized name for body scanning."""
    index: dict[str, list[tuple[str, str]]] = {}
    for player in players:
        normalized = normalize_name(player.full_name)
        index.setdefault(normalized, []).append((player.player_id, player.full_name))
    return index


async def ingest_news(
    limit: int = 50,
    provider: ESPNNewsProvider | None = None,
    delete_existing: bool = False,
    session: AsyncSession | None = None,
) -> dict:
    """
    Ingest the latest ESPN NFL news with player-relevance scoring.

    Args:
        limit: Max articles to fetch (ESPN caps the list at 50).
        provider: ESPNNewsProvider override (defaults to a live HTTP fetch).
        delete_existing: Drop previously stored news items before inserting.
        session: AsyncSession override for tests (defaults to SessionLocal).

    Returns:
        Summary dict with article count, player mentions, and dedupe info.
    """
    provider = provider or ESPNNewsProvider(limit=limit)
    articles = provider.load_articles()

    async def _run(session) -> tuple[int, int, int]:
        players = list((await session.execute(select(Player))).scalars().all())
        player_index = _build_player_index(players)

        existing_urls = set(
            (await session.execute(select(NewsItem.url))).scalars().all()
        )
        if delete_existing:
            await session.execute(delete(NewsItem))

        stored = 0
        skipped_duplicate = 0
        total_mentions = 0
        for article in articles:
            story = provider.load_story(article)
            rec = _parse_news_record(article, story)
            if not rec:
                continue
            if rec["url"] in existing_urls and not delete_existing:
                skipped_duplicate += 1
                continue
            rec["players"] = _score_players(rec, player_index)
            total_mentions += len(rec["players"])
            session.add(
                NewsItem(
                    news_id=rec["news_id"],
                    published_at=rec["published_at"],
                    source=rec["source"],
                    url=rec["url"],
                    title=rec["title"],
                    summary=rec["summary"],
                    story=rec["story"],
                    players=rec["players"],
                    dedupe_hash=rec["news_id"],
                    created_at=rec["created_at"],
                )
            )
            stored += 1

        await session.commit()
        return stored, skipped_duplicate, total_mentions

    if session is not None:
        stored, skipped_duplicate, total_mentions = await _run(session)
    else:
        async with SessionLocal() as session:
            stored, skipped_duplicate, total_mentions = await _run(session)

    return {
        "loaded": stored,
        "skipped_duplicate": skipped_duplicate,
        "player_mentions": total_mentions,
        "source": "espn",
    }
