import asyncio
import time

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base, NewsEntityLink, NewsItem, Player, PlayerRanking
from app.services.news_insights import build_sleeper_insights


def test_sleeper_insights_reward_direct_opportunity_and_dilute_roundups():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        now_ms = int(time.time()) * 1000
        async with sessions() as db:
            db.add(Player(player_id="late-wr", full_name="Late Receiver", position="WR", team="TB"))
            db.add(PlayerRanking(
                ranking_id="late-adp", player_id="late-wr", full_name="Late Receiver",
                position="WR", team="TB", source="ffc-adp", rank_type="preseason",
                scoring="PPR", season=2026, rank=108, ecr=108.0,
                snapshot_date="2026-08-24", snapshot_ts=now_ms,
            ))
            db.add(NewsItem(
                news_id="story", published_at=now_ms, source="espn", url="https://example.com/story",
                title="Late Receiver earns first-team role", summary="More targets are coming",
                story="", players={"late-wr": 6.0}, dedupe_hash="story", created_at=int(time.time()),
            ))
            db.add(NewsEntityLink(
                link_id="link", news_id="story", entity_type="player", entity_id="late-wr",
                entity_name="Late Receiver", team="TB", relevance_score=6.0,
                correlation_method="direct_player_mention",
                signals={"topics": ["opportunity"], "opportunity_score": 1.0,
                         "performance_score": 0.0, "risk_score": 0.0},
                created_at=int(time.time()),
            ))
            await db.commit()
            result = await build_sleeper_insights(db, season=2026, min_adp=72)
        await engine.dispose()
        return result

    result = asyncio.run(run())
    assert result["candidates"][0]["player_id"] == "late-wr"
    assert result["candidates"][0]["likely_round"] == 9
    assert result["candidates"][0]["confidence"] == "limited"
