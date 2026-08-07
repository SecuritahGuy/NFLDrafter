from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session
from ..models import PlayerInjury, PlayerRanking

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
