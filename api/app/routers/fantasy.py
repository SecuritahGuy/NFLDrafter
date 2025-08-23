from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional
import time
import uuid

from ..deps import get_db_session
from ..models import PlayerWeekStat, ScoringRule, ScoringProfile
from ..schemas import PointsResponse, ScoringProfileCreate, ScoringProfile as ScoringProfileSchema
from ..scoring import compute_points_from_dict

router = APIRouter(prefix="/fantasy", tags=["fantasy"])


@router.post("/profiles", response_model=ScoringProfileSchema)
async def create_scoring_profile(
    profile_data: ScoringProfileCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Create a new scoring profile with rules.
    """
    try:
        # Create profile
        profile = ScoringProfile(
            profile_id=str(uuid.uuid4()),
            name=profile_data.name,
            description=profile_data.description,
            is_public=profile_data.is_public,
            created_at=int(time.time())
        )
        db.add(profile)
        
        # Create rules
        for rule_data in profile_data.rules:
            rule = ScoringRule(
                rule_id=str(uuid.uuid4()),
                profile_id=profile.profile_id,
                stat_key=rule_data.stat_key,
                multiplier=rule_data.multiplier,
                per=rule_data.per,
                bonus_min=rule_data.bonus_min,
                bonus_max=rule_data.bonus_max,
                bonus_points=rule_data.bonus_points,
                cap=rule_data.cap
            )
            db.add(rule)
        
        await db.commit()
        await db.refresh(profile)
        
        # Fetch the complete profile with rules
        profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile.profile_id)
        profile_result = await db.execute(profile_query)
        complete_profile = profile_result.scalar_one_or_none()
        
        return complete_profile
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create profile: {str(e)}")


@router.get("/profiles/{profile_id}", response_model=ScoringProfileSchema)
async def get_scoring_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get a specific scoring profile by ID.
    """
    query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
    result = await db.execute(query)
    profile = result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Scoring profile not found")
    
    return profile


@router.put("/profiles/{profile_id}", response_model=ScoringProfileSchema)
async def update_scoring_profile(
    profile_id: str,
    profile_data: ScoringProfileCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Update an existing scoring profile.
    """
    try:
        # Check if profile exists
        profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
        profile_result = await db.execute(profile_query)
        existing_profile = profile_result.scalar_one_or_none()
        
        if not existing_profile:
            raise HTTPException(status_code=404, detail="Scoring profile not found")
        
        # Update profile fields
        existing_profile.name = profile_data.name
        existing_profile.description = profile_data.description
        existing_profile.is_public = profile_data.is_public
        
        # Delete existing rules
        await db.execute(delete(ScoringRule).where(ScoringRule.profile_id == profile_id))
        
        # Create new rules
        for rule_data in profile_data.rules:
            rule = ScoringRule(
                rule_id=str(uuid.uuid4()),
                profile_id=profile_id,
                stat_key=rule_data.stat_key,
                multiplier=rule_data.multiplier,
                per=rule_data.per,
                bonus_min=rule_data.bonus_min,
                bonus_max=rule_data.bonus_max,
                bonus_points=rule_data.bonus_points,
                cap=rule_data.cap
            )
            db.add(rule)
        
        await db.commit()
        await db.refresh(existing_profile)
        
        # Fetch the complete updated profile
        updated_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
        updated_result = await db.execute(updated_query)
        updated_profile = updated_result.scalar_one_or_none()
        
        return updated_profile
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@router.delete("/profiles/{profile_id}")
async def delete_scoring_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Delete a scoring profile and all its rules.
    """
    try:
        # Check if profile exists
        profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
        profile_result = await db.execute(profile_query)
        profile = profile_result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Scoring profile not found")
        
        # Delete rules first (due to foreign key constraint)
        await db.execute(delete(ScoringRule).where(ScoringRule.profile_id == profile_id))
        
        # Delete profile
        await db.execute(delete(ScoringProfile).where(ScoringProfile.profile_id == profile_id))
        
        await db.commit()
        
        return {"message": "Scoring profile deleted successfully"}
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete profile: {str(e)}")


@router.get("/profiles/{profile_id}/export")
async def export_scoring_profile(
    profile_id: str,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Export a scoring profile as JSON for sharing/backup.
    """
    # Get profile with rules
    profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
    profile_result = await db.execute(profile_query)
    profile = profile_result.scalar_one_or_none()
    
    if not profile:
        raise HTTPException(status_code=404, detail="Scoring profile not found")
    
    # Convert to export format
    export_data = {
        "name": profile.name,
        "description": profile.description,
        "is_public": profile.is_public,
        "rules": [
            {
                "stat_key": rule.stat_key,
                "multiplier": rule.multiplier,
                "per": rule.per,
                "bonus_min": rule.bonus_min,
                "bonus_max": rule.bonus_max,
                "bonus_points": rule.bonus_points,
                "cap": rule.cap
            }
            for rule in profile.rules
        ]
    }
    
    return export_data


@router.post("/profiles/import", response_model=ScoringProfileSchema)
async def import_scoring_profile(
    profile_data: ScoringProfileCreate,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Import a scoring profile from JSON data.
    """
    try:
        # Create profile with imported data
        profile = ScoringProfile(
            profile_id=str(uuid.uuid4()),
            name=profile_data.name,
            description=profile_data.description,
            is_public=profile_data.is_public,
            created_at=int(time.time())
        )
        db.add(profile)
        
        # Create rules from imported data
        for rule_data in profile_data.rules:
            rule = ScoringRule(
                rule_id=str(uuid.uuid4()),
                profile_id=profile.profile_id,
                stat_key=rule_data.stat_key,
                multiplier=rule_data.multiplier,
                per=rule_data.per,
                bonus_min=rule_data.bonus_min,
                bonus_max=rule_data.bonus_max,
                bonus_points=rule_data.bonus_points,
                cap=rule_data.cap
            )
            db.add(rule)
        
        await db.commit()
        await db.refresh(profile)
        
        # Fetch the complete imported profile
        profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile.profile_id)
        profile_result = await db.execute(profile_query)
        complete_profile = profile_result.scalar_one_or_none()
        
        return complete_profile
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to import profile: {str(e)}")


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


@router.get("/points/leaderboard")
async def get_leaderboard(
    season: int = Query(..., description="NFL season year", ge=2000, le=2030),
    week: Optional[int] = Query(None, description="Week number (omit for season totals)", ge=1, le=18),
    position: Optional[str] = Query(None, description="Filter by position"),
    team: Optional[str] = Query(None, description="Filter by team"),
    profile_id: str = Query(..., description="Scoring profile ID"),
    limit: int = Query(300, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    db: AsyncSession = Depends(get_db_session)
):
    """
    Get fantasy points leaderboard with optional filters.
    """
    try:
        # Get scoring profile and rules
        profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
        profile_result = await db.execute(profile_query)
        profile = profile_result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Scoring profile not found")
        
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
        
        # Build base query for player stats
        from ..models import Player
        from sqlalchemy import and_, func
        
        if week:
            # Weekly stats
            stats_query = select(
                Player.player_id,
                Player.full_name,
                Player.position,
                Player.team,
                func.sum(PlayerWeekStat.stat_value).label('total_value'),
                func.count(PlayerWeekStat.stat_key).label('stat_count')
            ).join(
                PlayerWeekStat, 
                and_(
                    Player.player_id == PlayerWeekStat.player_id,
                    PlayerWeekStat.season == season,
                    PlayerWeekStat.week == week
                )
            )
        else:
            # Season totals
            stats_query = select(
                Player.player_id,
                Player.full_name,
                Player.position,
                Player.team,
                func.sum(PlayerWeekStat.stat_value).label('total_value'),
                func.count(PlayerWeekStat.stat_key).label('stat_count')
            ).join(
                PlayerWeekStat, 
                and_(
                    Player.player_id == PlayerWeekStat.player_id,
                    PlayerWeekStat.season == season
                )
            )
        
        # Add filters
        if position:
            stats_query = stats_query.where(Player.position == position)
        if team:
            stats_query = stats_query.where(Player.team == team)
        
        # Group and order by total value
        stats_query = stats_query.group_by(
            Player.player_id, Player.full_name, Player.position, Player.team
        ).order_by(func.sum(PlayerWeekStat.stat_value).desc())
        
        # Add pagination
        stats_query = stats_query.limit(limit).offset(offset)
        
        result = await db.execute(stats_query)
        player_stats = result.all()
        
        # Calculate fantasy points for each player
        leaderboard = []
        for player_stat in player_stats:
            if player_stat.stat_count == 0:
                continue
                
            # Get detailed stats for this player
            if week:
                detail_query = select(PlayerWeekStat.stat_key, PlayerWeekStat.stat_value).where(
                    and_(
                        PlayerWeekStat.player_id == player_stat.player_id,
                        PlayerWeekStat.season == season,
                        PlayerWeekStat.week == week
                    )
                )
            else:
                detail_query = select(
                    PlayerWeekStat.stat_key, 
                    func.sum(PlayerWeekStat.stat_value).label('stat_value')
                ).where(
                    and_(
                        PlayerWeekStat.player_id == player_stat.player_id,
                        PlayerWeekStat.season == season
                    )
                ).group_by(PlayerWeekStat.stat_key)
            
            detail_result = await db.execute(detail_query)
            stats_dict = {row.stat_key: row.stat_value for row in detail_result.all()}
            
            # Calculate fantasy points
            points = compute_points_from_dict(stats_dict, rules_dict)
            
            leaderboard.append({
                "player_id": player_stat.player_id,
                "full_name": player_stat.full_name,
                "position": player_stat.position,
                "team": player_stat.team,
                "fantasy_points": points,
                "stats": stats_dict
            })
        
        # Sort by fantasy points
        leaderboard.sort(key=lambda x: x['fantasy_points'], reverse=True)
        
        return {
            "season": season,
            "week": week,
            "position": position,
            "team": team,
            "profile_name": profile.name,
            "total_players": len(leaderboard),
            "leaderboard": leaderboard
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate leaderboard: {str(e)}")


@router.post("/points/batch")
async def batch_calculate_points(
    request_data: dict,
    db: AsyncSession = Depends(get_db_session)
):
    """
    Calculate fantasy points for multiple players in one request.
    """
    try:
        player_ids = request_data.get("player_ids", [])
        season = request_data.get("season")
        week = request_data.get("week")
        profile_id = request_data.get("profile_id")
        
        if not all([player_ids, season, profile_id]):
            raise HTTPException(
                status_code=400, 
                detail="player_ids, season, and profile_id are required"
            )
        
        # Get scoring profile and rules
        profile_query = select(ScoringProfile).where(ScoringProfile.profile_id == profile_id)
        profile_result = await db.execute(profile_query)
        profile = profile_result.scalar_one_or_none()
        
        if not profile:
            raise HTTPException(status_code=404, detail="Scoring profile not found")
        
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
        
        # Get player info
        from ..models import Player
        from sqlalchemy import func, and_
        players_query = select(Player).where(Player.player_id.in_(player_ids))
        players_result = await db.execute(players_query)
        players = {p.player_id: p for p in players_result.scalars().all()}
        
        # Calculate points for each player
        results = []
        start_time = time.time()
        
        for player_id in player_ids:
            if player_id not in players:
                results.append({
                    "player_id": player_id,
                    "error": "Player not found"
                })
                continue
            
            player = players[player_id]
            
            # Get stats for this player
            if week:
                stats_query = select(PlayerWeekStat.stat_key, PlayerWeekStat.stat_value).where(
                    and_(
                        PlayerWeekStat.player_id == player_id,
                        PlayerWeekStat.season == season,
                        PlayerWeekStat.week == week
                    )
                )
            else:
                stats_query = select(
                    PlayerWeekStat.stat_key, 
                    func.sum(PlayerWeekStat.stat_value).label('stat_value')
                ).where(
                    and_(
                        PlayerWeekStat.player_id == player_id,
                        PlayerWeekStat.season == season
                    )
                ).group_by(PlayerWeekStat.stat_key)
            
            stats_result = await db.execute(stats_query)
            stats = {row.stat_key: row.stat_value for row in stats_result.all()}
            
            if not stats:
                results.append({
                    "player_id": player_id,
                    "full_name": player.full_name,
                    "position": player.position,
                    "team": player.team,
                    "fantasy_points": 0.0,
                    "stats": {},
                    "error": "No stats available"
                })
                continue
            
            # Calculate fantasy points
            points = compute_points_from_dict(stats, rules_dict)
            
            results.append({
                "player_id": player_id,
                "full_name": player.full_name,
                "position": player.position,
                "team": player.team,
                "fantasy_points": points,
                "stats": stats
            })
        
        # Performance check
        total_time = (time.time() - start_time) * 1000
        if total_time > 100:
            print(f"Warning: Batch calculation took {total_time:.2f}ms for {len(player_ids)} players")
        
        return {
            "season": season,
            "week": week,
            "profile_name": profile.name,
            "total_players": len(player_ids),
            "calculation_time_ms": total_time,
            "results": results
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to calculate batch points: {str(e)}")


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
