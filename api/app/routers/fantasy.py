from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any
import time

from ..deps import get_db_session
from ..models import PlayerWeekStat, ScoringRule, ScoringProfile
from ..schemas import PointsResponse
from ..scoring import compute_points_from_dict

router = APIRouter(prefix="/fantasy", tags=["fantasy"])


@router.get("/points", response_model=PointsResponse)
async def calculate_points(
    player_id: str = Query(..., description="Player ID"),
    season: int = Query(..., description="NFL season year", ge=2000, le=2030),
    week: int = Query(..., description="Week number", ge=1, le=18),
    profile_id: str = Query(..., description="Scoring profile ID"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Calculate fantasy points for a player in a specific week using a scoring profile.
    """
    start_time = time.time()
    
    # Get player stats for the week
    stats_query = select(PlayerWeekStat.stat_key, PlayerWeekStat.stat_value).where(
        PlayerWeekStat.player_id == player_id,
        PlayerWeekStat.season == season,
        PlayerWeekStat.week == week
    )
    
    result = await db.execute(stats_query)
    stats = {row.stat_key: row.stat_value for row in result.all()}
    
    if not stats:
        raise HTTPException(
            status_code=404,
            detail=f"No stats found for player {player_id} in {season} week {week}"
        )
    
    # Get scoring profile and rules
    profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(
            status_code=404,
            detail=f"Scoring profile {profile_id} not found"
        )
    
    rules_query = select(ScoringRule).where(ScoringRule.profile_id == profile_id)
    rules_result = await db.execute(rules_query)
    rules = rules_result.scalars().all()
    
    # Convert rules to dictionary format for scoring engine
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
    
    # Calculate points
    points = compute_points_from_dict(stats, rules_dict)
    
    # Performance check
    calculation_time = (time.time() - start_time) * 1000
    if calculation_time > 50:
        # Log warning for slow calculations
        print(f"Warning: Points calculation took {calculation_time:.2f}ms for {profile_id}")
    
    return PointsResponse(
        points=points,
        stats=stats,
        profile_name=profile.name
    )


@router.get("/players/{player_id}/stats")
async def get_player_stats(
    player_id: str,
    season: int = Query(..., description="NFL season year", ge=2000, le=2030),
    week: int = Query(..., description="Week number", ge=1, le=18),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get raw stats for a player in a specific week.
    """
    stats_query = select(PlayerWeekStat).where(
        PlayerWeekStat.player_id == player_id,
        PlayerWeekStat.season == season,
        PlayerWeekStat.week == week
    )
    
    result = await db.execute(stats_query)
    stats = result.scalars().all()
    
    if not stats:
        raise HTTPException(
            status_code=404,
            detail=f"No stats found for player {player_id} in {season} week {week}"
        )
    
    # Convert to dictionary format
    stats_dict = {stat.stat_key: stat.stat_value for stat in stats}
    
    return {
        "player_id": player_id,
        "season": season,
        "week": week,
        "stats": stats_dict
    }


@router.get("/profiles")
async def list_scoring_profiles(
    db: AsyncSession = Depends(get_db_session)
):
    """
    List all available scoring profiles.
    """
    query = select(ScoringProfile).where(ScoringProfile.is_public == True)
    result = await db.execute(query)
    profiles = result.scalars().all()
    
    return {
        "profiles": [
            {
                "profile_id": profile.profile_id,
                "name": profile.name,
                "description": profile.description,
                "created_at": profile.created_at
            }
            for profile in profiles
        ]
    }
