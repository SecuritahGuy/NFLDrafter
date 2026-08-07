"""Backfill cross-platform player IDs from a local sports-ml-lab parquet.

The sports-ml-lab repo (SecuritahGuy/sports-ml-lab) publishes 2026 rosters at
``data/features/nfl/rosters_2026.parquet`` containing espn_id / sportradar_id /
rotowire_id / pff_id / pfr_id / fantasy_data_id alongside nflverse player_id.
This service updates existing ``players`` rows that are missing an ``espn_id``
so ranking ingestion (ESPN, FFC) can resolve by ID instead of name+team.
"""

from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import select

from ..db import SessionLocal
from ..models import Player

_DEFAULT_PARQUET = Path(
    os.getenv(
        "SPORTS_ML_LAB_ROSTERS",
        "/Users/tim/dev/sports-ml-lab/data/features/nfl/rosters_2026.parquet",
    )
)


async def backfill_espn_ids_from_rosters(path: str | os.PathLike | None = None) -> dict:
    """
    Backfill ``players.espn_id`` from a sports-ml-lab rosters parquet.

    Args:
        path: Path to ``rosters_2026.parquet``. Defaults to the env var
            ``SPORTS_ML_LAB_ROSTERS`` or the standard sports-ml-lab checkout.

    Returns:
        Summary dict with updated count and players still missing espn_id.
    """
    import polars as pl

    parquet = Path(path or _DEFAULT_PARQUET)
    if not parquet.exists():
        return {"updated": 0, "file": str(parquet), "error": "parquet not found"}

    frame = pl.read_parquet(parquet)
    if "espn_id" not in frame.columns:
        return {"updated": 0, "file": str(parquet), "error": "missing espn_id column"}

    id_to_espn: dict[str, str] = {}
    for row in frame.select(["player_id", "espn_id"]).drop_nulls().iter_rows():
        pid, espn = row
        id_to_espn[str(pid)] = str(espn)

    updated = 0
    async with SessionLocal() as session:
        players = (await session.execute(select(Player))).scalars().all()
        for player in players:
            if player.espn_id:
                continue
            espn_id = id_to_espn.get(player.player_id)
            if espn_id:
                player.espn_id = espn_id
                updated += 1
        await session.commit()

    return {
        "updated": updated,
        "file": str(parquet),
        "rosters_with_espn_id": len(id_to_espn),
    }
