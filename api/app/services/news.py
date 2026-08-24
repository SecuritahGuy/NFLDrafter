"""NFL news ingestion with player-relevance scoring.

Pulls articles from ESPN's public, no-auth news feed, stores each as a
``NewsItem`` snapshot, and scores each article's ``players`` mapping by scanning
the story body and headline for player name mentions. The score reflects how
relevant an article is to a given player (mention count + keyword boost), which
downstream code can aggregate into per-player news features.
"""

from __future__ import annotations

import asyncio
import hashlib
import html as html_module
import re
import time
import urllib.request
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal
from ..models import NewsEntityLink, NewsItem, NewsSource, Player, PlayerRanking
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

_SOURCE_CATALOG = {
    "espn": {
        "name": "ESPN NFL",
        "homepage_url": "https://www.espn.com/nfl/",
        "source_type": "publisher",
        "reliability_tier": "established_publisher",
        "metadata_json": {"feed": _ESPN_NEWS_BASE, "access": "public_no_auth"},
    },
    "fantasypros": {
        "name": "FantasyPros Player News",
        "homepage_url": "https://www.fantasypros.com/nfl/player-news.php",
        "source_type": "structured_news_api",
        "reliability_tier": "fantasy_analysis",
        "metadata_json": {
            "feed": "/nfl/news",
            "access": "api_key",
            "content_policy": "metadata_summary_and_impact",
        },
    },
    "pff": {
        "name": "PFF NFL News",
        "homepage_url": "https://www.pff.com/news",
        "source_type": "publisher_rss",
        "reliability_tier": "established_publisher",
        "metadata_json": {
            "feed": "https://www.pff.com/feed",
            "access": "public_rss",
            "content_policy": "feed_summary_only",
        },
    },
    "sleeper-trends": {
        "name": "Sleeper Trending Players",
        "homepage_url": "https://sleeper.com/",
        "source_type": "market_signal",
        "reliability_tier": "behavioral_signal",
        "metadata_json": {
            "feed": "https://api.sleeper.app/v1/players/nfl/trending/{type}",
            "access": "public_no_auth_noncommercial",
            "attribution": "Sleeper",
        },
    },
}

_TEAM_ALIASES = {
    "ARI": ("arizona cardinals", "cardinals"), "ATL": ("atlanta falcons", "falcons"),
    "BAL": ("baltimore ravens", "ravens"), "BUF": ("buffalo bills", "bills"),
    "CAR": ("carolina panthers", "panthers"), "CHI": ("chicago bears", "bears"),
    "CIN": ("cincinnati bengals", "bengals"), "CLE": ("cleveland browns", "browns"),
    "DAL": ("dallas cowboys", "cowboys"), "DEN": ("denver broncos", "broncos"),
    "DET": ("detroit lions", "lions"), "GB": ("green bay packers", "packers"),
    "HOU": ("houston texans", "texans"), "IND": ("indianapolis colts", "colts"),
    "JAX": ("jacksonville jaguars", "jaguars"), "KC": ("kansas city chiefs", "chiefs"),
    "LV": ("las vegas raiders", "raiders"), "LAC": ("los angeles chargers", "chargers"),
    "LA": ("los angeles rams", "rams"), "MIA": ("miami dolphins", "dolphins"),
    "MIN": ("minnesota vikings", "vikings"), "NE": ("new england patriots", "patriots"),
    "NO": ("new orleans saints", "saints"), "NYG": ("new york giants", "giants"),
    "NYJ": ("new york jets", "jets"), "PHI": ("philadelphia eagles", "eagles"),
    "PIT": ("pittsburgh steelers", "steelers"), "SEA": ("seattle seahawks", "seahawks"),
    "SF": ("san francisco 49ers", "49ers", "niners"), "TB": ("tampa bay buccaneers", "buccaneers", "bucs"),
    "TEN": ("tennessee titans", "titans"), "WAS": ("washington commanders", "commanders"),
}

