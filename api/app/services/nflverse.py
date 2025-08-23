import pandas as pd
import uuid
import time
from typing import List, Optional
from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal
from ..models import Player, PlayerWeekStat


async def seed_players_and_ids() -> int:
    """
    Seed players from nfl_data_py with cross-platform ID mapping.
    
    Returns:
        Number of players seeded
    """
    try:
        from nfl_data_py import import_ids
        
        ids = import_ids()
        
        async with SessionLocal() as session:
            count = 0
            for _, row in ids.iterrows():
                # Generate player ID - handle nan values
                gsis_id = row.get("gsis_id")
                nfl_id = row.get("nfl_id")
                
                # Skip rows with no valid IDs
                if pd.isna(gsis_id) and pd.isna(nfl_id):
                    continue
                
                # Use first valid ID or generate UUID
                pid = None
                if not pd.isna(gsis_id):
                    pid = str(gsis_id)
                elif not pd.isna(nfl_id):
                    pid = str(nfl_id)
                else:
                    pid = str(uuid.uuid4())
                
                # Check if player already exists
                existing = await session.execute(
                    select(Player).where(Player.player_id == pid)
                )
                if existing.scalar_one_or_none():
                    continue
                
                # Get name - handle nan values
                full_name = row.get("name")  # Use 'name' column directly
                if pd.isna(full_name):
                    continue  # Skip players without names
                
                # Get position - handle nan values
                position = row.get("position")
                if pd.isna(position):
                    position = "UNK"
                
                # Get team - handle nan values
                team = row.get("team")
                if pd.isna(team):
                    team = None
                
                # Create player with cleaned data
                player = Player(
                    player_id=pid,
                    full_name=str(full_name),
                    position=str(position),
                    team=team,
                    nflverse_id=str(gsis_id) if not pd.isna(gsis_id) else None,
                    yahoo_id=str(row.get("yahoo_id")) if not pd.isna(row.get("yahoo_id")) else None,
                    sleeper_id=str(row.get("sleeper_id")) if not pd.isna(row.get("sleeper_id")) else None,
                )
                session.add(player)
                count += 1
            
            await session.commit()
            return count
            
    except ImportError:
        raise ImportError("nfl_data_py not installed. Install with: pip install nfl-data-py")


async def ingest_weekly_stats(seasons: List[int]) -> dict:
    """
    Ingest weekly statistics for specified seasons.
    
    Args:
        seasons: List of NFL seasons to load
        
    Returns:
        Dictionary with counts per season
    """
    try:
        from nfl_data_py import import_weekly_data
        
        results = {}
        
        for season in seasons:
            print(f"Loading {season} season...")
            df = import_weekly_data([season])
            
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
                results[season] = count
                print(f"Loaded {count} stat records for {season}")
        
        return results
        
    except ImportError:
        raise ImportError("nfl_data_py not installed. Install with: pip install nfl-data-py")


async def get_player_stats(
    player_id: str, 
    season: int, 
    week: int
) -> Optional[dict]:
    """
    Get player statistics for a specific week.
    
    Args:
        player_id: Player identifier
        season: NFL season
        week: Week number
        
    Returns:
        Dictionary of stats or None if not found
    """
    async with SessionLocal() as session:
        result = await session.execute(
            select(PlayerWeekStat).where(
                PlayerWeekStat.player_id == player_id,
                PlayerWeekStat.season == season,
                PlayerWeekStat.week == week
            )
        )
        
        stats = result.scalars().all()
        if not stats:
            return None
            
        return {stat.stat_key: stat.stat_value for stat in stats}


async def search_players(
    query: str = "",
    position: Optional[str] = None,
    team: Optional[str] = None,
    limit: int = 50
) -> List[dict]:
    """
    Search players with filters.
    
    Args:
        query: Name search query
        position: Filter by position
        team: Filter by team
        limit: Maximum results to return
        
    Returns:
        List of player dictionaries
    """
    async with SessionLocal() as session:
        # Build query
        stmt = select(Player)
        
        if query:
            stmt = stmt.where(Player.full_name.ilike(f"%{query}%"))
        
        if position:
            stmt = stmt.where(Player.position == position)
            
        if team:
            stmt = stmt.where(Player.team == team)
        
        stmt = stmt.limit(limit)
        
        result = await session.execute(stmt)
        players = result.scalars().all()
        
        return [
            {
                "player_id": p.player_id,
                "full_name": p.full_name,
                "position": p.position,
                "team": p.team,
                "nflverse_id": p.nflverse_id,
                "yahoo_id": p.yahoo_id,
                "sleeper_id": p.sleeper_id
            }
            for p in players
        ]
