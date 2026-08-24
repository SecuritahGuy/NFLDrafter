from unittest.mock import AsyncMock

import pytest

from app.services import scheduler as scheduler_service


@pytest.mark.asyncio
async def test_refresh_draft_sources_calls_every_provider(monkeypatch):
    fantasypros = AsyncMock(return_value={"loaded": 300})
    espn = AsyncMock(return_value={"loaded": 250})
    ffc = AsyncMock(return_value={"loaded": 200})
    monkeypatch.setattr(scheduler_service.rankings_service, "ingest_rankings", fantasypros)
    monkeypatch.setattr(scheduler_service, "ingest_espn_rankings", espn)
    monkeypatch.setattr(scheduler_service, "ingest_ffc_adp", ffc)
    monkeypatch.setenv("NFL_SEASON", "2026")
    monkeypatch.setenv("DRAFT_SCORING", "PPR")
    monkeypatch.setenv("DRAFT_LEAGUE_SIZE", "12")

    result = await scheduler_service.refresh_draft_sources_job()

    fantasypros.assert_awaited_once_with(rank_type="preseason")
    espn.assert_awaited_once_with(season=2026, scoring="PPR")
    ffc.assert_awaited_once_with(season=2026, scoring="PPR", teams=12)
    assert result == {
        "fantasypros-ecr": {"loaded": 300},
        "espn-draft-rank": {"loaded": 250},
        "ffc-adp": {"loaded": 200},
    }


@pytest.mark.asyncio
async def test_refresh_draft_sources_isolates_provider_failures(monkeypatch):
    fantasypros = AsyncMock(return_value={"loaded": 300})
    espn = AsyncMock(side_effect=RuntimeError("ESPN unavailable"))
    ffc = AsyncMock(return_value={"loaded": 200})
    monkeypatch.setattr(scheduler_service.rankings_service, "ingest_rankings", fantasypros)
    monkeypatch.setattr(scheduler_service, "ingest_espn_rankings", espn)
    monkeypatch.setattr(scheduler_service, "ingest_ffc_adp", ffc)

    result = await scheduler_service.refresh_draft_sources_job()

    assert result["espn-draft-rank"] == {"error": "ESPN unavailable"}
    assert result["fantasypros-ecr"] == {"loaded": 300}
    assert result["ffc-adp"] == {"loaded": 200}
    ffc.assert_awaited_once()


@pytest.mark.asyncio
async def test_refresh_all_sources_includes_projections_and_injuries(monkeypatch):
    draft_sources = AsyncMock(return_value={"fantasypros-ecr": {"loaded": 300}})
    projections = AsyncMock(return_value={"loaded": 60})
    injuries = AsyncMock(return_value={"loaded": {"2025": 100}})
    players = AsyncMock(return_value=1000)
    weekly = AsyncMock(return_value={2025: 5000})
    usage = AsyncMock(return_value={2025: 1000})
    schedules = AsyncMock(return_value={"loaded": 160})
    sleeper = AsyncMock(return_value={"loaded": 1000})
    news = AsyncMock(return_value={"loaded": 20})
    monkeypatch.setattr(scheduler_service, "refresh_draft_sources_job", draft_sources)
    monkeypatch.setattr(scheduler_service, "ingest_fantasypros_projections", projections)
    monkeypatch.setattr(scheduler_service.injuries_service, "ingest_injuries", injuries)
    monkeypatch.setattr(scheduler_service, "seed_players_and_ids", players)
    monkeypatch.setattr(scheduler_service, "ingest_weekly_stats", weekly)
    monkeypatch.setattr(scheduler_service, "ingest_usage_stats", usage)
    monkeypatch.setattr(scheduler_service, "refresh_schedule_strength_cache", schedules)
    monkeypatch.setattr(scheduler_service, "backfill_sleeper_ids", sleeper)
    monkeypatch.setattr(scheduler_service, "ingest_news", news)
    monkeypatch.setenv("NFL_SEASON", "2026")

    result = await scheduler_service.refresh_all_sources_job(force=True)

    projections.assert_awaited_once_with(season=2026, force_refresh=True)
    injuries.assert_awaited_once_with()
    weekly.assert_awaited_once_with([2025])
    usage.assert_awaited_once_with([2025])
    assert result["fantasypros-projection"] == {"loaded": 60}
    assert result["nflverse-injuries"] == {"loaded": {"2025": 100}}


def test_scheduler_registers_daily_draft_source_job(monkeypatch):
    monkeypatch.setenv("DRAFT_SOURCES_SCHEDULE_CRON", "30 10 * * *")

    configured = scheduler_service.create_scheduler()
    job = configured.get_job("refresh-draft-sources")

    assert job is not None
    assert job.name == "Refresh daily FantasyPros, ESPN, and FFC draft rankings"
    assert str(job.trigger) == "cron[month='*', day='*', day_of_week='*', hour='10', minute='30']"
