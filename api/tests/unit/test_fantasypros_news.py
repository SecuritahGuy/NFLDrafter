from types import SimpleNamespace

import pytest
from app.services.fantasypros_news import (
    fetch_fantasypros_news,
    normalize_fantasypros_news_item,
)


def test_normalize_fantasypros_news_item_maps_provider_ids_and_editorial_fields():
    record = normalize_fantasypros_news_item({
        "id": 604020,
        "created": "2026-08-24 19:09:04",
        "author": "Ari Koslow",
        "player_id": 22989,
        "team_id": "ne",
        "title": " Kayshon Boutte traded to Texans ",
        "categories": ["News", "Commentary", "News"],
        "link": "http://www.fantasypros.com/nfl/news/604020/story.php?utm=x#top",
        "desc": "  Trade summary. ",
        "impact": " Fantasy impact. ",
    })

    assert record is not None
    assert record["source_record_id"] == "fantasypros:nfl-news:604020"
    assert len(record["news_id"]) == 40
    assert record["published_at"] == 1787598544000
    assert record["url"] == "https://www.fantasypros.com/nfl/news/604020/story.php"
    assert record["player_ids"] == {"fantasypros": ["22989"]}
    assert record["team_ids"] == {"fantasypros": ["NE"]}
    assert record["summary"] == "Trade summary."
    assert record["story"] == "Fantasy impact."
    assert record["categories"] == ["Commentary", "News"]


@pytest.mark.parametrize("item", [None, "bad", {}, {"id": 1, "title": "No date"}])
def test_normalize_fantasypros_news_item_skips_unusable_records(item):
    assert normalize_fantasypros_news_item(item) is None


@pytest.mark.asyncio
async def test_fetch_fantasypros_news_uses_client_and_returns_safe_deduplicated_batch():
    calls = []

    class FakeClient:
        api_key = "must-never-leak"

        async def get_json(self, endpoint, **kwargs):
            calls.append((endpoint, kwargs))
            return SimpleNamespace(
                data={"items": [
                    {
                        "id": 2,
                        "created": 1_800_000_000,
                        "title": "Newest",
                        "player_id": "22",
                    },
                    {"id": 1, "created": 1_700_000_000_000, "title": "Older"},
                    {"id": 2, "created": 1_800_000_000, "title": "Duplicate"},
                    {"id": 3, "title": "Missing timestamp"},
                ]},
                fetched_at=1_800_000_001,
                cache_status="fresh",
            )

    batch = await fetch_fantasypros_news(
        limit=500, client=FakeClient(), force_refresh=True
    )

    assert calls == [("/nfl/news", {
        "params": {"limit": 100},
        "ttl_seconds": 21600,
        "force_refresh": True,
        "cache_only": False,
    })]
    assert [item["title"] for item in batch["items"]] == ["Newest", "Older"]
    assert batch["skipped"] == 2
    assert batch["source"]["source_id"] == "fantasypros"
    assert "must-never-leak" not in repr(batch)


@pytest.mark.asyncio
async def test_fetch_fantasypros_news_tolerates_unexpected_provider_shape():
    class FakeClient:
        async def get_json(self, *_args, **_kwargs):
            return SimpleNamespace(
                data={"items": {"not": "a list"}},
                fetched_at=123,
                cache_status="stale",
            )

    batch = await fetch_fantasypros_news(client=FakeClient())

    assert batch["items"] == []
    assert batch["skipped"] == 0
    assert batch["cache_status"] == "stale"
