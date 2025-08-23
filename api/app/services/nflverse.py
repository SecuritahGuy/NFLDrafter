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
        from nfl_data_py import import_ids, import_weekly_data
        
        # Get player IDs data
        ids = import_ids()
        
        # Get weekly data to extract all unique player IDs that actually have stats
        # We'll get players from multiple seasons to ensure we have all needed players
        seasons_to_check = [2023, 2022, 2021, 2020]  # Check these seasons for players
        all_weekly_data = []
        for season in seasons_to_check:
            try:
                season_data = import_weekly_data([season])
                all_weekly_data.append(season_data)
            except Exception as e:
                print(f"Warning: Could not load {season} season data: {e}")
                continue
        
        if not all_weekly_data:
            raise ValueError("Could not load any season data")
        
        # Combine all seasons and get unique player IDs
        combined_weekly = pd.concat(all_weekly_data, ignore_index=True)
        unique_player_ids = combined_weekly['player_id'].unique()
        
        print(f"Found {len(unique_player_ids)} unique players with stats in weekly data")
        
        async with SessionLocal() as session:
            count = 0
            processed_ids = set()
            
            # First, process players from weekly data (these are the ones we actually need)
            for player_id in unique_player_ids:
                if player_id in processed_ids:
                    continue
                
                # Check if player already exists in database
                existing = await session.execute(
                    select(Player).where(Player.player_id == str(player_id))
                )
                if existing.scalar_one_or_none():
                    processed_ids.add(player_id)
                    continue
                    
                # Find this player in the IDs data
                player_row = ids[ids['gsis_id'] == player_id]
                if player_row.empty:
                    # If not found in IDs, create from weekly data
                    # Find this player in any of the weekly data
                    weekly_row = None
                    for season_data in all_weekly_data:
                        player_data = season_data[season_data['player_id'] == player_id]
                        if not player_data.empty:
                            weekly_row = player_data.iloc[0]
                            break
                    
                    if weekly_row is None:
                        print(f"Warning: Could not find weekly data for player {player_id}")
                        continue
                    
                    player = Player(
                        player_id=str(player_id),
                        full_name=str(weekly_row['player_name']),
                        position=str(weekly_row['position']),
                        team=str(weekly_row['recent_team']) if pd.notna(weekly_row['recent_team']) else None,
                        nflverse_id=str(player_id),
                        yahoo_id=None,
                        sleeper_id=None,
                    )
                    session.add(player)
                    count += 1
                    processed_ids.add(player_id)
                    continue
                
                # Process from IDs data
                row = player_row.iloc[0]
                
                # Get name - handle nan values
                full_name = row.get("name")
                if pd.isna(full_name):
                    continue  # Skip players without names
                
                # Get position - handle nan values
                position = row.get("position")
                if pd.isna(position):
                    position = "UNK"
                
                # Get team - handle nan values
                team = row.get("team")
                if pd.notna(team):
                    team = str(team)
                else:
                    team = None
                
                # Create player with cleaned data
                player = Player(
                    player_id=str(player_id),
                    full_name=str(full_name),
                    position=str(position),
                    team=team,
                    nflverse_id=str(player_id),
                    yahoo_id=str(row.get("yahoo_id")) if not pd.isna(row.get("yahoo_id")) else None,
                    sleeper_id=str(row.get("sleeper_id")) if not pd.isna(row.get("sleeper_id")) else None,
                )
                session.add(player)
                count += 1
                processed_ids.add(player_id)
            
            await session.commit()
            print(f"Successfully seeded {count} players")
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
        
        # Define the stats we want to track (mapping from nfl_data_py columns to our stat keys)
        stat_mappings = {
            'passing_yards': 'passing_yards',
            'passing_tds': 'passing_touchdowns',
            'interceptions': 'interceptions',
            'rushing_yards': 'rushing_yards',
            'rushing_tds': 'rushing_touchdowns',
            'receptions': 'receptions',
            'receiving_yards': 'receiving_yards',
            'receiving_tds': 'receiving_touchdowns',
            'targets': 'targets',
            'carries': 'carries',
            'attempts': 'passing_attempts',
            'completions': 'passing_completions',
            'sacks': 'sacks',
            'fumbles_lost': 'fumbles_lost',
            'rushing_fumbles_lost': 'rushing_fumbles_lost',
            'receiving_fumbles_lost': 'receiving_fumbles_lost',
            'sack_fumbles_lost': 'sack_fumbles_lost',
        }
        
        for season in seasons:
            print(f"Loading {season} season...")
            df = import_weekly_data([season])
            
            print(f"Processing {len(df)} weekly records for {season}")
            
            async with SessionLocal() as session:
                count = 0
                for _, row in df.iterrows():
                    for nfl_col, stat_key in stat_mappings.items():
                        if nfl_col not in df.columns:
                            continue
                            
                        stat_value = row[nfl_col]
                        if pd.isna(stat_value) or stat_value == 0:
                            continue
                        
                        # Check if stat already exists
                        existing = await session.execute(
                            select(PlayerWeekStat).where(
                                PlayerWeekStat.player_id == str(row["player_id"]),
                                PlayerWeekStat.season == int(row["season"]),
                                PlayerWeekStat.week == int(row["week"]),
                                PlayerWeekStat.stat_key == stat_key
                            )
                        )
                        if existing.scalar_one_or_none():
                            continue
                        
                        # Create stat record
                        stat = PlayerWeekStat(
                            player_id=str(row["player_id"]),
                            season=int(row["season"]),
                            week=int(row["week"]),
                            stat_key=stat_key,
                            stat_value=float(stat_value)
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
