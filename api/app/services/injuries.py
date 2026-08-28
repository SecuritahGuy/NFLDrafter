"""Weekly injury report ingestion from nflverse (official NFL injury reports)."""

from __future__ import annotations

import hashlib
import json
import time
import urllib.request
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, select

from ..db import SessionLocal
from ..models import Player, PlayerInjury
from .nfl_data_provider import NFLDataProvider, get_nfl_data_provider

_ESPN_INJURIES_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries"


@dataclass(slots=True)
class ESPNInjuryProvider:
    """Current NFL injuries from ESPN, including preseason reports."""

    def load_injuries(self) -> list[dict[str, Any]]:
        req = urllib.request.Request(_ESPN_INJURIES_URL)
        with urllib.request.urlopen(req, timeout=60) as response:
            payload = json.loads(response.read())

        season = (payload.get("season") or {}).get("year")
        records: list[dict[str, Any]] = []
        for team_group in payload.get("injuries") or []:
            for injury in team_group.get("injuries") or []:
                athlete = injury.get("athlete") or {}
                details = injury.get("details") or {}
                full_name = _clean(athlete.get("displayName"))
                status = _clean(injury.get("status"))
                # ESPN's endpoint also contains routine player-news entries
                # with an Active status. They are not injury listings and
                # generally lack injury details, so importing them produces
                # misleading UI flags such as "Not Specified".
                if not season or not full_name or str(status or "").lower() == "active":
                    continue
                injury_parts = [
                    _clean(details.get("side")),
                    _clean(details.get("type")),
                    _clean(details.get("detail")),
                ]
                injury_parts = [
                    part for part in injury_parts
                    if str(part).strip().lower() not in {"", "not specified"}
                ]
                records.append(
                    {
                        "season": season,
                        # ESPN's endpoint has no NFL week during preseason.
                        "week": 0,
                        "season_type": "ESPN",
                        "full_name": full_name,
                        "position": _clean((athlete.get("position") or {}).get("abbreviation")),
                        "team": _clean((athlete.get("team") or {}).get("abbreviation")),
                        "report_primary_injury": " ".join(str(part) for part in injury_parts if part),
                        "report_status": status,
                        "practice_primary_injury": _clean(injury.get("shortComment")),
                        "report_date": _clean(injury.get("date")),
                    }
                )
        return records


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
    espn_provider: ESPNInjuryProvider | None = None,
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
    # nflverse publishes official weekly reports after games begin.  ESPN fills
    # the preseason/current-status gap and includes the injury body part.
    try:
        records += (espn_provider or ESPNInjuryProvider()).load_injuries()
    except Exception as exc:  # keep official-report ingestion available on ESPN outages
        print(f"Current ESPN injuries refresh failed: {exc}")
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
                    report_date=_clean(row.get("report_date")),
                    snapshot_ts=snapshot_ts,
                )
            )
            by_season[season] = by_season.get(season, 0) + 1

        await session.commit()

    return {"loaded": by_season}
