"""Background ingestion scheduler for rankings, projections, and injuries.

Uses APScheduler's AsyncIOScheduler, which was already declared in
pyproject.toml. Draft sources refresh daily so historical snapshots accumulate;
the remaining feeds default to weekly refreshes. Every schedule is configurable
through its corresponding ``*_SCHEDULE_CRON`` environment variable.
"""

from __future__ import annotations

import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from . import injuries as injuries_service
from . import rankings as rankings_service
from .espn_rankings import ingest_espn_rankings
from .ffc_rankings import ingest_ffc_adp
from .fantasypros_projections import ingest_fantasypros_projections

DEFAULT_CRON = "15 9 * * 3"  # 9:15am UTC Wednesdays (after injury report cycles)
DEFAULT_DRAFT_SOURCES_CRON = "15 11 * * *"  # 11:15am UTC daily


def _cron_from_env(name: str, default: str = DEFAULT_CRON) -> str:
    return os.getenv(name, default)


async def refresh_draft_sources_job() -> dict[str, dict]:
    """Capture every draft feed, without allowing one outage to block the rest."""
    season = int(os.getenv("NFL_SEASON", "2026"))
    scoring = os.getenv("DRAFT_SCORING", "PPR")
    teams = int(os.getenv("DRAFT_LEAGUE_SIZE", "12"))
    results: dict[str, dict] = {}

    jobs = (
        ("fantasypros-ecr", lambda: rankings_service.ingest_rankings(rank_type="preseason")),
        ("espn-draft-rank", lambda: ingest_espn_rankings(season=season, scoring=scoring)),
        ("ffc-adp", lambda: ingest_ffc_adp(season=season, scoring=scoring, teams=teams)),
    )
    for source, ingest in jobs:
        try:
            results[source] = await ingest()
        except Exception as exc:  # pragma: no cover - exact provider failures vary
            results[source] = {"error": str(exc)}
            print(f"{source} refresh failed: {exc}")

    return results


async def refresh_rankings_job() -> None:
    try:
        await rankings_service.ingest_rankings(rank_type="preseason")
    except Exception as exc:  # pragma: no cover - defensive in background job
        print(f"Rankings refresh failed: {exc}")


async def refresh_weekly_rankings_job() -> None:
    try:
        await rankings_service.ingest_rankings(rank_type="weekly")
    except Exception as exc:  # pragma: no cover - defensive in background job
        print(f"Weekly rankings refresh failed: {exc}")


async def refresh_injuries_job() -> None:
    try:
        await injuries_service.ingest_injuries()
    except Exception as exc:  # pragma: no cover - defensive in background job
        print(f"Injuries refresh failed: {exc}")


async def refresh_fantasypros_projections_job() -> None:
    try:
        await ingest_fantasypros_projections(season=int(os.getenv("NFL_SEASON", "2026")))
    except Exception as exc:  # pragma: no cover - defensive in background job
        print(f"FantasyPros projection refresh failed: {exc}")


def create_scheduler() -> AsyncIOScheduler:
    """Build and return a configured async scheduler (not yet started)."""
    scheduler = AsyncIOScheduler(timezone="UTC")

    scheduler.add_job(
        refresh_draft_sources_job,
        CronTrigger.from_crontab(
            _cron_from_env("DRAFT_SOURCES_SCHEDULE_CRON", DEFAULT_DRAFT_SOURCES_CRON)
        ),
        id="refresh-draft-sources",
        name="Refresh daily FantasyPros, ESPN, and FFC draft rankings",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        refresh_weekly_rankings_job,
        CronTrigger.from_crontab(_cron_from_env("WEEKLY_RANKINGS_SCHEDULE_CRON")),
        id="refresh-weekly-rankings",
        name="Refresh weekly ECR rankings",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        refresh_injuries_job,
        CronTrigger.from_crontab(_cron_from_env("INJURIES_SCHEDULE_CRON")),
        id="refresh-injuries",
        name="Refresh weekly injury reports",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        refresh_fantasypros_projections_job,
        CronTrigger.from_crontab(_cron_from_env("FANTASYPROS_PROJECTIONS_SCHEDULE_CRON")),
        id="refresh-fantasypros-projections",
        name="Refresh cached FantasyPros projections",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    return scheduler
