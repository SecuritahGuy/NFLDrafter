"""Fantasy Football Calculator (FFC) ADP ingestion.

Pulls ADP (average draft position) from fantasyfootballcalculator.com's free,
no-auth REST API, stores each scrape as a timestamped snapshot in
``player_rankings`` under ``source="ffc-adp"``, and computes rank movement
against the previous snapshot so risers/fallers can be tracked alongside the
FantasyPros ECR and ESPN draft-rank sources.
"""

from __future__ import annotations

import hashlib
import json
import time
import urllib.request
from dataclasses import dataclass
from typing import Any

from sqlalchemy import delete, select

from ..db import SessionLocal
from ..models import Player, PlayerRanking
from .player_matching import match_player

_FFC_API_BASE = "https://fantasyfootballcalculator.com/api/v1/adp"

# FFC endpoint slug -> scoring value stored on PlayerRanking.
_SCORING_BY_ENDPOINT = {
    "ppr": "PPR",
    "standard": "STD",
    "2qb": "SUPERFLEX",
}


@dataclass(slots=True)
class FFCProvider:
    """HTTP provider for fantasyfootballcalculator.com's ADP API."""

    season: int
    teams: int = 12

    def load_rankings(self, scoring: str = "PPR") -> list[dict[str, Any]]:
        """Fetch ADP for one scoring format."""
        endpoint = next((k for k, v in _SCORING_BY_ENDPOINT.items() if v == scoring), "ppr")
        url = f"{_FFC_API_BASE}/{endpoint}?teams={self.teams}&year={self.season}"
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
        )
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read())