_SIGNAL_TERMS = {
    "opportunity": ("starter", "starting", "first-team", "first team", "breakout", "emerging", "expanded role", "more snaps", "more targets", "more touches", "position battle", "depth chart"),
    "injury_risk": ("injury", "injured", "surgery", "sidelined", "out for", "questionable", "doubtful", "pup list", "physically unable"),
    "market_risk": ("do not draft", "overvalued", "bust", "worried", "concerning", "concern", "regression", "avoid"),
    "roster_change": ("signed", "released", "waived", "traded", "trade", "cut", "contract", "holdout", "hold-in"),
    "positive_performance": ("impressed", "standout", "strong camp", "excellent", "career year", "favorite", "bullish", "earlier than their adp"),
    "market_momentum": ("trending add", "roster adds", "added in sleeper"),
    "market_fade": ("trending drop", "roster drops", "dropped in sleeper"),
}


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


def _load_espn_records(provider: ESPNNewsProvider) -> list[dict[str, Any]]:
    """Fetch and normalize ESPN records without touching the database."""
    records: list[dict[str, Any]] = []
    for article in provider.load_articles():
        try:
            story = provider.load_story(article)
        except Exception:
            # One flaky story endpoint should not discard the rest of a valid
            # feed response. The next manual refresh can fill the gap.
            continue
        record = _parse_news_record(article, story)
        if record:
            records.append(record)
    return records


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


def _classify_signals(text: str) -> dict[str, Any]:
    """Return matched evidence terms; this is context classification, not sentiment."""
    normalized = _WS_RE.sub(" ", text.lower())
    matches = {
        topic: sorted({term for term in terms if term in normalized})
        for topic, terms in _SIGNAL_TERMS.items()
    }
    matches = {topic: terms for topic, terms in matches.items() if terms}
    return {
        "topics": sorted(matches),
        "matched_terms": matches,
        "opportunity_score": min(len(matches.get("opportunity", [])) * 0.5, 2.0),
        "performance_score": min(len(matches.get("positive_performance", [])) * 0.35, 1.4),
        # Roster behavior confirms that managers are reacting, but it is less
        # predictive than an opportunity report and therefore intentionally
        # receives a smaller bounded weight.
        "momentum_score": min(len(matches.get("market_momentum", [])) * 0.2, 0.4),
        "fade_score": min(len(matches.get("market_fade", [])) * 0.2, 0.4),
        "risk_score": min(
            len(matches.get("injury_risk", [])) * 0.75
            + len(matches.get("market_risk", [])) * 0.6,
            3.0,
        ),
    }


def _player_context(item: NewsItem, player_name: str) -> str:
    text = f"{item.title}. {item.summary or ''}. {item.story or ''}"
    match = re.search(re.escape(player_name), text, flags=re.IGNORECASE)
    if not match:
        return f"{item.title}. {item.summary or ''}"
    start = max(0, match.start() - 220)
    end = min(len(text), match.end() + 220)
    return f"{item.title}. {text[start:end]}"


def _score_teams(item: NewsItem) -> dict[str, float]:
    title = item.title.lower()
    body = f"{item.summary or ''} {item.story or ''}".lower()
    scores: dict[str, float] = {}
    for team, aliases in _TEAM_ALIASES.items():
        title_hits = sum(bool(re.search(rf"\b{re.escape(alias)}\b", title)) for alias in aliases)
        body_hits = sum(bool(re.search(rf"\b{re.escape(alias)}\b", body)) for alias in aliases)
        if title_hits or body_hits:
            scores[team] = min(title_hits * 3.0 + body_hits * 1.0, 6.0)
    return scores


