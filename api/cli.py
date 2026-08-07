import asyncio
import uuid
import time
from typing import List
import typer
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal
from app.models import Player, PlayerWeekStat, ScoringProfile, ScoringRule
from app.scoring import get_default_scoring_profiles

cli = typer.Typer()


async def _seed_default_profiles():
    """Seed default scoring profiles"""
    async with SessionLocal() as session:
        # Check if profiles already exist
        existing = await session.execute(select(ScoringProfile))
        if existing.scalars().first():
            typer.echo("Default profiles already exist, skipping...")
            return
        
        default_profiles = get_default_scoring_profiles()
        current_time = int(time.time())
        
        for profile_name, rules in default_profiles.items():
            # Create profile
            profile_id = str(uuid.uuid4())
            profile = ScoringProfile(
                profile_id=profile_id,
                name=profile_name,
                description=f"Default {profile_name} scoring profile",
                is_public=True,
                created_at=current_time
            )
            session.add(profile)
            
            # Create rules for this profile
            for rule_data in rules:
                rule = ScoringRule(
                    rule_id=str(uuid.uuid4()),
                    profile_id=profile_id,
                    **rule_data
                )
                session.add(rule)
        
        await session.commit()
        typer.echo(f"Created {len(default_profiles)} default scoring profiles")


@cli.command()
def seed():
    """Seed the database with default scoring profiles"""
    typer.echo("Seeding default scoring profiles...")
    asyncio.run(_seed_default_profiles())
    typer.echo("Database seeding completed!")


@cli.command()
def seed_players():
    """Seed players from nflreadpy."""
    try:
        from app.services.nflverse import seed_players_and_ids
        typer.echo("Seeding players from nflreadpy...")
        
        async def _seed_players():
            count = await seed_players_and_ids()
            return count
        
        count = asyncio.run(_seed_players())
        typer.echo(f"Seeded {count} players")
        
    except ImportError:
        typer.echo("nflreadpy not installed. Install with: pip install nflreadpy")
        raise typer.Exit(1)


@cli.command()
def load_stats(
    seasons: str = typer.Argument("2023", help="Comma-separated list of seasons to load")
):
    """Load weekly stats for specified seasons"""
    try:
        from app.services.nflverse import ingest_weekly_stats
        typer.echo(f"Loading weekly stats for seasons: {seasons}")
        
        async def _load_stats():
            years = [int(y.strip()) for y in seasons.split(",")]
            results = await ingest_weekly_stats(years)
            return results
        
        results = asyncio.run(_load_stats())
        for season, count in results.items():
            typer.echo(f"Loaded {count} stat records for {season}")
        
    except ImportError:
        typer.echo("nflreadpy not installed. Install with: pip install nflreadpy")
        raise typer.Exit(1)


@cli.command()
def load_rankings(
    rank_type: str = typer.Argument(
        "preseason", help="Rankings type: 'preseason' (redraft ECR) or 'weekly' (in-season)"
    )
):
    """Load the latest expert consensus rankings snapshot."""
    try:
        from app.services.rankings import ingest_rankings
        typer.echo(f"Loading {rank_type} ECR rankings...")

        async def _load():
            return await ingest_rankings(rank_type=rank_type)

        result = asyncio.run(_load())
        typer.echo(
            f"Stored {result.get('loaded', 0)} rankings for snapshot "
            f"{result.get('snapshot_date')} ({result.get('type')}); "
            f"{result.get('moved', 0)} players moved vs previous snapshot"
        )
    except ImportError:
        typer.echo("nflreadpy not installed. Install with: pip install nflreadpy")
        raise typer.Exit(1)


@cli.command()
def load_draft_sources(
    season: int = typer.Option(2026, help="Season year"),
    scoring: str = typer.Option("PPR", help="STD, PPR, or SUPERFLEX"),
    teams: int = typer.Option(12, help="League size for ADP"),
):
    """Refresh FantasyPros ECR, ESPN draft ranks, and FFC ADP."""
    from app.services.espn_rankings import ingest_espn_rankings
    from app.services.ffc_rankings import ingest_ffc_adp
    from app.services.rankings import ingest_rankings

    async def _load_all():
        return {
            "fantasypros-ecr": await ingest_rankings(rank_type="preseason"),
            "espn-draft-rank": await ingest_espn_rankings(
                season=season, scoring=scoring
            ),
            "ffc-adp": await ingest_ffc_adp(
                season=season, scoring=scoring, teams=teams
            ),
        }

    typer.echo(f"Refreshing {season} {scoring} draft sources...")
    results = asyncio.run(_load_all())
    for source, result in results.items():
        typer.echo(
            f"{source}: {result.get('loaded', 0)} rows · "
            f"snapshot {result.get('snapshot_date')} · "
            f"{result.get('moved', 0)} moved"
        )


@cli.command()
def load_injuries(
    seasons: str = typer.Argument("", help="Comma-separated seasons to load (default: latest)")
):
    """Load weekly injury reports."""
    try:
        from app.services.injuries import ingest_injuries
        typer.echo("Loading injury reports...")

        async def _load():
            year_list = [int(y.strip()) for y in seasons.split(",") if y.strip()] if seasons else None
            return await ingest_injuries(seasons=year_list)

        result = asyncio.run(_load())
        loaded = result.get("loaded", {})
        for season, count in loaded.items():
            typer.echo(f"Loaded {count} injury records for {season}")
        if not loaded:
            typer.echo("No injury records loaded")
    except ImportError:
        typer.echo("nflreadpy not installed. Install with: pip install nflreadpy")
        raise typer.Exit(1)


@cli.command()
def load_news(
    limit: int = typer.Option(50, help="Max ESPN articles to fetch (ESPN caps at 50)"),
    replace: bool = typer.Option(False, help="Drop previously stored news before loading"),
):
    """Fetch the latest ESPN NFL news with player-relevance scoring."""
    from app.services.news import ingest_news

    async def _load():
        return await ingest_news(limit=limit, delete_existing=replace)

    typer.echo(f"Fetching up to {limit} ESPN news articles...")
    result = asyncio.run(_load())
    typer.echo(
        f"Stored {result.get('loaded', 0)} news items "
        f"({result.get('skipped_duplicate', 0)} dupes skipped) · "
        f"{result.get('player_mentions', 0)} player mentions scored"
    )


@cli.command()
def init():
    """Initialize the database and seed default data"""
    typer.echo("Initializing NFLDrafter database...")
    
    async def _init():
        from app.db import init_db
        await init_db()
    
    asyncio.run(_init())
    typer.echo("Database initialized successfully!")
    
    # Seed default profiles
    seed()


if __name__ == "__main__":
    cli()
