from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, and_
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


@router.get("/{player_id}/summary")
async def get_player_summary(
    player_id: str,
    season: int = Query(..., description="NFL season year", ge=2000, le=2030),
    profile_id: Optional[str] = Query(None, description="Scoring profile ID for fantasy points"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get comprehensive player summary including season totals, weekly trends, and fantasy points.
    """
    try:
        # Get player info
        player_query = select(Player).where(Player.player_id == player_id)
        player_result = await db.execute(player_query)
        player = player_result.scalar_one_or_none()
        
        if not player:
            raise HTTPException(status_code=404, detail="Player not found")
        
        # Get all weekly stats for the season
        from sqlalchemy import func, and_
        weekly_query = select(
            PlayerWeekStat.week,
            func.sum(PlayerWeekStat.stat_value).label('total_value'),
            func.count(PlayerWeekStat.stat_key).label('stat_count')
        ).where(
            and_(
                PlayerWeekStat.player_id == player_id,
                PlayerWeekStat.season == season
            )
        ).group_by(PlayerWeekStat.week).order_by(PlayerWeekStat.week)
        
        weekly_result = await db.execute(weekly_query)
        weekly_stats = weekly_result.all()
        
        # Get season totals by stat type
        season_query = select(
            PlayerWeekStat.stat_key,
            func.sum(PlayerWeekStat.stat_value).label('season_total'),
            func.avg(PlayerWeekStat.stat_value).label('weekly_avg'),
            func.max(PlayerWeekStat.stat_value).label('weekly_high'),
            func.count(PlayerWeekStat.stat_key).label('games_played')
        ).where(
            and_(
                PlayerWeekStat.player_id == player_id,
                PlayerWeekStat.season == season
            )
        ).group_by(PlayerWeekStat.stat_key)
        
        season_result = await db.execute(season_query)
        season_stats = {row.stat_key: {
            'total': row.season_total,
            'avg': row.weekly_avg,
            'high': row.weekly_high,
            'games': row.games_played
        } for row in season_result.all()}
        
        # Calculate fantasy points if profile provided
        fantasy_points = None
        if profile_id:
            from ..models import ScoringProfile, ScoringRule
            from ..scoring import compute_points_from_dict
            
            # Get scoring profile and rules
            profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
            profile_result = await db.execute(profile_query)
            profile = profile_result.scalar_one_or_none()
            
            if profile:
                rules_query = select(ScoringRule).where(ScoringRule.profile_id == profile_id)
                rules_result = await db.execute(rules_query)
                rules = rules_result.scalars().all()
                
                # Convert rules to dictionary format
                rules_dict = [
                    {
                        "stat_key": rule.stat_key,
                        "multiplier": rule.multiplier,
                        "per": rule.per,
                        "bonus_min": rule.bonus_min,
                        "bonus_max": rule.bonus_max,
                        "bonus_points": rule.bonus_points,
                        "cap": rule.cap
                    }
                    for rule in rules
                ]
                
                # Calculate season total fantasy points
                season_stats_dict = {stat: data['total'] for stat, data in season_stats.items()}
                fantasy_points = compute_points_from_dict(season_stats_dict, rules_dict)
        
        # Get position ranking
        position_ranking = None
        if profile_id and fantasy_points is not None:
            # Get all players in same position for ranking
            ranking_query = select(
                Player.player_id,
                Player.full_name,
                Player.team
            ).where(
                and_(
                    Player.position == player.position,
                    Player.player_id != player_id
                )
            )
            
            ranking_result = await db.execute(ranking_query)
            position_players = ranking_result.all()
            
            if position_players:
                # Calculate fantasy points for all players in position
                player_points = []
                for pos_player in position_players:
                    pos_stats_query = select(
                        PlayerWeekStat.stat_key,
                        func.sum(PlayerWeekStat.stat_value).label('stat_value')
                    ).where(
                        and_(
                            PlayerWeekStat.player_id == pos_player.player_id,
                            PlayerWeekStat.season == season
                        )
                    ).group_by(PlayerWeekStat.stat_key)
                    
                    pos_stats_result = await db.execute(pos_stats_query)
                    pos_stats = {row.stat_key: row.stat_value for row in pos_stats_result.all()}
                    
                    if pos_stats:
                        pos_points = compute_points_from_dict(pos_stats, rules_dict)
                        player_points.append({
                            'player_id': pos_player.player_id,
                            'full_name': pos_player.full_name,
                            'team': pos_player.team,
                            'fantasy_points': pos_points
                        })
                
                # Sort by fantasy points and find rank
                player_points.sort(key=lambda x: x['fantasy_points'], reverse=True)
                for i, pos_player in enumerate(player_points):
                    if pos_player['fantasy_points'] <= fantasy_points:
                        position_ranking = i + 1
                        break
                
                if position_ranking is None:
                    position_ranking = len(player_points) + 1
        
        # Build weekly sparkline data
        weekly_sparkline = []
        for week_stat in weekly_stats:
            if week_stat.stat_count == 0:
                continue
                
            # Get detailed stats for this week
            week_detail_query = select(PlayerWeekStat.stat_key, PlayerWeekStat.stat_value).where(
                and_(
                    PlayerWeekStat.player_id == player_id,
                    PlayerWeekStat.season == season,
                    PlayerWeekStat.week == week_stat.week
                )
            )
            
            week_detail_result = await db.execute(week_detail_query)
            week_stats_dict = {row.stat_key: row.stat_value for row in week_detail_result.all()}
            
            # Calculate weekly fantasy points if profile provided
            week_fantasy_points = None
            if profile_id and 'rules_dict' in locals():
                week_fantasy_points = compute_points_from_dict(week_stats_dict, rules_dict)
            
            weekly_sparkline.append({
                'week': week_stat.week,
                'stats': week_stats_dict,
                'fantasy_points': week_fantasy_points
            })
        
        return {
            "player": {
                "player_id": player.player_id,
                "full_name": player.full_name,
                "position": player.position,
                "team": player.team
            },
            "season": season,
            "season_stats": season_stats,
            "weekly_sparkline": weekly_sparkline,
            "fantasy_points": fantasy_points,
            "position_ranking": position_ranking,
            "total_games": len([w for w in weekly_stats if w.stat_count > 0])
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get player summary: {str(e)}")