async def rebuild_news_correlations(session: AsyncSession) -> dict[str, int]:
    """Rebuild normalized source, player, and team correlation rows."""
    players = list((await session.execute(select(Player))).scalars().all())
    players_by_id = {player.player_id: player for player in players}
    items = list((await session.execute(select(NewsItem))).scalars().all())
    await session.execute(delete(NewsEntityLink))

    player_links = 0
    team_links = 0
    now = int(time.time())
    for item in items:
        team_scores = _score_teams(item)
        team_methods = {team: "direct_team_mention" for team in team_scores}
        for player_id, relevance in (item.players or {}).items():
            player = players_by_id.get(player_id)
            if not player:
                continue
            signals = _classify_signals(_player_context(item, player.full_name))
            if item.source in {"fantasypros", "sleeper-trends"}:
                correlation_method = "provider_player_id"
            else:
                correlation_method = "direct_player_mention"
            session.add(NewsEntityLink(
                link_id=hashlib.sha1(f"{item.news_id}|player|{player_id}".encode()).hexdigest(),
                news_id=item.news_id,
                entity_type="player",
                entity_id=player_id,
                entity_name=player.full_name,
                team=player.team,
                relevance_score=float(relevance),
                correlation_method=correlation_method,
                signals=signals,
                created_at=now,
            ))
            player_links += 1
            if player.team and player.team not in team_scores:
                team_scores[player.team] = min(float(relevance) * 0.35, 1.5)
                team_methods[player.team] = "player_team_inference"

        article_signals = _classify_signals(f"{item.title}. {item.summary or ''}")
        for team, relevance in team_scores.items():
            session.add(NewsEntityLink(
                link_id=hashlib.sha1(f"{item.news_id}|team|{team}".encode()).hexdigest(),
                news_id=item.news_id,
                entity_type="team",
                entity_id=team,
                entity_name=team,
                team=team,
                relevance_score=relevance,
                correlation_method=team_methods[team],
                signals=article_signals,
                created_at=now,
            ))
            team_links += 1

    source_rows = (
        await session.execute(
            select(
                NewsItem.source,
                func.count(NewsItem.news_id),
                func.min(NewsItem.published_at),
                func.max(NewsItem.published_at),
                func.max(NewsItem.created_at),
            ).group_by(NewsItem.source)
        )
    ).all()
    for source_id, article_count, first_published, last_published, last_created in source_rows:
        catalog = _SOURCE_CATALOG.get(source_id, {})
        source = await session.get(NewsSource, source_id)
        values = {
            "name": catalog.get("name", source_id.upper()),
            "homepage_url": catalog.get("homepage_url"),
            "source_type": catalog.get("source_type", "publisher"),
            "reliability_tier": catalog.get("reliability_tier", "context"),
            "is_active": True,
            "article_count": article_count,
            "first_published_at": first_published,
            "last_published_at": last_published,
            # Correlation-only rebuilds do not count as successful provider
            # refreshes. Preserve known health, or derive it from stored data
            # when creating a source row for the first time.
            "last_ingested_at": source.last_ingested_at if source else (last_created or now),
            "metadata_json": catalog.get("metadata_json", {}),
        }
        if source:
            for key, value in values.items():
                setattr(source, key, value)
        else:
            session.add(NewsSource(source_id=source_id, **values))
    await session.commit()
    return {"player_links": player_links, "team_links": team_links, "sources": len(source_rows)}


async def _mark_sources_ingested(
    session: AsyncSession, source_ids: list[str]
) -> None:
    """Record successful provider refreshes without touching failed sources."""
    now = int(time.time())
    for source_id in source_ids:
        source = await session.get(NewsSource, source_id)
        if source:
            source.last_ingested_at = now
    await session.commit()


