"""News endpoints: browse ingested news, full-text search, and per-player
news features aggregated from the article ``players`` scoring."""
import time

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import DATABASE_URL
from ..deps import get_db_session
from ..models import NewsItem, Player

router = APIRouter(prefix="/news", tags=["news"])


def _news_dict(item: NewsItem) -> dict:
    return {
        "news_id": item.news_id,
        "published_at": item.published_at,
        "source": item.source,
        "url": item.url,
        "title": item.title,
        "summary": item.summary,
        "players": item.players or {},
        "created_at": item.created_at,
    }


@router.get("/")
async def list_news(
    player_id: str = Query(None, description="Only articles mentioning this player"),
    source: str = Query(None, description="Source identifier (e.g. espn)"),
    min_score: float = Query(None, ge=0, description="Min relevance score for the player filter"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
):
    """List recent news items, most recent first."""
    stmt = select(NewsItem)
    if source:
        stmt = stmt.where(NewsItem.source == source)
    if player_id:
        if min_score:
            stmt = stmt.where(NewsItem.players[player_id].as_float() >= min_score)
        else:
            stmt = stmt.where(NewsItem.players[player_id].as_float().is_not(None))
    stmt = stmt.order_by(NewsItem.published_at.desc()).limit(limit)
    result = await db.execute(stmt)
    items = [_news_dict(i) for i in result.scalars().all()]
    return {"count": len(items), "news": items}


@router.get("/search")
async def search_news(
    q: str = Query(..., min_length=1, description="Full-text search query"),
    player_id: str = Query(None, description="Only articles mentioning this player"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db_session),
):
    """Full-text search over news titles and summaries (SQLite FTS5)."""
    if "sqlite" not in DATABASE_URL:
        raise HTTPException(status_code=503, detail="FTS search requires SQLite")

    # Escape FTS5 special characters to treat input as a phrase match.
    escaped = q.replace('"', '""')
    match = f'"{escaped}"'

    sql = text(
        """
        SELECT n.* FROM news_items n
        JOIN news_items_fts f ON f.rowid = n.rowid
        WHERE news_items_fts MATCH :match
        ORDER BY n.published_at DESC
        LIMIT :limit
        """
    )
    stmt = select(NewsItem).from_statement(sql)
    result = await db.execute(stmt, {"match": match, "limit": limit})
    items = [_news_dict(i) for i in result.scalars().all()]
    return {"query": q, "count": len(items), "news": items}


@router.get("/players/{player_id}/features")
async def player_news_features(
    player_id: str,
    days: int = Query(30, ge=1, le=365, description="Look-back window in days"),
    db: AsyncSession = Depends(get_db_session),
):
    """Aggregated news features for a player from article relevance scoring.

    Returns mention volume, cumulative relevance, recency-weighted score, and
    the top headlines, all within the look-back window.
    """
    player = (
        await db.execute(select(Player).where(Player.player_id == player_id))
    ).scalar_one_or_none()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    cutoff_ms = (int(time.time()) - days * 86400) * 1000
    result = await db.execute(
        select(NewsItem)
        .where(
            NewsItem.players[player_id].as_float().is_not(None),
            NewsItem.published_at >= cutoff_ms,
        )
        .order_by(NewsItem.published_at.desc())
    )
    items = result.scalars().all()

    now_ms = int(time.time()) * 1000
    total_relevance = 0.0
    recency_weighted = 0.0
    headlines = []
    for item in items:
        score = (item.players or {}).get(player_id, 0.0)
        total_relevance += score
        age_days = max((now_ms - item.published_at) / 86400000.0, 0.001)
        recency_weighted += score / age_days
        headlines.append(
            {
                "title": item.title,
                "url": item.url,
                "published_at": item.published_at,
                "score": score,
            }
        )

    return {
        "player_id": player_id,
        "full_name": player.full_name,
        "position": player.position,
        "team": player.team,
        "days": days,
        "article_count": len(items),
        "total_relevance": round(total_relevance, 2),
        "recency_weighted_score": round(recency_weighted, 2),
        "headlines": headlines[:20],
    }
