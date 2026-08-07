from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session
from ..models import PlayerInjury, PlayerRanking, ScoringProfile, ScoringRule
from ..services.projection_analytics import build_projection_analytics

router = APIRouter(prefix="/rankings", tags=["rankings"])
injury_router = APIRouter(prefix="/injuries", tags=["injuries"])

RANKING_SOURCES = {
    "fantasypros-ecr": {
        "label": "FantasyPros ECR",
        "kind": "expert_consensus",
        "purpose": "Expert opinion and tier confidence",
        "attribution_url": "https://www.fantasypros.com/nfl/rankings/consensus-cheatsheets.php",
    },
    "espn-draft-rank": {
        "label": "ESPN Draft Rank",
        "kind": "platform_rank",
        "purpose": "Platform-specific draft-room ordering",
        "attribution_url": "https://www.espn.com/fantasy/football/",
    },
    "ffc-adp": {
        "label": "Fantasy Football Calculator ADP",
        "kind": "market_adp",
        "purpose": "Human mock-draft cost and next-pick urgency",
        "attribution_url": "https://fantasyfootballcalculator.com/adp/ppr",
    },
    "fantasypros-projection": {
        "label": "FantasyPros Projections",
        "kind": "projection",
        "purpose": "Consensus projected stat lines and team opportunity",
        "attribution_url": "https://www.fantasypros.com/nfl/projections/",
    },
}


def _source_or_400(source: str) -> str:
    if source not in RANKING_SOURCES:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown ranking source. Choose one of: {', '.join(RANKING_SOURCES)}",
        )
    return source


@router.get("/snapshots")
async def list_snapshots(
    source: str = Query("fantasypros-ecr", description="Ranking source identifier"),
    rank_type: str = Query("preseason", description="preseason or weekly"),
    season: int = Query(None, description="Season year"),
    db: AsyncSession = Depends(get_db_session),
):
    """List available ranking snapshots (dates), most recent first."""
    source = _source_or_400(source)
    stmt = select(
        PlayerRanking.snapshot_date,
        PlayerRanking.snapshot_ts,
    ).where(
        PlayerRanking.source == source,
        PlayerRanking.rank_type == rank_type,
    )
    if season:
        stmt = stmt.where(PlayerRanking.season == season)
    stmt = stmt.distinct().order_by(PlayerRanking.snapshot_date.desc())
    result = await db.execute(stmt)
    snapshots = [
        {"snapshot_date": row.snapshot_date, "snapshot_ts": row.snapshot_ts}
        for row in result.all()
    ]
    return {"source": source, "rank_type": rank_type, "snapshots": snapshots}


@router.get("/sources")
async def list_ranking_sources(db: AsyncSession = Depends(get_db_session)):
    """Report the latest stored snapshot and canonical-ID coverage per source."""
    latest = (
        select(
            PlayerRanking.source.label("source"),
            func.max(PlayerRanking.snapshot_date).label("snapshot_date"),
        )
        .group_by(PlayerRanking.source)
        .subquery()
    )
    rows = (
        await db.execute(
            select(
                PlayerRanking.source,
                PlayerRanking.scoring,
                PlayerRanking.season,
                PlayerRanking.snapshot_date,
                func.count(PlayerRanking.ranking_id).label("records"),
                func.sum(case((PlayerRanking.player_id.is_not(None), 1), else_=0)).label(
                    "matched"
                ),
            )
            .join(
                latest,
                (PlayerRanking.source == latest.c.source)
                & (PlayerRanking.snapshot_date == latest.c.snapshot_date),
            )
            .group_by(
                PlayerRanking.source,
                PlayerRanking.scoring,
                PlayerRanking.season,
                PlayerRanking.snapshot_date,
            )
            .order_by(PlayerRanking.source, PlayerRanking.scoring)
        )
    ).all()

    sources = []
    for source, metadata in RANKING_SOURCES.items():
        matching_rows = [row for row in rows if row.source == source]
        records = sum(row.records for row in matching_rows)
        matched = sum(row.matched or 0 for row in matching_rows)
        sources.append(
            {
                "source": source,
                **metadata,
                "available": bool(matching_rows),
                "snapshot_date": matching_rows[0].snapshot_date if matching_rows else None,
                "season": matching_rows[0].season if matching_rows else None,
                "scoring": sorted({row.scoring for row in matching_rows if row.scoring}),
                "records": records,
                "matched": matched,
                "match_rate": round(matched / records, 4) if records else 0,
            }
        )
    return {"sources": sources}