def _normalize_sleeper_trend(record: dict[str, Any]) -> dict[str, Any]:
    """Represent a Sleeper roster action snapshot as evidence, not editorial news."""
    fetched_at = int(record["fetched_at"])
    bucket = fetched_at - (fetched_at % 3600)
    player_id = str(record["sleeper_player_id"])
    direction = str(record["direction"])
    lookback = int(record["lookback_hours"])
    count = int(record["count"])
    name = record.get("player") or f"Sleeper player {player_id}"
    identity = f"sleeper-trends|{direction}|{player_id}|{lookback}|{bucket}"
    term = "trending add" if direction == "add" else "trending drop"
    action = "roster adds" if direction == "add" else "roster drops"
    return {
        "news_id": hashlib.sha1(identity.encode()).hexdigest(),
        "published_at": fetched_at * 1000,
        "source": "sleeper-trends",
        "url": (
            f"https://sleeper.app/embed/players/nfl/trending/{direction}"
            f"?lookback_hours={lookback}&limit=25#{player_id}-{bucket}"
        ),
        "title": f"{name}: Sleeper {term}",
        "summary": (
            f"{count:,} {action} in Sleeper over the last {lookback} hours. "
            f"This is a {term} market signal, not a performance projection."
        ),
        "story": "",
        "players": {},
        "keywords": [term, action, "Sleeper"],
        "player_ids": {"sleeper": [player_id]},
        "team_ids": {"sleeper": [record["team"]] if record.get("team") else []},
        "created_at": fetched_at,
    }


async def _persist_news_records(
    session: AsyncSession,
    records: list[dict[str, Any]],
    *,
    delete_existing: bool = False,
) -> dict[str, int]:
    """Persist normalized records with explicit-ID matching before text fallback."""
    players = list((await session.execute(select(Player))).scalars().all())
    player_index = _build_player_index(players)
    by_sleeper = {
        str(player.sleeper_id): player.player_id
        for player in players
        if player.sleeper_id
    }
    projection_rows = list((await session.execute(
        select(PlayerRanking).where(
            PlayerRanking.source == "fantasypros-projection",
            PlayerRanking.player_id.is_not(None),
        )
    )).scalars().all())
    by_fantasypros: dict[str, str] = {}
    for row in projection_rows:
        external_id = str((row.raw or {}).get("fantasypros_id") or "")
        if external_id and row.player_id:
            by_fantasypros[external_id] = row.player_id

    existing_urls = set((await session.execute(select(NewsItem.url))).scalars().all())
    existing_ids = set((await session.execute(select(NewsItem.news_id))).scalars().all())
    if delete_existing:
        await session.execute(delete(NewsEntityLink))
        await session.execute(delete(NewsItem))
        existing_urls.clear()
        existing_ids.clear()

    stored = 0
    skipped_duplicate = 0
    total_mentions = 0
    for raw_record in records:
        record = dict(raw_record)
        if record.get("news_id") in existing_ids or record.get("url") in existing_urls:
            skipped_duplicate += 1
            continue
        record.setdefault("story", "")
        record.setdefault("summary", "")
        record.setdefault("keywords", record.get("categories") or [])
        scores = dict(record.get("players") or {})
        explicit_ids = record.get("player_ids") or {}
        for external_id in explicit_ids.get("fantasypros", []):
            if canonical_id := by_fantasypros.get(str(external_id)):
                scores[canonical_id] = max(scores.get(canonical_id, 0.0), 7.0)
        for external_id in explicit_ids.get("sleeper", []):
            if canonical_id := by_sleeper.get(str(external_id)):
                scores[canonical_id] = max(scores.get(canonical_id, 0.0), 5.0)
        # Text matching fills gaps for RSS articles and for relevant players
        # absent from a provider-ID crosswalk.
        for player_id, relevance in _score_players(record, player_index).items():
            scores[player_id] = max(scores.get(player_id, 0.0), relevance)
        record["players"] = scores
        total_mentions += len(scores)
        created_at = int(record.get("created_at") or time.time())
        session.add(NewsItem(
            news_id=record["news_id"],
            published_at=int(record["published_at"]),
            source=record["source"],
            url=record["url"],
            title=record["title"],
            summary=record["summary"],
            story=record["story"],
            players=scores,
            dedupe_hash=record["news_id"],
            created_at=created_at,
        ))
        existing_ids.add(record["news_id"])
        existing_urls.add(record["url"])
        stored += 1
    await session.flush()
    return {
        "loaded": stored,
        "skipped_duplicate": skipped_duplicate,
        "player_mentions": total_mentions,
    }


