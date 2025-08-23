from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from ..deps import get_db_session
from ..models import Player, PlayerWeekStat
from ..services.nflverse import search_players, get_player_stats
from ..schemas import Player as PlayerSchema

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/positions")
async def get_positions():
    """
    Get list of available player positions.
    """
    return {
        "positions": ["QB", "RB", "WR", "TE", "K", "DEF", "DST"]
    }


@router.get("/teams")
async def get_teams():
    """
    Get list of available NFL teams.
    """
    return {
        "teams": [
            "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
            "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
            "LV", "LAC", "LAR", "MIA", "MIN", "NE", "NO", "NYG",
            "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS"
        ]
    }


@router.get("/", response_model=List[PlayerSchema])
async def search_players_endpoint(
    q: str = Query("", description="Search query for player names"),
    position: Optional[str] = Query(None, description="Filter by position (QB, RB, WR, TE, etc.)"),
    team: Optional[str] = Query(None, description="Filter by team abbreviation"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of results")
):
    """
    Search players with optional filters.
    """
    try:
        players = await search_players(query=q, position=position, team=team, limit=limit)
        return players
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@router.get("/{player_id}", response_model=PlayerSchema)
async def get_player(
    player_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get player details by ID.
    """
    result = await db.execute(
        select(Player).where(Player.player_id == player_id)
    )
    player = result.scalar_one_or_none()
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    return player


@router.get("/{player_id}/stats")
async def get_player_weekly_stats(
    player_id: str,
    season: int = Query(..., description="NFL season year", ge=2000, le=2030),
    week: int = Query(..., description="Week number", ge=1, le=18),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get player statistics for a specific week.
    """
    # First verify player exists
    player_result = await db.execute(
        select(Player).where(Player.player_id == player_id)
    )
    player = player_result.scalar_one_or_none()
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Get stats
    stats_result = await db.execute(
        select(PlayerWeekStat).where(
            PlayerWeekStat.player_id == player_id,
            PlayerWeekStat.season == season,
            PlayerWeekStat.week == week
        )
    )
    
    stats = stats_result.scalars().all()
    
    return {
        "player": {
            "player_id": player.player_id,
            "full_name": player.full_name,
            "position": player.position,
            "team": player.team
        },
        "season": season,
        "week": week,
        "stats": {stat.stat_key: stat.stat_value for stat in stats}
    }


@router.get("/{player_id}/season/{season}")
async def get_player_season_stats(
    player_id: str,
    season: int,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get player statistics for an entire season.
    """
    # First verify player exists
    player_result = await db.execute(
        select(Player).where(Player.player_id == player_id)
    )
    player = player_result.scalar_one_or_none()
    
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    
    # Get all stats for the season
    stats_result = await db.execute(
        select(PlayerWeekStat).where(
            PlayerWeekStat.player_id == player_id,
            PlayerWeekStat.season == season
        ).order_by(PlayerWeekStat.week)
    )
    
    stats = stats_result.scalars().all()
    
    # Group by week
    weekly_stats = {}
    for stat in stats:
        week = stat.week
        if week not in weekly_stats:
            weekly_stats[week] = {}
        weekly_stats[week][stat.stat_key] = stat.stat_value
    
    return {
        "player": {
            "player_id": player.player_id,
            "full_name": player.full_name,
            "position": player.position,
            "team": player.team
        },
        "season": season,
        "weekly_stats": weekly_stats
    }


@router.get("/positions")
async def get_positions():
    """
    Get list of available player positions.
    """
    return {
        "positions": ["QB", "RB", "WR", "TE", "K", "DEF", "DST"]
    }


@router.get("/teams")
async def get_teams():
    """
    Get list of available NFL teams.
    """
    return {
        "teams": [
            "ARI", "ATL", "BAL", "BUF", "CAR", "CHI", "CIN", "CLE",
            "DAL", "DEN", "DET", "GB", "HOU", "IND", "JAX", "KC",
            "LV", "LAC", "LAR", "MIA", "MIN", "NE", "NO", "NYG",
            "NYJ", "PHI", "PIT", "SEA", "SF", "TB", "TEN", "WAS"
        ]
    }