@router.get("/")
async def get_rankings(
    source: str = Query("fantasypros-ecr", description="Ranking source identifier"),
    rank_type: str = Query("preseason", description="preseason or weekly"),
    snapshot_date: Optional[str] = Query(None, description="Snapshot date (default: latest)"),
    position: Optional[str] = Query(None, description="Filter by position (QB, RB, WR, TE)"),
    scoring: Optional[str] = Query(None, description="PPR, HALF, or STD"),
    min_rank: Optional[int] = Query(None, ge=1, description="Minimum overall rank"),
    max_rank: Optional[int] = Query(None, ge=1, description="Maximum overall rank"),
    limit: int = Query(300, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_session),
):
    """Get rankings from a source snapshot, ordered by overall rank."""
    source = _source_or_400(source)
    if not snapshot_date:
        latest = await db.execute(
            select(PlayerRanking.snapshot_date)
            .where(
                PlayerRanking.source == source,
                PlayerRanking.rank_type == rank_type,
            )
            .order_by(PlayerRanking.snapshot_date.desc())
            .limit(1)
        )
        snapshot_date = latest.scalar_one_or_none()
        if not snapshot_date:
            return {"source": source, "snapshot_date": None, "rankings": []}

    stmt = select(PlayerRanking).where(
        PlayerRanking.source == source,
        PlayerRanking.rank_type == rank_type,
        PlayerRanking.snapshot_date == snapshot_date,
    )
    if position:
        stmt = stmt.where(PlayerRanking.position == position.upper())
    if scoring:
        stmt = stmt.where(PlayerRanking.scoring == scoring.upper())
    if min_rank:
        stmt = stmt.where(PlayerRanking.rank >= min_rank)
    if max_rank:
        stmt = stmt.where(PlayerRanking.rank <= max_rank)
    stmt = stmt.order_by(PlayerRanking.rank).limit(limit)

    result = await db.execute(stmt)
    rankings = []
    for r in result.scalars().all():
        rankings.append(
            {
                "rank": r.rank,
                "pos_rank": r.pos_rank,
                "player_id": r.player_id,
                "full_name": r.full_name,
                "position": r.position,
                "team": r.team,
                "ecr": r.ecr,
                "tier": r.tier,
                "sd": r.sd,
                "best": r.best,
                "worst": r.worst,
                "rank_delta": r.rank_delta,
                "owned_avg": r.owned_avg,
                "bye": r.bye,
                "projected_points": (r.raw or {}).get("projected_points"),
                "projected_points_per_game": (r.raw or {}).get("projected_points_per_game"),
                "projection_season": (r.raw or {}).get("projection_season"),
            }
        )
    return {
        "source": source,
        "snapshot_date": snapshot_date,
        "count": len(rankings),
        "rankings": rankings,
    }


@router.get("/movement")
async def get_movement(
    source: str = Query("fantasypros-ecr", description="Ranking source identifier"),
    rank_type: str = Query("preseason", description="preseason or weekly"),
    position: Optional[str] = Query(None, description="Filter by position"),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db_session),
):
    """Get biggest risers/fallers between the two most recent snapshots."""
    source = _source_or_400(source)
    dates = (
        await db.execute(
            select(PlayerRanking.snapshot_date)
            .where(
                PlayerRanking.source == source,
                PlayerRanking.rank_type == rank_type,
            )
            .distinct()
            .order_by(PlayerRanking.snapshot_date.desc())
            .limit(2)
        )
    ).scalars().all()
    if len(dates) < 2:
        raise HTTPException(
            status_code=404,
            detail=f"Need at least 2 snapshots for {rank_type} rankings to compute movement",
        )

    current_date, previous_date = dates[0], dates[1]
    current = (
        await db.execute(
            select(PlayerRanking).where(
                PlayerRanking.source == source,
                PlayerRanking.rank_type == rank_type,
                PlayerRanking.snapshot_date == current_date,
            )
        )
    ).scalars().all()
    previous = (
        await db.execute(
            select(PlayerRanking).where(
                PlayerRanking.source == source,
                PlayerRanking.rank_type == rank_type,
                PlayerRanking.snapshot_date == previous_date,
            )
        )
    ).scalars().all()

    prev_by_key = {
        (r.player_id, r.full_name.lower(), r.position): r.rank for r in previous
    }
    rows = []
    for r in current:
        prev_rank = prev_by_key.get((r.player_id, r.full_name.lower(), r.position))
        if prev_rank is None or r.rank is None:
            continue
        delta = prev_rank - r.rank  # positive = moved up
        if position and (r.position or "").upper() != position.upper():
            continue
        rows.append(
            {
                "full_name": r.full_name,
                "position": r.position,
                "team": r.team,
                "player_id": r.player_id,
                "prev_rank": prev_rank,
                "cur_rank": r.rank,
                "rank_delta": delta,
            }
        )

    rows.sort(key=lambda x: x["rank_delta"], reverse=True)
    return {
        "source": source,
        "from_snapshot": previous_date,
        "to_snapshot": current_date,
        "count": len(rows),
        "movement": rows[:limit],
    }