async def ingest_all_news_sources(
    *,
    limit: int = 50,
    force_refresh: bool = False,
    session: AsyncSession | None = None,
    espn_provider: ESPNNewsProvider | None = None,
    fantasypros_client: Any | None = None,
    pff_provider: Any | None = None,
    sleeper_provider: Any | None = None,
) -> dict[str, Any]:
    """Fetch independent providers concurrently, then serialize SQLite writes."""
    from .fantasypros_news import fetch_fantasypros_news
    from .pff_news import PFFRSSProvider
    from .sleeper_trends import SleeperTrendingProvider

    async def _run(active_session: AsyncSession) -> dict[str, Any]:
        players = list((await active_session.execute(select(Player))).scalars().all())
        sleeper_directory = {
            str(player.sleeper_id): {
                "full_name": player.full_name,
                "team": player.team,
                "position": player.position,
            }
            for player in players
            if player.sleeper_id
        }
        provider_calls = {
            "espn": asyncio.to_thread(
                _load_espn_records, espn_provider or ESPNNewsProvider(limit=limit)
            ),
            "fantasypros": fetch_fantasypros_news(
                limit=limit,
                force_refresh=force_refresh,
                client=fantasypros_client,
            ),
            "pff": asyncio.to_thread(
                (pff_provider or PFFRSSProvider()).load_articles
            ),
            "sleeper-trends": asyncio.to_thread(
                (sleeper_provider or SleeperTrendingProvider()).load_trends,
                lookback_hours=24,
                limit=min(limit, 50),
                player_directory=sleeper_directory,
            ),
        }
        fetched = await asyncio.gather(*provider_calls.values(), return_exceptions=True)
        results: dict[str, Any] = {}
        for source, value in zip(provider_calls, fetched, strict=True):
            if isinstance(value, BaseException):
                results[source] = {"error": str(value)}
                continue
            if source == "fantasypros":
                records = value["items"]
                provider_meta = {
                    "cache_status": value["cache_status"],
                    "fetched_at": value["fetched_at"],
                }
            elif source == "sleeper-trends":
                records = [_normalize_sleeper_trend(record) for record in value]
                provider_meta = {"attribution": "Trending data provided by Sleeper"}
            else:
                records = value[:limit]
                provider_meta = {}
            persisted = await _persist_news_records(active_session, records)
            results[source] = {**persisted, **provider_meta}
        correlations = await rebuild_news_correlations(active_session)
        await _mark_sources_ingested(
            active_session,
            [source for source in provider_calls if not results[source].get("error")],
        )
        results["correlations"] = correlations
        return results

    if session is not None:
        return await _run(session)
    async with SessionLocal() as active_session:
        return await _run(active_session)


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
    records = _load_espn_records(provider)

    async def _run(session) -> tuple[int, int, int, dict[str, int]]:
        persisted = await _persist_news_records(
            session, records, delete_existing=delete_existing
        )
        correlations = await rebuild_news_correlations(session)
        await _mark_sources_ingested(session, ["espn"])
        return (
            persisted["loaded"],
            persisted["skipped_duplicate"],
            persisted["player_mentions"],
            correlations,
        )

    if session is not None:
        stored, skipped_duplicate, total_mentions, correlations = await _run(session)
    else:
        async with SessionLocal() as session:
            stored, skipped_duplicate, total_mentions, correlations = await _run(session)

    return {
        "loaded": stored,
        "skipped_duplicate": skipped_duplicate,
        "player_mentions": total_mentions,
        "source": "espn",
        "correlations": correlations,
    }
