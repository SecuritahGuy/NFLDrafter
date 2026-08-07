from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session
from ..models import Player, PlayerIdentifier

router = APIRouter(prefix="/sleeper", tags=["sleeper"])


@router.post("/backfill")
async def run_sleeper_backfill():
    """Trigger a Sleeper identity backfill (no auth, against the free API)."""
    from ..services.sleeper import backfill_sleeper_ids

    return await backfill_sleeper_ids()


@router.get("/coverage")
async def sleeper_coverage(season: int = 2026, db: AsyncSession = Depends(get_db_session)):
    """Report Sleeper identifier coverage for the canonical player pool."""
    total = (
        await db.execute(select(func.count(Player.player_id))).scalar_one()
    )
    linked = (
        await db.execute(
            select(func.count(PlayerIdentifier.identifier_id)).where(
                PlayerIdentifier.platform == "sleeper",
                PlayerIdentifier.season == season,
            )
        )
    ).scalar_one()
    return {
        "season": season,
        "total_players": total,
        "sleeper_identifiers": linked,
        "coverage_rate": round(linked / total, 4) if total else 0,
    }
