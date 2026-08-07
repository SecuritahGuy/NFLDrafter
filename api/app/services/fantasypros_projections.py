"""Ingest cached official FantasyPros projection samples."""

from __future__ import annotations

import hashlib
import time
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select

from ..db import SessionLocal
from ..models import Player, PlayerRanking
from .fantasypros_api import FantasyProsClient
from .player_matching import match_player


# The unfiltered endpoint currently defaults to RB and lets the first fetch be
# reused if it was made during credential setup.
PROJECTION_POSITIONS: tuple[str | None, ...] = (None, "WR", "TE", "QB", "K", "DST")
POSITION_ALIASES = {"DST": "DEF"}
STAT_MAP = {
    "pass_att": "passing_attempts",
    "pass_cmp": "passing_completions",
    "pass_yds": "passing_yards",
    "pass_tds": "passing_touchdowns",
    "pass_ints": "interceptions",
    "rush_att": "carries",
    "rush_yds": "rushing_yards",
    "rush_tds": "rushing_touchdowns",
    "rec_rec": "receptions",
    "rec_yds": "receiving_yards",
    "rec_tds": "receiving_touchdowns",
    "fumbles": "fumbles",
    "fg": "field_goals_made",
    "fga": "field_goals_attempted",
    "xpt": "extra_points_made",
}


def _number(value: Any) -> float | None:
    try:
        return float(value) if value is not None and value != "" else None
    except (TypeError, ValueError):
        return None


def _parse_player(row: dict[str, Any]) -> dict[str, Any] | None:
    name = row.get("name") or row.get("player_name")
    position = POSITION_ALIASES.get(str(row.get("position_id") or "").upper(), str(row.get("position_id") or "").upper())
    if not name or position not in {"QB", "RB", "WR", "TE", "K", "DEF"}:
        return None
    stats = row.get("stats") or {}
    projected_stats = {
        target: value
        for source, target in STAT_MAP.items()
        if (value := _number(stats.get(source))) is not None
    }
    ppr_points = _number(stats.get("points_ppr"))
    native_points = ppr_points or _number(stats.get("points_half")) or _number(stats.get("points"))
    return {
        "fantasypros_id": str(row.get("fpid") or ""),
        "full_name": str(name),
        "position": position,
        "team": row.get("team_id"),
        "projected_points": native_points,
        "projected_points_per_game": round(native_points / 17, 3) if native_points is not None else None,
        "projected_stats": projected_stats,
        "native_points": {
            "STD": _number(stats.get("points")),
            "HALF": _number(stats.get("points_half")),
            "PPR": ppr_points,
        },
        "raw_player": row,
    }


def _resolve_player_id(record: dict[str, Any], players: list[Player]) -> str | None:
    result = match_player(
        {
            "name": record["full_name"],
            "position": record["position"],
            "team": record.get("team"),
        },
        players,
    )
    return result.canonical_player_id if result.status == "matched" else None


async def ingest_fantasypros_projections(
    season: int,
    *,
    client: FantasyProsClient | None = None,
    force_refresh: bool = False,
) -> dict[str, Any]:
    """Load six cache-first position samples into projection snapshots."""
    client = client or FantasyProsClient()
    responses = []
    parsed: list[dict[str, Any]] = []
    for requested_position in PROJECTION_POSITIONS:
        response = await client.projections(
            season, position=requested_position, force_refresh=force_refresh
        )
        responses.append(response)
        for row in response.data.get("players") or []:
            record = _parse_player(row)
            if record:
                parsed.append(record)

    # Deduplicate any cross-position eligibility by FantasyPros ID, retaining
    # the first position-specific response.
    unique: dict[tuple[str, str], dict[str, Any]] = {}
    for record in parsed:
        unique.setdefault(
            (record["fantasypros_id"], record["position"]), record
        )
    parsed = list(unique.values())
    parsed.sort(
        key=lambda row: (-(row["projected_points"] or 0), row["full_name"])
    )
    by_position: dict[str, int] = {}
    for overall_rank, record in enumerate(parsed, start=1):
        position = record["position"]
        by_position[position] = by_position.get(position, 0) + 1
        record["rank"] = overall_rank
        record["pos_rank"] = by_position[position]

    fetched_at = max((response.fetched_at for response in responses), default=int(time.time()))
    snapshot_date = datetime.fromtimestamp(fetched_at, timezone.utc).strftime("%Y-%m-%d")
    source = "fantasypros-projection"
    async with SessionLocal() as session:
        players = list((await session.execute(select(Player))).scalars().all())
        await session.execute(
            delete(PlayerRanking).where(
                PlayerRanking.source == source,
                PlayerRanking.season == season,
                PlayerRanking.snapshot_date == snapshot_date,
            )
        )
        matched = 0
        for record in parsed:
            player_id = _resolve_player_id(record, players)
            matched += int(player_id is not None)
            ranking_id = hashlib.sha1(
                f"{source}|{season}|{record['fantasypros_id']}|{record['position']}|{snapshot_date}".encode()
            ).hexdigest()
            session.add(PlayerRanking(
                ranking_id=ranking_id,
                player_id=player_id,
                full_name=record["full_name"],
                position=record["position"],
                team=record.get("team"),
                source=source,
                rank_type="preseason",
                scoring="PPR",
                season=season,
                week=None,
                rank=record["rank"],
                pos_rank=record["pos_rank"],
                ecr=None,
                snapshot_date=snapshot_date,
                snapshot_ts=fetched_at * 1000,
                raw={
                    "fantasypros_id": record["fantasypros_id"],
                    "projected_points": record["projected_points"],
                    "projected_points_per_game": record["projected_points_per_game"],
                    "projection_season": season,
                    "projected_stats": record["projected_stats"],
                    "native_points": record["native_points"],
                    "weekly_projections": [],
                },
            ))
        await session.commit()

    return {
        "loaded": len(parsed),
        "matched": matched,
        "snapshot_date": snapshot_date,
        "cache_statuses": [response.cache_status for response in responses],
        "network_calls": sum(response.cache_status == "miss" for response in responses),
        "limited": any(bool(response.data.get("public_api_limited")) for response in responses),
        "tier": next((response.data.get("tier") for response in responses if response.data.get("tier")), None),
    }
