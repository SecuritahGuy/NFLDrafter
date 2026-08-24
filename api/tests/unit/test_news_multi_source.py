import asyncio
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import Base, NewsEntityLink, NewsItem, NewsSource, Player, PlayerRanking
from app.services.news import ingest_all_news_sources


class FakeESPN:
    def load_articles(self):
        return [{
            "id": 1,
            "headline": "Star Player impresses in camp",
            "description": "ESPN summary",
            "published": "2026-08-24T12:00:00Z",
        }]

    def load_story(self, article):
        return {
            "published": "2026-08-24T12:00:00Z",
            "story": "Star Player impressed with the first team.",
            "keywords": ["Star Player"],
        }


class FakeFantasyProsClient:
    async def get_json(self, *args, **kwargs):
        return SimpleNamespace(
            data={"items": [{
                "id": 2,
                "created": "2026-08-24 13:00:00",
                "title": "Star Player earns a starting role",
                "desc": "A structured update.",
                "impact": "More targets may follow.",
                "link": "https://www.fantasypros.com/nfl/news/2/star-player.php",
                "player_id": "fp-1",
                "team_id": "TB",
            }]},
            fetched_at=1_777_000_000,
            cache_status="miss",
        )


class FakePFF:
    def load_articles(self):
        return [{
            "news_id": "pff-1",
            "published_at": 1_777_000_100_000,
            "source": "pff",
            "url": "https://www.pff.com/news/star-player",
            "title": "Star Player looks like a breakout",
            "summary": "The emerging player has more targets.",
            "story": "",
            "players": {},
            "keywords": ["NFL"],
        }]


class FakeSleeper:
    def load_trends(self, **kwargs):
        return [{
            "direction": "add",
            "lookback_hours": 24,
            "count": 1234,
            "sleeper_player_id": "sl-1",
            "player": "Star Player",
            "team": "TB",
            "position": "WR",
            "fetched_at": 1_777_000_200,
        }]


def test_all_news_sources_fetch_and_persist_with_explicit_identity_links():
    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        sessions = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with sessions() as session:
            session.add(Player(
                player_id="pid-1",
                full_name="Star Player",
                position="WR",
                team="TB",
                sleeper_id="sl-1",
            ))
            session.add(PlayerRanking(
                ranking_id="fp-map",
                player_id="pid-1",
                full_name="Star Player",
                position="WR",
                team="TB",
                source="fantasypros-projection",
                rank_type="preseason",
                scoring="PPR",
                season=2026,
                rank=100,
                snapshot_date="2026-08-24",
                snapshot_ts=1_777_000_000_000,
                raw={"fantasypros_id": "fp-1"},
            ))
            await session.commit()

            result = await ingest_all_news_sources(
                limit=10,
                session=session,
                espn_provider=FakeESPN(),
                fantasypros_client=FakeFantasyProsClient(),
                pff_provider=FakePFF(),
                sleeper_provider=FakeSleeper(),
            )
            items = list((await session.execute(select(NewsItem))).scalars().all())
            sources = list((await session.execute(select(NewsSource))).scalars().all())
            links = list((await session.execute(select(NewsEntityLink))).scalars().all())
        await engine.dispose()
        return result, items, sources, links

    result, items, sources, links = asyncio.run(run())
    assert {item.source for item in items} == {
        "espn", "fantasypros", "pff", "sleeper-trends"
    }
    assert {source.source_id for source in sources} == {
        "espn", "fantasypros", "pff", "sleeper-trends"
    }
    assert result["fantasypros"]["loaded"] == 1
    assert result["sleeper-trends"]["attribution"] == "Trending data provided by Sleeper"
    explicit = [
        link for link in links
        if link.entity_type == "player"
        and link.correlation_method == "provider_player_id"
    ]
    assert {link.entity_id for link in explicit} == {"pid-1"}
