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


def test_scheduler_registers_daily_draft_source_job(monkeypatch):
    monkeypatch.setenv("DRAFT_SOURCES_SCHEDULE_CRON", "30 10 * * *")

    configured = scheduler_service.create_scheduler()
    job = configured.get_job("refresh-draft-sources")

    assert job is not None
    assert job.name == "Refresh daily FantasyPros, ESPN, and FFC draft rankings"
    assert str(job.trigger) == "cron[month='*', day='*', day_of_week='*', hour='10', minute='30']"