@router.get("/projection-analytics")
async def get_projection_analytics(
    profile_id: str = Query(..., description="Scoring profile used for projected points"),
    season: int = Query(2026, ge=2000, le=2030),
    league_size: int = Query(12, ge=2, le=32),
    qb: int = Query(1, ge=0, le=4),
    rb: int = Query(2, ge=0, le=8),
    wr: int = Query(2, ge=0, le=8),
    te: int = Query(1, ge=0, le=4),
    flex: int = Query(1, ge=0, le=4),
    superflex: int = Query(0, ge=0, le=4),
    k: int = Query(1, ge=0, le=2),
    defense: int = Query(1, ge=0, le=2),
    db: AsyncSession = Depends(get_db_session),
):
    """Score cached FantasyPros projections with ESPN fallback, deriving tiers and VORP."""
    profile = (
        await db.execute(select(ScoringProfile).where(ScoringProfile.profile_id == profile_id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Scoring profile not found")
    rules = (
        await db.execute(select(ScoringRule).where(ScoringRule.profile_id == profile_id))
    ).scalars().all()
    if not rules:
        raise HTTPException(status_code=422, detail="Scoring profile has no rules")

    snapshot_dates = {}
    for source in ("fantasypros-projection", "espn-draft-rank"):
        snapshot_dates[source] = (
            await db.execute(
                select(PlayerRanking.snapshot_date)
                .where(
                    PlayerRanking.source == source,
                    PlayerRanking.rank_type == "preseason",
                    PlayerRanking.season == season,
                    PlayerRanking.scoring == "PPR",
                )
                .order_by(PlayerRanking.snapshot_date.desc())
                .limit(1)
            )
        ).scalar_one_or_none()
    if not any(snapshot_dates.values()):
        return {
            "season": season, "snapshot_date": None,
            "profile": {"profile_id": profile.profile_id, "name": profile.name},
            "methodology": {}, "players": [],
        }

    records = []
    seen_player_ids = set()
    for source in ("fantasypros-projection", "espn-draft-rank"):
        snapshot_date = snapshot_dates[source]
        if not snapshot_date:
            continue
        source_records = (
            await db.execute(
                select(PlayerRanking).where(
                    PlayerRanking.source == source,
                    PlayerRanking.rank_type == "preseason",
                    PlayerRanking.season == season,
                    PlayerRanking.scoring == "PPR",
                    PlayerRanking.snapshot_date == snapshot_date,
                    PlayerRanking.player_id.is_not(None),
                )
            )
        ).scalars().all()
        for record in source_records:
            if record.player_id in seen_player_ids:
                continue
            seen_player_ids.add(record.player_id)
            records.append(record)
    players, methodology = build_projection_analytics(
        records,
        rules,
        league_size=league_size,
        starters={"QB": qb, "RB": rb, "WR": wr, "TE": te, "K": k, "DEF": defense},
        flex_slots=flex,
        superflex_slots=superflex,
    )
    return {
        "season": season,
        "snapshot_date": max(date for date in snapshot_dates.values() if date),
        "snapshot_dates": snapshot_dates,
        "profile": {"profile_id": profile.profile_id, "name": profile.name},
        "methodology": methodology,
        "players": players,
    }


@router.get("/fantasypros/cache-status")
async def get_fantasypros_cache_status():
    """Report cache and credential readiness without exposing the API key."""
    from ..services.fantasypros_api import cache_status

    return await cache_status()


@router.get("/fantasypros/projections")
async def get_fantasypros_projections(
    season: int = Query(2026, ge=2000, le=2030),
    position: Optional[str] = Query(None),
    week: Optional[int] = Query(None, ge=0, le=18),
):
    """Return a cache-first FantasyPros projection response."""
    from ..services.fantasypros_api import FantasyProsAPIError, FantasyProsClient

    try:
        result = await FantasyProsClient().projections(
            season, position=position, week=week, cache_only=True
        )
    except FantasyProsAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {
        "cache": {
            "status": result.cache_status,
            "fetched_at": result.fetched_at,
            "expires_at": result.expires_at,
            "rate_limit": result.response_headers,
        },
        "data": result.data,
    }


@router.get("/{player_id}/history")
async def get_player_ranking_history(
    player_id: str,
    source: str = Query("fantasypros-ecr", description="Ranking source identifier"),
    rank_type: str = Query("preseason", description="preseason or weekly"),
    db: AsyncSession = Depends(get_db_session),
):
    """Get a player's ranking over time across snapshots."""
    source = _source_or_400(source)
    result = await db.execute(
        select(PlayerRanking)
        .where(
            PlayerRanking.source == source,
            PlayerRanking.rank_type == rank_type,
            PlayerRanking.player_id == player_id,
        )
        .order_by(PlayerRanking.snapshot_date)
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No ranking history found for player")
    return {
        "source": source,
        "player_id": player_id,
        "full_name": rows[-1].full_name,
        "history": [
            {
                "snapshot_date": r.snapshot_date,
                "rank": r.rank,
                "pos_rank": r.pos_rank,
                "ecr": r.ecr,
                "team": r.team,
                "rank_delta": r.rank_delta,
            }
            for r in rows
        ],
    }


@injury_router.get("/")
async def get_injuries(
    season: int = Query(None, description="Season year (default: most recent)"),
    week: int = Query(None, ge=1, le=18, description="Week number"),
    team: Optional[str] = Query(None, description="Filter by team"),
    status: Optional[str] = Query(None, description="Report status filter (e.g. OUT, Q)"),
    position: Optional[str] = Query(None, description="Filter by position"),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db_session),
):
    """Get injury report entries, most recent season/week first."""
    if not season:
        latest = await db.execute(
            select(PlayerInjury.season).order_by(PlayerInjury.season.desc()).limit(1)
        )
        season = latest.scalar_one_or_none()
        if not season:
            return {"season": None, "injuries": []}

    stmt = select(PlayerInjury).where(PlayerInjury.season == season)
    if week:
        stmt = stmt.where(PlayerInjury.week == week)
    if team:
        stmt = stmt.where(PlayerInjury.team == team.upper())
    if status:
        stmt = stmt.where(func.lower(PlayerInjury.report_status) == status.lower())
    if position:
        stmt = stmt.where(PlayerInjury.position == position.upper())
    stmt = stmt.order_by(PlayerInjury.week.desc(), PlayerInjury.full_name).limit(limit)

    result = await db.execute(stmt)
    injuries = []
    for r in result.scalars().all():
        injuries.append(
            {
                "player_id": r.player_id,
                "full_name": r.full_name,
                "position": r.position,
                "team": r.team,
                "season": r.season,
                "week": r.week,
                "season_type": r.season_type,
                "report_status": r.report_status,
                "report_primary_injury": r.report_primary_injury,
                "report_secondary_injury": r.report_secondary_injury,
                "practice_status": r.practice_status,
                "practice_primary_injury": r.practice_primary_injury,
                "practice_secondary_injury": r.practice_secondary_injury,
            }
        )
    return {"season": season, "count": len(injuries), "injuries": injuries}


@injury_router.get("/players/{player_id}")
async def get_player_injuries(
    player_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """Get a player's injury history across seasons/weeks."""
    result = await db.execute(
        select(PlayerInjury)
        .where(PlayerInjury.player_id == player_id)
        .order_by(PlayerInjury.season.desc(), PlayerInjury.week.desc())
    )
    rows = result.scalars().all()
    if not rows:
        raise HTTPException(status_code=404, detail="No injury history found for player")
    return {
        "player_id": player_id,
        "full_name": rows[0].full_name,
        "history": [
            {
                "season": r.season,
                "week": r.week,
                "season_type": r.season_type,
                "report_status": r.report_status,
                "report_primary_injury": r.report_primary_injury,
                "report_secondary_injury": r.report_secondary_injury,
                "practice_status": r.practice_status,
            }
            for r in rows
        ],
    }
