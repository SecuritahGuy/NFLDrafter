"""Background ingestion scheduler for rankings and injuries.

Uses APScheduler's AsyncIOScheduler, which was already declared in
pyproject.toml. Jobs default to weekly refreshes; the schedule can be
overridden with the env vars RANKINGS_SCHEDULE_CRON and INJURIES_SCHEDULE_CRON.
"""

from __future__ import annotations

import os

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from . import injuries as injuries_service
from . import rankings as rankings_service
from .fantasypros_projections import ingest_fantasypros_projections

DEFAULT_CRON = "15 9 * * 3"  # 9:15am UTC Wednesdays (after injury report cycles)


def _cron_from_env(name: str) -> str:
    return os.getenv(name, DEFAULT_CRON)


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
        refresh_rankings_job,
        CronTrigger.from_crontab(_cron_from_env("RANKINGS_SCHEDULE_CRON")),
        id="refresh-preseason-rankings",
        name="Refresh preseason ECR rankings",
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
