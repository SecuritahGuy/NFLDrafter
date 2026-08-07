import pytest
from app.services.news import (
    _parse_news_record,
    _score_players,
    _strip_html,
    ingest_news,
)


def test_strip_html_removes_tags_and_unescapes():
    assert _strip_html("<p>Hello &amp; <b>world</b></p>") == "Hello & world"


def test_parse_news_record_extracts_fields_and_defaults_url():
    article = {
        "id": 12345,
        "headline": "Some headline",
        "description": "A short summary",
        "published": "2026-08-01T12:00:00Z",
    }
    story = {"keywords": ["NFL", "Some Team"], "story": "<p>Body text</p>"}
    rec = _parse_news_record(article, story)
    assert rec is not None
    assert rec["news_id"] == _parse_news_record(article, story)["news_id"]
    assert rec["published_at"] == 1785585600000  # 2026-08-01T12:00:00Z epoch ms
    assert rec["url"].startswith("https://content.core.api.espn.com")
    assert rec["story"] == "Body text"
    assert "keywords" in rec


def test_parse_news_record_skips_missing_headline_and_date():
    assert _parse_news_record({"id": 1, "description": "x"}, {}) is None
    assert (
        _parse_news_record(
            {"id": 1, "headline": "h", "published": "not-a-date"}, {}
        )
        is None
    )


def test_score_players_boosts_keywords_and_headline():
    player_index = {"some player": [("pid-1", "Some Player")]}
    rec = {
        "title": "Some Player signs extension",
        "story": "Some Player is staying with the team.",
        "keywords": ["Some Player", "NFL"],
    }
    scores = _score_players(rec, player_index)
    assert scores["pid-1"] == pytest.approx(
        1.0 + 3.0 + 2.0
    )  # mention + headline + keyword


def test_score_players_ignores_unmentioned_players():
    player_index = {"other player": [("pid-2", "Other Player")]}
    rec = {"title": "No match here", "story": "No one mentioned.", "keywords": []}
    assert _score_players(rec, player_index) == {}


class FakeProvider:
    def __init__(self):
        self.articles = [
            {
                "id": 1,
                "headline": "Star Player out with injury",
                "description": "desc",
                "published": "2026-08-01T12:00:00Z",
            }
        ]
        self.stories = {
            1: {
                "keywords": ["Star Player"],
                "story": "Star Player suffered an injury in practice.",
                "published": "2026-08-01T12:00:00Z",
            }
        }

    def load_articles(self):
        return self.articles

    def load_story(self, article):
        return self.stories[article["id"]]


def test_ingest_news_stores_scored_items_and_is_idempotent():
    import asyncio

    from app.models import Base, NewsItem, Player
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    async def run():
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        test_sessionmaker = async_sessionmaker(engine, expire_on_commit=False)
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        async with test_sessionmaker() as s:
            s.add(
                Player(
                    player_id="pid-1",
                    full_name="Star Player",
                    position="RB",
                    team="TB",
                )
            )
            await s.commit()

            first = await ingest_news(provider=FakeProvider(), session=s)
            second = await ingest_news(provider=FakeProvider(), session=s)

            items = list((await s.execute(select(NewsItem))).scalars().all())
            assert len(items) == 1
            assert items[0].players == {"pid-1": pytest.approx(6.0)}

        await engine.dispose()
        return first, second

    first, second = asyncio.run(run())
    assert first["loaded"] == 1
    assert second["loaded"] == 0
    assert second["skipped_duplicate"] == 1
