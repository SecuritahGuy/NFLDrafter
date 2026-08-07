import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.models import ApiResponseCache, Base
from app.services import fantasypros_api
from app.services.fantasypros_api import FantasyProsAPIError, FantasyProsClient
from app.services.fantasypros_projections import _parse_player


@pytest.mark.asyncio
async def test_fantasypros_client_persists_and_reuses_cache(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(fantasypros_api, "SessionLocal", sessions)
    calls = []

    def fake_request(url, api_key):
        calls.append((url, api_key))
        return {"players": [{"name": "Cached Player"}]}, 200, {"x-ratelimit-remaining": "49"}

    monkeypatch.setattr(fantasypros_api, "_request_json", fake_request)
    client = FantasyProsClient(api_key="test-key", default_ttl_seconds=3600)

    first = await client.projections(2026, position="WR")
    second = await client.projections(2026, position="WR")

    assert first.cache_status == "miss"
    assert second.cache_status == "fresh"
    assert second.data == first.data
    assert second.response_headers["x-ratelimit-remaining"] == "49"
    assert len(calls) == 1
    assert "test-key" not in calls[0][0]
    await engine.dispose()


@pytest.mark.asyncio
async def test_fantasypros_client_serves_stale_on_provider_failure(monkeypatch):
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    sessions = async_sessionmaker(engine, expire_on_commit=False)
    monkeypatch.setattr(fantasypros_api, "SessionLocal", sessions)
    monkeypatch.setattr(
        fantasypros_api, "_request_json",
        lambda *_: ({"players": [{"name": "Stale Player"}]}, 200, {}),
    )
    client = FantasyProsClient(api_key="test-key", default_ttl_seconds=-1)
    await client.projections(2026, position="RB")

    def fail(*_):
        raise FantasyProsAPIError("quota exhausted")

    monkeypatch.setattr(fantasypros_api, "_request_json", fail)
    stale = await client.projections(2026, position="RB")

    assert stale.cache_status == "stale"
    assert stale.data["players"][0]["name"] == "Stale Player"
    await engine.dispose()


def test_parse_fantasypros_projection_maps_full_stat_line():
    parsed = _parse_player({
        "fpid": 22968,
        "name": "Jahmyr Gibbs",
        "position_id": "RB",
        "team_id": "DET",
        "stats": {
            "points": 301.72,
            "points_ppr": 372.65,
            "rush_att": 274.4,
            "rush_yds": 1381.36,
            "rec_rec": 70.93,
            "rec_yds": 580.62,
        },
    })

    assert parsed["fantasypros_id"] == "22968"
    assert parsed["projected_points"] == 372.65
    assert parsed["projected_stats"]["carries"] == 274.4
    assert parsed["projected_stats"]["receptions"] == 70.93
