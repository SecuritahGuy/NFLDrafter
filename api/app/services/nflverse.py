from typing import List, Optional
from sqlalchemy import select

from ..db import SessionLocal
from ..models import Player, PlayerWeekStat
from .nfl_data_provider import NFLDataProvider, get_nfl_data_provider


_NFL_TEAM_NAMES = {
    "ARI": "Arizona Cardinals",
    "ATL": "Atlanta Falcons",
    "BAL": "Baltimore Ravens",
    "BUF": "Buffalo Bills",
    "CAR": "Carolina Panthers",
    "CHI": "Chicago Bears",
    "CIN": "Cincinnati Bengals",
    "CLE": "Cleveland Browns",
    "DAL": "Dallas Cowboys",
    "DEN": "Denver Broncos",
    "DET": "Detroit Lions",
    "GB": "Green Bay Packers",
    "HOU": "Houston Texans",
    "IND": "Indianapolis Colts",
    "JAX": "Jacksonville Jaguars",
    "KC": "Kansas City Chiefs",
    "LV": "Las Vegas Raiders",
    "LAC": "Los Angeles Chargers",
    "LAR": "Los Angeles Rams",
    "MIA": "Miami Dolphins",
    "MIN": "Minnesota Vikings",
    "NE": "New England Patriots",
    "NO": "New Orleans Saints",
    "NYG": "New York Giants",
    "NYJ": "New York Jets",
    "PHI": "Philadelphia Eagles",
    "PIT": "Pittsburgh Steelers",
    "SEA": "Seattle Seahawks",
    "SF": "San Francisco 49ers",
    "TB": "Tampa Bay Buccaneers",
    "TEN": "Tennessee Titans",
    "WAS": "Washington Commanders",
}


def _first(record: dict, *keys: str):
    for key in keys:
        value = record.get(key)
        if value is not None and str(value).strip() not in {"", "nan", "None"}:
            return value
    return None


async def seed_players_and_ids(provider: NFLDataProvider | None = None) -> int:
    """
    Seed players from nflreadpy with cross-platform ID mapping.
    
    Returns:
        Number of players seeded
    """
    try:
        records = (provider or get_nfl_data_provider()).load_players()
        async with SessionLocal() as session:
            count = 0
            for row in records:
                player_id = _first(row, "gsis_id", "player_id")
                full_name = _first(row, "display_name", "full_name", "name", "player_name")
                if not player_id or not full_name:
                    continue
                existing = await session.execute(
                    select(Player).where(Player.player_id == str(player_id))
                )
                existing_player = existing.scalar_one_or_none()
                if existing_player:
                    existing_player.full_name = str(full_name)
                    existing_player.position = str(_first(row, "position", "position_group") or "UNK")
                    existing_player.team = str(_first(row, "latest_team", "team", "recent_team") or "") or None
                    existing_player.nflverse_id = str(player_id)
                    existing_player.espn_id = str(_first(row, "espn_id") or "") or existing_player.espn_id
                    existing_player.last_season = int(_first(row, "last_season") or 0) or None
                    existing_player.status = str(_first(row, "status") or "") or None
                    existing_player.headshot = str(_first(row, "headshot") or "") or None
                    count += 1
                    continue
                player = Player(
                    player_id=str(player_id),
                    full_name=str(full_name),
                    position=str(_first(row, "position", "position_group") or "UNK"),
                    team=str(_first(row, "latest_team", "team", "recent_team") or "") or None,
                    nflverse_id=str(player_id),
                    yahoo_id=str(_first(row, "yahoo_id", "yahoo_player_id") or "") or None,
                    sleeper_id=str(_first(row, "sleeper_id") or "") or None,
                    espn_id=str(_first(row, "espn_id") or "") or None,
                    last_season=int(_first(row, "last_season") or 0) or None,
                    status=str(_first(row, "status") or "") or None,
                    headshot=str(_first(row, "headshot") or "") or None,
                )
                session.add(player)
                count += 1

            # nflverse's player index contains people, not the 32 draftable
            # team-defense units exposed by fantasy platforms. Keep those in
            # the same canonical pool so ESPN/FantasyPros/Yahoo DST records can
            # resolve by team and the UI's Defense filter is never empty.
            import time

            current_season = int(time.strftime("%Y"))
            for team, team_name in _NFL_TEAM_NAMES.items():
                player_id = f"def-{team}"
                existing = await session.execute(
                    select(Player).where(Player.player_id == player_id)
                )
                defense = existing.scalar_one_or_none()
                if defense:
                    defense.full_name = f"{team_name} D/ST"
                    defense.position = "DEF"
                    defense.team = team
                    defense.last_season = current_season
                    defense.status = "ACT"
                else:
                    session.add(
                        Player(
                            player_id=player_id,
                            full_name=f"{team_name} D/ST",
                            position="DEF",
                            team=team,
                            last_season=current_season,
                            status="ACT",
                        )
                    )
                count += 1
            await session.commit()
            print(f"Successfully seeded {count} players")
            return count
    except ImportError:
        raise ImportError("nflreadpy not installed. Install with: pip install nflreadpy")


