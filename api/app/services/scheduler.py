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
from .news import ingest_news
from .nflverse import ingest_usage_stats, ingest_weekly_stats, seed_players_and_ids
from .schedule_strength import refresh_schedule_strength_cache
from .sleeper import backfill_sleeper_ids

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


async def refresh_all_sources_job(*, force: bool = False) -> dict[str, dict]:
    """Refresh every feed used by the draft-room player board.

    Provider failures are isolated so one unavailable service still leaves the
    other sources fresh. Manual refreshes force the FantasyPros projection
    cache to make a network request; scheduled refreshes may reuse valid cache.
    """
    season = int(os.getenv("NFL_SEASON", "2026"))
    baseline_season = int(os.getenv("STATS_BASELINE_SEASON", str(season - 1)))
    results: dict[str, dict] = {}
    foundation_jobs = (
        ("nflverse-players", seed_players_and_ids),
        ("nflverse-weekly-stats", lambda: ingest_weekly_stats([baseline_season])),
        ("nflverse-usage", lambda: ingest_usage_stats([baseline_season])),
        ("nflverse-schedule-strength", lambda: refresh_schedule_strength_cache(season)),
        ("sleeper-player-ids", backfill_sleeper_ids),
        (
            "espn-news",
            lambda: ingest_news(limit=int(os.getenv("NEWS_REFRESH_LIMIT", "20"))),
        ),
    )
    for source, ingest in foundation_jobs:
        try:
            result = await ingest()
            results[source] = result if isinstance(result, dict) else {"loaded": result}
        except Exception as exc:  # pragma: no cover - provider failures vary
            results[source] = {"error": str(exc)}
            print(f"{source} refresh failed: {exc}")

    results.update(await refresh_draft_sources_job())
    jobs = (
        (
            "fantasypros-projection",
            lambda: ingest_fantasypros_projections(season=season, force_refresh=force),
        ),
        ("nflverse-injuries", injuries_service.ingest_injuries),
    )
    for source, ingest in jobs:
        try:
            results[source] = await ingest()
        except Exception as exc:  # pragma: no cover - provider failures vary
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