def _clean(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and value != value:  # NaN
        return None
    s = str(value).strip()
    if s in {"", "nan", "None"}:
        return None
    return value


def _parse_ranking_record(raw: dict) -> dict[str, Any] | None:
    """Normalize a raw FFC ADP player payload into a PlayerRanking payload."""
    full_name = _clean(raw.get("name"))
    adp = _clean(raw.get("adp"))
    if not full_name or adp is None:
        return None

    return {
        "full_name": str(full_name),
        "position": _clean(raw.get("position")),
        "team": _clean(raw.get("team")),
        "rank": None,  # derived from ADP order later
        "adp": float(adp),
        "sd": _clean(raw.get("stdev")),
        "best": _clean(raw.get("high")),
        "worst": _clean(raw.get("low")),
        "bye": _clean(raw.get("bye")),
        "times_drafted": _clean(raw.get("times_drafted")),
        "ffc_player_id": _clean(raw.get("player_id")),
    }


def _derive_rank_and_pos_rank(records: list[dict]) -> None:
    """Set overall rank by ADP (ascending) and pos_rank within position."""
    records.sort(key=lambda r: (r["adp"], r["full_name"]))
    for i, rec in enumerate(records, start=1):
        rec["rank"] = i

    by_position: dict[str, list[dict]] = {}
    for rec in records:
        by_position.setdefault(str(rec["position"] or "UNK"), []).append(rec)
    for pos_records in by_position.values():
        for j, rec in enumerate(pos_records, start=1):
            rec["pos_rank"] = j


def _resolve_player_id(
    rec: dict, players: list[Player]
) -> str | None:
    """Map an FFC record with normalized name, position, and team evidence."""
    result = match_player(
        {
            "name": rec["full_name"],
            "position": rec.get("position"),
            "team": rec.get("team"),
        },
        players,
    )
    return result.canonical_player_id if result.status == "matched" else None


async def ingest_ffc_adp(
    season: int | None = None,
    rank_type: str = "preseason",
    scoring: str | None = None,
    teams: int = 12,
    provider: FFCProvider | None = None,
    delete_prior_snapshot: bool = True,
) -> dict:
    """
    Ingest the latest Fantasy Football Calculator ADP.

    Args:
        season: Season to load. Defaults to the current calendar year.
        rank_type: Stored rank_type, "preseason" (draft ADP) by default.
        scoring: Scoring format to store. One of "PPR", "STD", "SUPERFLEX"
            (defaults to PPR).
        teams: League size for ADP data (default 12).
        provider: FFCProvider override (defaults to a live HTTP fetch).
        delete_prior_snapshot: Whether to drop a previous snapshot of the same
            scrape date before inserting (idempotent re-ingest).

    Returns:
        Summary dict with snapshot date, player count, and movement info.
    """
    season = season or time.strftime("%Y")
    scoring = scoring or "PPR"

    provider = provider or FFCProvider(season=int(season), teams=teams)
    payload = provider.load_rankings(scoring=scoring)

    parsed: list[dict] = []
    for raw in (payload.get("players") or []):
        rec = _parse_ranking_record(raw)
        if rec:
            parsed.append(rec)

    if not parsed:
        return {"loaded": 0, "snapshot_date": None, "type": rank_type}

    _derive_rank_and_pos_rank(parsed)

    snapshot_date = time.strftime("%Y-%m-%d")
    snapshot_ts = int(time.time() * 1000)
    source = "ffc-adp"
    moved = 0

    async with SessionLocal() as session:
        players = list((await session.execute(select(Player))).scalars().all())

        if delete_prior_snapshot:
            await session.execute(
                delete(PlayerRanking).where(
                    PlayerRanking.source == source,
                    PlayerRanking.rank_type == rank_type,
                    PlayerRanking.scoring == scoring,
                    PlayerRanking.snapshot_date == snapshot_date,
                )
            )

        inserted = 0
        seen_player_ids: set[str] = set()
        for rec in parsed:  # already sorted by rank (ADP)
            player_id = _resolve_player_id(rec, players)
            if player_id and player_id in seen_player_ids:
                continue  # duplicate name resolves to the same player; keep higher-ranked
            if player_id:
                seen_player_ids.add(player_id)
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
                    season=int(season),
                    week=None,
                    rank=rec.get("rank"),
                    pos_rank=rec.get("pos_rank"),
                    ecr=rec.get("adp"),
                    sd=rec.get("sd"),
                    best=rec.get("best"),
                    worst=rec.get("worst"),
                    rank_delta=rec.get("rank_delta"),
                    owned_avg=None,
                    bye=rec.get("bye"),
                    snapshot_date=snapshot_date,
                    snapshot_ts=snapshot_ts,
                    raw={
                        "adp_formatted": rec.get("adp"),
                        "times_drafted": rec.get("times_drafted"),
                        "ffc_player_id": rec.get("ffc_player_id"),
                    },
                )
            )
            inserted += 1

        await session.commit()

        # Compute movement against the previous snapshot.
        prev_by_key: dict[tuple, int] = {}
        dates = (
            await session.execute(
                select(PlayerRanking.snapshot_date)
                .where(
                    PlayerRanking.source == source,
                    PlayerRanking.rank_type == rank_type,
                    PlayerRanking.scoring == scoring,
                )
                .distinct()
                .order_by(PlayerRanking.snapshot_date.desc())
            )
        ).scalars().all()
        if len(dates) >= 2:
            previous = (
                await session.execute(
                    select(PlayerRanking).where(
                        PlayerRanking.source == source,
                        PlayerRanking.rank_type == rank_type,
                        PlayerRanking.scoring == scoring,
                        PlayerRanking.snapshot_date == dates[1],
                    )
                )
            ).scalars().all()
            for r in previous:
                prev_by_key[(r.player_id, r.full_name.lower(), r.position)] = r.rank

            current = (
                await session.execute(
                    select(PlayerRanking).where(
                        PlayerRanking.source == source,
                        PlayerRanking.rank_type == rank_type,
                        PlayerRanking.scoring == scoring,
                        PlayerRanking.snapshot_date == dates[0],
                    )
                )
            ).scalars().all()
            for r in current:
                prev_rank = prev_by_key.get((r.player_id, r.full_name.lower(), r.position))
                if prev_rank is None:
                    continue
                delta = (prev_rank - r.rank) if prev_rank and r.rank else None
                if delta is not None and delta != 0:
                    r.rank_delta = delta
                    moved += 1
            await session.commit()

    return {
        "loaded": inserted,
        "snapshot_date": snapshot_date,
        "type": rank_type,
        "scoring": scoring,
        "moved": moved,
    }
