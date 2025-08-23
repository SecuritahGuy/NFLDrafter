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
        from nfl_data_py import import_ids
        typer.echo("Seeding players from nfl_data_py...")
        
        async def _seed_players():
            ids = import_ids()
            ids = ids.rename(columns=str.lower)
            
            async with SessionLocal() as session:
                count = 0
                for _, row in ids.iterrows():
                    # Generate player ID
                    pid = row.get("gsis_id") or row.get("nfl_id") or str(uuid.uuid4())
                    
                    # Check if player already exists
                    existing = await session.execute(
                        select(Player).where(Player.player_id == pid)
                    )
                    if existing.scalar_one_or_none():
                        continue
                    
                    # Create player
                    player = Player(
                        player_id=pid,
                        full_name=row.get("full_name") or row.get("display_name", "Unknown"),
                        position=row.get("position", "UNK"),
                        team=row.get("team"),
                        nflverse_id=row.get("gsis_id"),
                        yahoo_id=row.get("yahoo_id"),
                        sleeper_id=row.get("sleeper_id"),
                    )
                    session.add(player)
                    count += 1
                
                await session.commit()
                typer.echo(f"Seeded {count} players")
        
        asyncio.run(_seed_players())
        
    except ImportError:
        typer.echo("nfl_data_py not installed. Install with: pip install nfl-data-py")
        raise typer.Exit(1)


@cli.command()
def load_stats(
    seasons: str = typer.Argument("2023", help="Comma-separated list of seasons to load")
):
    """Load weekly stats for specified seasons"""
    try:
        from nfl_data_py import import_weekly_data
        typer.echo(f"Loading weekly stats for seasons: {seasons}")
        
        async def _load_stats():
            years = [int(y.strip()) for y in seasons.split(",")]
            
            for year in years:
                typer.echo(f"Loading {year} season...")
                df = import_weekly_data([year])
                
                # Normalize to long format
                key_cols = ["player_id", "season", "week"]
                numeric_cols = df.select_dtypes(include=['number']).columns
                numeric_cols = [col for col in numeric_cols if col not in key_cols]
                
                async with SessionLocal() as session:
                    count = 0
                    for _, row in df.iterrows():
                        for stat_col in numeric_cols:
                            stat_value = row[stat_col]
                            if stat_value is None or (hasattr(stat_value, 'isna') and stat_value.isna()):
                                continue
                            
                            # Check if stat already exists
                            existing = await session.execute(
                                select(PlayerWeekStat).where(
                                    PlayerWeekStat.player_id == str(row["player_id"]),
                                    PlayerWeekStat.season == int(row["season"]),
                                    PlayerWeekStat.week == int(row["week"]),
                                    PlayerWeekStat.stat_key == stat_col
                                )
                            )
                            if existing.scalar_one_or_none():
                                continue
                            
                            # Create stat record
                            stat = PlayerWeekStat(
                                player_id=str(row["player_id"]),
                                season=int(row["season"]),
                                week=int(row["week"]),
                                stat_key=stat_col,
                                stat_value=float(stat_value or 0.0)
                            )
                            session.add(stat)
                            count += 1
                    
                    await session.commit()
                    typer.echo(f"Loaded {count} stat records for {year}")
        
        asyncio.run(_load_stats())
        
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