async def ingest_weekly_stats(
    seasons: List[int], provider: NFLDataProvider | None = None
) -> dict:
    """
    Ingest weekly statistics for specified seasons.
    
    Args:
        seasons: List of NFL seasons to load
        
    Returns:
        Dictionary with counts per season
    """
    try:
        records = (provider or get_nfl_data_provider()).load_weekly_stats(seasons)
        results = {}
        
        # Map nflverse player-stat columns to internal scoring keys.
        stat_mappings = {
            'passing_yards': 'passing_yards',
            'passing_tds': 'passing_touchdowns',
            'passing_interceptions': 'interceptions',
            'sacks_suffered': 'sacks_suffered',
            'passing_air_yards': 'passing_air_yards',
            'passing_yards_after_catch': 'passing_yards_after_catch',
            'passing_first_downs': 'passing_first_downs',
            'passing_epa': 'passing_epa',
            'passing_cpoe': 'passing_cpoe',
            'rushing_yards': 'rushing_yards',
            'rushing_tds': 'rushing_touchdowns',
            'rushing_first_downs': 'rushing_first_downs',
            'rushing_epa': 'rushing_epa',
            'receptions': 'receptions',
            'receiving_yards': 'receiving_yards',
            'receiving_tds': 'receiving_touchdowns',
            'receiving_air_yards': 'receiving_air_yards',
            'receiving_yards_after_catch': 'receiving_yards_after_catch',
            'receiving_first_downs': 'receiving_first_downs',
            'receiving_epa': 'receiving_epa',
            'target_share': 'target_share',
            'air_yards_share': 'air_yards_share',
            'wopr': 'wopr',
            'racr': 'racr',
            'targets': 'targets',
            'carries': 'carries',
            'attempts': 'passing_attempts',
            'completions': 'passing_completions',
            'sacks': 'sacks',
            'fumbles_lost': 'fumbles_lost',
            'rushing_fumbles_lost': 'rushing_fumbles_lost',
            'receiving_fumbles_lost': 'receiving_fumbles_lost',
            'sack_fumbles_lost': 'sack_fumbles_lost',
            'fg_made': 'field_goals_made',
            'fg_att': 'field_goals_attempted',
            'fg_long': 'field_goal_long',
            'pat_made': 'extra_points_made',
            'pat_att': 'extra_points_attempted',
            'fantasy_points': 'fantasy_points_standard',
            'fantasy_points_ppr': 'fantasy_points_ppr',
        }
        
        for season in seasons:
            season_records = [row for row in records if int(row.get("season", 0)) == season]
            print(f"Processing {len(season_records)} weekly records for {season}")
            
            async with SessionLocal() as session:
                count = 0
                existing_rows = await session.execute(
                    select(
                        PlayerWeekStat.player_id,
                        PlayerWeekStat.week,
                        PlayerWeekStat.stat_key,
                    ).where(PlayerWeekStat.season == season)
                )
                existing_keys = set(existing_rows.all())
                for row in season_records:
                    player_id = _first(row, "player_id", "gsis_id")
                    if not player_id:
                        continue
                    for nfl_col, stat_key in stat_mappings.items():
                        if nfl_col not in row:
                            continue
                        stat_value = row[nfl_col]
                        if stat_value is None or stat_value == 0:
                            continue
                        
                        key = (str(player_id), int(row["week"]), stat_key)
                        if key in existing_keys:
                            continue
                        
                        # Create stat record
                        stat = PlayerWeekStat(
                            player_id=str(player_id),
                            season=int(row["season"]),
                            week=int(row["week"]),
                            stat_key=stat_key,
                            stat_value=float(stat_value)
                        )
                        session.add(stat)
                        existing_keys.add(key)
                        count += 1
                
                await session.commit()
                results[season] = count
                print(f"Loaded {count} stat records for {season}")
        
        return results
        
    except ImportError:
        raise ImportError("nflreadpy not installed. Install with: pip install nflreadpy")


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
    limit: int = 50,
    current_only: bool = False,
    season: Optional[int] = None,
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

        if current_only:
            import time

            target_season = season or int(time.strftime("%Y"))
            stmt = stmt.where(
                Player.last_season >= target_season,
                Player.position.in_(["QB", "RB", "WR", "TE", "K", "PK", "DEF"]),
                Player.status.in_(["ACT", "RES"]),
            )
        
        stmt = stmt.order_by(Player.position, Player.full_name).limit(limit)
        
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
                "sleeper_id": p.sleeper_id,
                "espn_id": p.espn_id,
                "last_season": p.last_season,
                "status": p.status,
                "headshot": p.headshot,
            }
            for p in players
        ]
