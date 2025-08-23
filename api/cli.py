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
    """Seed players from nfl_data_py (requires nfl_data_py to be installed)"""
    try:
        from app.services.nflverse import seed_players_and_ids
        typer.echo("Seeding players from nfl_data_py...")
        
        async def _seed_players():
            count = await seed_players_and_ids()
            return count
        
        count = asyncio.run(_seed_players())
        typer.echo(f"Seeded {count} players")
        
    except ImportError:
        typer.echo("nfl_data_py not installed. Install with: pip install nfl-data-py")
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
        typer.echo("nfl_data_py not installed. Install with: pip install nfl-data-py")
        raise typer.Exit(1)


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
