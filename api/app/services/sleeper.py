"""Sleeper identity enrichment through the free, no-auth public API.

Sleeper's public API is read-only and unauthenticated. It does not expose ADP
or season-long rankings; those figures on third-party sites are their own
tracked or scraped consensus, not data served by Sleeper. What the API does
provide authoritatively is the full ``players/nfl`` directory (keyed by
Sleeper's internal ``sleeper_id``) together with cross-platform identity
fields (``espn_id``, ``gsis_id``, ``sportradar_id``) and current status/team.

This service backfills the ``sleeper_id`` on our canonical ``Player`` rows and
records a durable ``PlayerIdentifier`` (platform ``"sleeper"``) for the season,
keyed off the strongest available crosswalk: ESPN id. That enrichment improves
downstream matching and signals without introducing a source we do not own.
"""

from __future__ import annotations

import json
import time
import urllib.request
import uuid
from dataclasses import dataclass
from typing import Any

from sqlalchemy import select

from ..db import SessionLocal
from ..models import Player, PlayerIdentifier

_SLEEPER_PLAYERS_URL = "https://api.sleeper.app/v1/players/nfl"
_SLEEPER_STATE_URL = "https://api.sleeper.app/v1/state/nfl"


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and value != value:  # NaN
        return None
    s = str(value).strip()
    if s in {"", "nan", "None"}:
        return None
    return value


def _json(url: str) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


@dataclass(slots=True)
class SleeperProvider:
    """HTTP provider for Sleeper's public, no-auth endpoints."""

    def load_players(self) -> list[dict[str, Any]]:
        """Return normalized player records from ``players/nfl``.

        Each payload entry is keyed by Sleeper's player id; we surface that as
        ``sleeper_id`` on the returned record.
        """
        payload = _json(_SLEEPER_PLAYERS_URL)
        records: list[dict[str, Any]] = []
        for player_id, row in (payload or {}).items():
            full_name = _clean(row.get("full_name"))
            if not full_name:
                continue
            position = _clean(row.get("position"))
            team = _clean(row.get("team"))
            active = bool(row.get("active"))
            status = _clean(row.get("status") or ("ACT" if active else "INACT"))
            if not position and not team:
                continue
            records.append(
                {
                    "player_id": str(player_id),
                    "full_name": str(full_name),
                    "position": position,
                    "team": team,
                    "espn_id": _clean(row.get("espn_id")),
                    "gsis_id": _clean(row.get("gsis_id")),
                    "active": active,
                    "status": status,
                    "years_exp": _clean(row.get("years_exp")),
                }
            )
        return records

    def load_season_state(self) -> dict[str, Any]:
        return _json(_SLEEPER_STATE_URL)


async def backfill_sleeper_ids(
    provider: SleeperProvider | None = None,
    session: Any | None = None,
) -> dict:
    """Persist Sleeper player ids onto canonical players for the current season.

    Matches by ESPN id first (the most conservative cross-platform key), then
    falls back to the strict name/position/team triple. Writes both the backend
    ``Player.sleeper_id`` column and a durable ``PlayerIdentifier`` record for
    the season so later ingestion jobs can resolve Sleeper players without
    revisiting matching.

    Args:
        provider: SleeperProvider override (defaults to a live HTTP fetch).
        session: AsyncSession override for tests (defaults to SessionLocal).
    """
    provider = provider or SleeperProvider()
    records = provider.load_players()
    if not records:
        return {"loaded": 0, "matched": 0, "ambiguous": 0, "snapshot": None}

    try:
        season = int((provider.load_season_state() or {}).get("league_season"))
    except (TypeError, ValueError):
        season = int(time.strftime("%Y"))

    created_at = int(time.time())

    async def _run(session) -> dict:
        players = list((await session.execute(select(Player))).scalars().all())

        by_espn: dict[str, list[Player]] = {}
        by_name: dict[tuple[str, str, str], list[Player]] = {}
        for player in players:
            if player.espn_id:
                by_espn.setdefault(str(player.espn_id), []).append(player)
            key = (
                player.full_name.strip().lower(),
                (player.position or "").upper(),
                (player.team or "").upper(),
            )
            by_name.setdefault(key, []).append(player)

        # Drop any prior sleeper identifiers for the season (idempotent refresh).
        existing = (
            await session.execute(
                select(PlayerIdentifier).where(
                    PlayerIdentifier.platform == "sleeper",
                    PlayerIdentifier.season == season,
                )
            )
        ).scalars().all()
        existing_by_key = {
            (ident.external_id, ident.canonical_player_id): ident
            for ident in existing
        }
        matched = 0
        ambiguous = 0
        for record in records:
            player = None
            method = None
            confidence = 0.0
            espn_id = record.get("espn_id")
            if espn_id:
                candidates = by_espn.get(str(espn_id), [])
                if len(candidates) == 1:
                    player, method, confidence = candidates[0], "espn_id", 1.0
                elif len(candidates) > 1:
                    ambiguous += 1
            if player is None:
                key = (
                    str(record.get("full_name")).strip().lower(),
                    (record.get("position") or "").upper(),
                    (record.get("team") or "").upper(),
                )
                candidates = by_name.get(key, [])
                if len(candidates) == 1:
                    player, method, confidence = candidates[0], "name_position_team", 0.99
                elif len(candidates) > 1:
                    ambiguous += 1
            if player is None:
                continue

            sleeper_id = record["player_id"]
            matched += 1
            if not player.sleeper_id:
                player.sleeper_id = sleeper_id
            ident_key = (sleeper_id, player.player_id)
            identifier = existing_by_key.get(ident_key)
            if identifier is None:
                identifier = PlayerIdentifier(
                    identifier_id=str(uuid.uuid4()),
                    canonical_player_id=player.player_id,
                    platform="sleeper",
                    external_id=sleeper_id,
                    season=season,
                    name=record.get("full_name"),
                    team=record.get("team") or player.team,
                    position=record.get("position") or player.position,
                    match_confidence=confidence,
                    match_method=method or "unmatched",
                    created_at=created_at,
                )
                session.add(identifier)

        await session.commit()
        return {
            "loaded": len(records),
            "matched": matched,
            "ambiguous": ambiguous,
            "season": season,
        }

    if session is not None:
        return await _run(session)
    async with SessionLocal() as session:
        return await _run(session)
