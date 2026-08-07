"""Weekly injury report ingestion from nflverse (official NFL injury reports)."""

from __future__ import annotations

import hashlib
import time
from collections.abc import Sequence
from typing import Any

from sqlalchemy import delete, select

from ..db import SessionLocal
from ..models import Player, PlayerInjury
from .nfl_data_provider import NFLDataProvider, get_nfl_data_provider


def _clean(value: Any) -> Any:
    if value is None:
        return None
    s = str(value).strip()
    if s in {"", "nan", "None"}:
        return None
    return value


async def _resolve_player_id(full_name: str, team: str, name_to_player: dict[tuple, Player]) -> str | None:
    key = (full_name.lower(), (team or "").upper())
    player = name_to_player.get(key)
    return player.player_id if player else None


async def ingest_injuries(
    seasons: Sequence[int] | None = None,
    provider: NFLDataProvider | None = None,
    delete_existing: bool = True,
) -> dict:
    """
    Ingest weekly injury reports.

    Args:
        seasons: Seasons to load. Defaults to the most recent season.
        provider: Data provider override (defaults to nflreadpy).
        delete_existing: Whether to drop previously stored rows for the loaded
            seasons before inserting (idempotent re-ingest).

    Returns:
        Summary dict with the number of records stored per season.
    """
    records = (provider or get_nfl_data_provider()).load_injuries(seasons=seasons)
    by_season: dict[int, int] = {}
    snapshot_ts = int(time.time() * 1000)

    async with SessionLocal() as session:
        rows = (await session.execute(select(Player))).scalars().all()
        name_to_player: dict[tuple, Player] = {}
        for player in rows:
            name_to_player[(player.full_name.lower(), (player.team or "").upper())] = player

        if delete_existing:
            for season in {int(r.get("season", 0)) for r in records if r.get("season")}:
                await session.execute(
                    delete(PlayerInjury).where(PlayerInjury.season == season)
                )

        for row in records:
            season = _clean(row.get("season"))
            week = _clean(row.get("week"))
            full_name = _clean(row.get("full_name"))
            if season is None or week is None or not full_name:
                continue

            season = int(season)
            week = int(week)
            team = _clean(row.get("team"))
            position = _clean(row.get("position"))
            report_primary = _clean(row.get("report_primary_injury"))
            report_status = _clean(row.get("report_status"))
            player_id = await _resolve_player_id(str(full_name), str(team or ""), name_to_player)

            injury_id = hashlib.sha1(
                f"{season}|{week}|{full_name}|{team}|{report_primary}|{report_status}".encode()
            ).hexdigest()
            session.add(
                PlayerInjury(
                    injury_id=injury_id,
                    player_id=player_id,
                    full_name=str(full_name),
                    position=position,
                    team=team,
                    season=season,
                    season_type=_clean(row.get("season_type")),
                    week=week,
                    report_primary_injury=report_primary,
                    report_secondary_injury=_clean(row.get("report_secondary_injury")),
                    report_status=report_status,
                    practice_primary_injury=_clean(row.get("practice_primary_injury")),
                    practice_secondary_injury=_clean(row.get("practice_secondary_injury")),
                    practice_status=_clean(row.get("practice_status")),
                    snapshot_ts=snapshot_ts,
                )
            )
            by_season[season] = by_season.get(season, 0) + 1

        await session.commit()

    return {"loaded": by_season}
