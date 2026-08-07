"""Expert consensus ranking (ECR) ingestion and time-series tracking.

Pulls FantasyPros ECR snapshots through nflreadpy, stores each scrape as a
timestamped snapshot, and computes rank movement (rank_delta) against the
previous snapshot so risers/fallers can be tracked week over week.
"""

from __future__ import annotations

import hashlib
import time
from typing import Any

from sqlalchemy import delete, select

from ..db import SessionLocal
from ..models import Player, PlayerRanking
from .nfl_data_provider import NFLDataProvider, get_nfl_data_provider
from .player_matching import match_player

# Only ingest the main redraft overall ECR board for preseason snapshots.
_PRESEASON_PAGE_TYPES = ("redraft-overall",)
_SCORING_BY_FP_PAGE = {
    "ppr-cheatsheets.php": "PPR",
    "half-point-ppr-cheatsheets.php": "HALF",
    "cheatsheets.php": "STD",
}


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and value != value:  # NaN
        return None
    s = str(value).strip()
    if s in {"", "nan", "None"}:
        return None
    return value


def _parse_rankings_record(row: dict, rank_type: str) -> dict | None:
    """Normalize a raw nflreadpy row into a PlayerRanking payload."""
    if rank_type == "preseason":
        if row.get("page_type") not in _PRESEASON_PAGE_TYPES:
            return None
        full_name = _clean(row.get("mergename")) or _clean(row.get("player"))
        position = _clean(row.get("pos"))
        team = _clean(row.get("team")) or _clean(row.get("tm"))
        ecr = _clean(row.get("ecr"))
        if not full_name or ecr is None:
            return None
        fp_page = str(row.get("fp_page") or "")
        scoring = None
        for key, val in _SCORING_BY_FP_PAGE.items():
            if key in fp_page:
                scoring = val
                break
        return {
            "full_name": str(full_name),
            "position": position,
            "team": team,
            "rank": round(float(ecr)),
            "pos_rank": None,  # computed later
            "ecr": float(ecr),
            "sd": _clean(row.get("sd")),
            "best": _clean(row.get("best")),
            "worst": _clean(row.get("worst")),
            "rank_delta": _clean(row.get("rank_delta")),
            "owned_avg": _clean(row.get("player_owned_avg")),
            "bye": _clean(row.get("bye")),
            "scoring": scoring,
            "week": None,
            "yahoo_id": _clean(row.get("yahoo_id")),
            "sportsdata_id": _clean(row.get("sportsdata_id")),
        }
    else:  # weekly
        full_name = _clean(row.get("player_name"))
        position = _clean(row.get("pos")) or _clean(row.get("page_pos"))
        team = _clean(row.get("team"))
        ecr = _clean(row.get("ecr"))
        rank = _clean(row.get("rank"))
        if not full_name or ecr is None or rank is None:
            return None
        return {
            "full_name": str(full_name),
            "position": position,
            "team": team,
            "rank": int(rank),
            "pos_rank": _clean(row.get("pos_rank")),
            "ecr": float(ecr),
            "sd": _clean(row.get("sd")),
            "best": _clean(row.get("best")),
            "worst": _clean(row.get("worst")),
            "rank_delta": _clean(row.get("player_ecr_delta")),
            "owned_avg": _clean(row.get("player_owned_avg")),
            "bye": _clean(row.get("player_bye_week")),
            "scoring": None,
            "week": None,
            "yahoo_id": None,
            "sportsdata_id": _clean(row.get("fantasypros_id")),
        }


def _derive_pos_rank(records: list[dict]) -> None:
    """Set pos_rank (1-based) within position, ordered by overall rank."""
    by_position: dict[str, list[dict]] = {}
    for rec in records:
        by_position.setdefault(str(rec["position"] or "UNK"), []).append(rec)
    for pos_records in by_position.values():
        pos_records.sort(key=lambda r: (r["rank"] if r["rank"] is not None else 10**9))
        for i, rec in enumerate(pos_records, start=1):
            rec["pos_rank"] = i


def _resolve_player_id(rec: dict, players: list[Player]) -> str | None:
    """Map a FantasyPros record with normalized identity evidence."""
    result = match_player(
        {
            "id": str(rec.get("yahoo_id") or ""),
            "name": rec["full_name"],
            "position": rec.get("position"),
            "team": rec.get("team"),
        },
        players,
    )
    return result.canonical_player_id if result.status == "matched" else None


async def ingest_rankings(
    rank_type: str = "preseason",
    provider: NFLDataProvider | None = None,
    delete_prior_snapshot: bool = True,
) -> dict:
    """
    Ingest the latest ECR snapshot from FantasyPros.

    Args:
        rank_type: "preseason" (redraft overall ECR) or "weekly" (in-season).
        provider: Data provider override (defaults to nflreadpy).
        delete_prior_snapshot: Whether to drop a previous snapshot of the same
            scrape date before inserting (idempotent re-ingest).

    Returns:
        Summary dict with snapshot date, player count, and new-snapshot info.
    """
    records = (provider or get_nfl_data_provider()).load_rankings(rank_type=rank_type)
    parsed: list[dict] = []
    snapshot_date: str | None = None
    for row in records:
        rec = _parse_rankings_record(row, rank_type)
        if rec:
            if not snapshot_date:
                snapshot_date = str(row.get("scrape_date") or time.strftime("%Y-%m-%d"))
            parsed.append(rec)

    if not parsed:
        return {"loaded": 0, "snapshot_date": snapshot_date, "type": rank_type}

    _derive_pos_rank(parsed)

    scoring = None
    snapshot_ts = int(time.time() * 1000)

    async with SessionLocal() as session:
        # Load players for ID mapping.
        players = list((await session.execute(select(Player))).scalars().all())

        if delete_prior_snapshot and snapshot_date:
            await session.execute(
                delete(PlayerRanking).where(
                    PlayerRanking.source == "fantasypros-ecr",
                    PlayerRanking.rank_type == rank_type,
                    PlayerRanking.snapshot_date == snapshot_date,
                )
            )

        inserted = 0
        for rec in parsed:
            player_id = _resolve_player_id(rec, players)
            source = "fantasypros-ecr"
            scoring = rec.get("scoring")
            ranking_id = hashlib.sha1(
                f"{source}|{rank_type}|{scoring}|{player_id}|{rec['full_name']}|"
                f"{rec.get('position')}|{rec['rank']}|{snapshot_date}".encode()
            ).hexdigest()
            session.add(
                PlayerRanking(
                    ranking_id=ranking_id,
                    player_id=player_id,
                    full_name=rec["full_name"],
                    position=rec.get("position"),
                    team=rec.get("team"),
                    source=source,
                    rank_type=rank_type,
                    scoring=scoring,
                    season=int(time.strftime("%Y")),
                    week=rec.get("week"),
                    rank=rec.get("rank"),
                    pos_rank=rec.get("pos_rank"),
                    ecr=rec.get("ecr"),
                    sd=rec.get("sd"),
                    best=rec.get("best"),
                    worst=rec.get("worst"),
                    rank_delta=rec.get("rank_delta"),
                    owned_avg=rec.get("owned_avg"),
                    bye=rec.get("bye"),
                    snapshot_date=snapshot_date,
                    snapshot_ts=snapshot_ts,
                    raw=rec,
                )
            )
            inserted += 1

        await session.commit()

    # Compute movement against the previous snapshot.
    movement = await _compute_movement(rank_type=rank_type, scoring=scoring)

    return {
        "loaded": inserted,
        "snapshot_date": snapshot_date,
        "type": rank_type,
        "moved": movement,
    }


async def _compute_movement(rank_type: str, scoring: str | None) -> int:
    """Diff current snapshot vs previous snapshot; update rank_delta in place."""
    async with SessionLocal() as session:
        dates = (
            await session.execute(
                select(PlayerRanking.snapshot_date)
                .where(
                    PlayerRanking.source == "fantasypros-ecr",
                    PlayerRanking.rank_type == rank_type,
                )
                .distinct()
                .order_by(PlayerRanking.snapshot_date.desc())
            )
        ).scalars().all()
        if len(dates) < 2:
            return 0

        current_date, previous_date = dates[0], dates[1]
        current = (
            await session.execute(
                select(PlayerRanking).where(
                    PlayerRanking.source == "fantasypros-ecr",
                    PlayerRanking.rank_type == rank_type,
                    PlayerRanking.snapshot_date == current_date,
                )
            )
        ).scalars().all()
        previous = (
            await session.execute(
                select(PlayerRanking).where(
                    PlayerRanking.source == "fantasypros-ecr",
                    PlayerRanking.rank_type == rank_type,
                    PlayerRanking.snapshot_date == previous_date,
                )
            )
        ).scalars().all()

        prev_by_key = {
            (r.player_id, r.full_name.lower(), r.position): r.rank for r in previous
        }
        moved = 0
        for r in current:
            prev_rank = prev_by_key.get((r.player_id, r.full_name.lower(), r.position))
            if prev_rank is None:
                continue
            delta = (prev_rank - r.rank) if prev_rank and r.rank else None
            if delta is not None and delta != 0:
                r.rank_delta = delta
                moved += 1
        await session.commit()
        return moved
