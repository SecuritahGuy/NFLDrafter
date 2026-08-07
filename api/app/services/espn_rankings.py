"""ESPN consensus draft rank ingestion.

Pulls ESPN's public fantasy draft ranks (STANDARD / PPR / SUPERFLEX) from the
no-auth ``kona_player_info`` player endpoint, stores each scrape as a
timestamped snapshot in ``player_rankings`` under ``source="espn-draft-rank"``,
and computes rank movement against the previous snapshot so risers/fallers can
be tracked alongside the FantasyPros ECR source.
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

_ESPN_READS_BASE = (
    "https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons"
)

# ESPN defaultPositionId -> position abbreviation.
_POSITION_BY_DEFAULT_ID = {1: "QB", 2: "RB", 3: "WR", 4: "TE", 5: "K", 16: "DEF"}

# ESPN proTeamId -> team abbreviation (via site.web.api.espn.com nfl/teams).
_TEAM_BY_PRO_ID = {
    1: "ATL", 2: "BUF", 3: "CHI", 4: "CIN", 5: "CLE", 6: "DAL", 7: "DEN",
    8: "DET", 9: "GB", 10: "TEN", 11: "IND", 12: "KC", 13: "LV", 14: "LAR",
    15: "MIA", 16: "MIN", 17: "NE", 18: "NO", 19: "NYG", 20: "NYJ", 21: "PHI",
    22: "ARI", 23: "PIT", 24: "LAC", 25: "SF", 26: "SEA", 27: "TB", 28: "WSH",
    29: "CAR", 30: "JAX", 33: "BAL", 34: "HOU",
}

# ESPN rank type -> scoring value stored on PlayerRanking.
_SCORING_BY_RANK_TYPE = {
    "STANDARD": "STD",
    "PPR": "PPR",
    "SUPERFLEX": "SUPERFLEX",
}

_PROJECTED_STAT_IDS = {
    "0": "passing_attempts",
    "1": "passing_completions",
    "3": "passing_yards",
    "4": "passing_touchdowns",
    "20": "interceptions",
    "23": "carries",
    "24": "rushing_yards",
    "25": "rushing_touchdowns",
    "42": "receiving_yards",
    "43": "receiving_touchdowns",
    "53": "receptions",
    "58": "targets",
    "83": "field_goals_made",
    "84": "field_goals_attempted",
    "86": "extra_points_made",
    "87": "extra_points_attempted",
}


def _projection_stats(raw_stats: dict | None) -> dict[str, float]:
    return {
        label: round(float(raw_stats[stat_id]), 2)
        for stat_id, label in _PROJECTED_STAT_IDS.items()
        if raw_stats and raw_stats.get(stat_id) is not None
    }


def _projected_ppr_points(stats: dict[str, float]) -> float | None:
    """Calculate a transparent PPR estimate from ESPN's projected box score."""
    if not stats or "field_goals_made" in stats:
        return None
    points = (
        stats.get("passing_yards", 0) / 25
        + stats.get("passing_touchdowns", 0) * 4
        - stats.get("interceptions", 0) * 2
        + stats.get("rushing_yards", 0) / 10
        + stats.get("rushing_touchdowns", 0) * 6
        + stats.get("receptions", 0)
        + stats.get("receiving_yards", 0) / 10
        + stats.get("receiving_touchdowns", 0) * 6
    )
    return round(points, 2)


@dataclass(slots=True)
class ESPNProvider:
    """HTTP provider for ESPN's public fantasy player endpoint."""

    season: int

    def load_rankings(self) -> list[dict[str, Any]]:
        """Fetch all players with their consensus draft ranks."""
        url = f"{_ESPN_READS_BASE}/{self.season}/players?scoringPeriodId=0&view=kona_player_info"
        headers = {
            "User-Agent": "Mozilla/5.0",
            "X-Fantasy-Filter": json.dumps(
                {"sortDraftRanks": {"sortPriority": 100, "sortAsc": True, "value": "PPR"}}
            ),
        }
        req = urllib.request.Request(url, headers=headers)
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


def _parse_ranking_record(
    raw: dict, rank_type: str, scoring: str
) -> dict[str, Any] | None:
    """Normalize a raw ESPN player payload into a PlayerRanking payload."""
    player = raw.get("player") or raw
    ranks = (player.get("draftRanksByRankType") or {}).get(rank_type) or {}
    rank = ranks.get("rank")
    full_name = _clean(player.get("fullName")) or _clean(player.get("firstName"))
    if not full_name or rank is None:
        return None

    projections = [
        stat for stat in (player.get("stats") or [])
        if stat.get("scoringPeriodId") == 0
        and stat.get("statSourceId") == 1
        and stat.get("statSplitTypeId") == 0
        and stat.get("appliedTotal") is not None
    ]
    projection = max(projections, key=lambda stat: stat.get("seasonId") or 0, default={})
    projection_season = projection.get("seasonId")
    weekly_projections = []
    for stat in sorted(
        (
            stat for stat in (player.get("stats") or [])
            if stat.get("seasonId") == projection_season
            and 1 <= (stat.get("scoringPeriodId") or 0) <= 18
            and stat.get("statSourceId") == 1
            and stat.get("statSplitTypeId") == 1
            and stat.get("stats")
        ),
        key=lambda stat: stat.get("scoringPeriodId") or 0,
    ):
        projected_stats = _projection_stats(stat.get("stats"))
        weekly_projections.append(
            {
                "week": stat.get("scoringPeriodId"),
                "points": _projected_ppr_points(projected_stats),
                "stats": projected_stats,
            }
        )
    ownership = player.get("ownership") or {}

    return {
        "full_name": str(full_name),
        "position": _POSITION_BY_DEFAULT_ID.get(player.get("defaultPositionId")),
        "team": _TEAM_BY_PRO_ID.get(player.get("proTeamId")),
        "rank": int(rank),
        "ecr": float(rank),
        "auction_value": _clean(ranks.get("auctionValue")),
        "espn_id": _clean(player.get("id")),
        "injury_status": _clean(player.get("injuryStatus")),
        "projected_points": _clean(projection.get("appliedTotal")),
        "projected_points_per_game": _clean(projection.get("appliedAverage")),
        "projection_season": _clean(projection_season),
        "projected_stats": _projection_stats(projection.get("stats")),
        "weekly_projections": weekly_projections,
        "season_outlook": _clean(player.get("seasonOutlook")),
        "ownership": {
            "percent_owned": _clean(ownership.get("percentOwned")),
            "percent_started": _clean(ownership.get("percentStarted")),
            "average_draft_position": _clean(ownership.get("averageDraftPosition")),
            "auction_value_average": _clean(ownership.get("auctionValueAverage")),
            "updated_at": _clean(ownership.get("date")),
        },
        "scoring": scoring,
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


def _resolve_player_id(
    rec: dict, players: list[Player]
) -> str | None:
    """Map an ESPN record with normalized name, position, and team evidence."""
    result = match_player(
        {
            "espn_id": rec.get("espn_id"),
            "name": rec["full_name"],
            "position": rec.get("position"),
            "team": rec.get("team"),
        },
        players,
    )
    return result.canonical_player_id if result.status == "matched" else None


async def ingest_espn_rankings(
    season: int | None = None,
    rank_type: str = "preseason",
    scoring: str | None = None,
    provider: ESPNProvider | None = None,
    delete_prior_snapshot: bool = True,
) -> dict:
    """
    Ingest the latest ESPN consensus draft ranks.

    Args:
        season: Season to load. Defaults to the current calendar year.
        rank_type: Stored rank_type, "preseason" (draft ranks) by default.
        scoring: Scoring format to store. One of "STD", "PPR", "SUPERFLEX"
            (defaults to PPR).
        provider: ESPNProvider override (defaults to a live HTTP fetch).
        delete_prior_snapshot: Whether to drop a previous snapshot of the same
            scrape date before inserting (idempotent re-ingest).

    Returns:
        Summary dict with snapshot date, player count, and movement info.
    """
    season = season or time.strftime("%Y")
    scoring = scoring or "PPR"
    rank_type_key = next((k for k, v in _SCORING_BY_RANK_TYPE.items() if v == scoring), "PPR")

    provider = provider or ESPNProvider(season=int(season))
    raw_players = provider.load_rankings()

    parsed: list[dict] = []
    for raw in raw_players:
        rec = _parse_ranking_record(raw, rank_type_key, scoring)
        if (
            rec
            and rec.get("position") in {"QB", "RB", "WR", "TE", "K", "DEF"}
            and 0 < rec["rank"] <= 500
        ):
            parsed.append(rec)

    if not parsed:
        return {"loaded": 0, "snapshot_date": None, "type": rank_type}

    _derive_pos_rank(parsed)

    snapshot_date = time.strftime("%Y-%m-%d")
    snapshot_ts = int(time.time() * 1000)
    source = "espn-draft-rank"
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
        for rec in sorted(parsed, key=lambda r: r["rank"] or 10**9):
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
                    ecr=rec.get("ecr"),
                    sd=None,
                    best=None,
                    worst=None,
                    rank_delta=rec.get("rank_delta"),
                    owned_avg=None,
                    bye=None,
                    snapshot_date=snapshot_date,
                    snapshot_ts=snapshot_ts,
                    raw={
                        "auction_value": rec.get("auction_value"),
                        "espn_id": rec.get("espn_id"),
                        "injury_status": rec.get("injury_status"),
                        "projected_points": rec.get("projected_points"),
                        "projected_points_per_game": rec.get("projected_points_per_game"),
                        "projection_season": rec.get("projection_season"),
                        "projected_stats": rec.get("projected_stats"),
                        "weekly_projections": rec.get("weekly_projections"),
                        "season_outlook": rec.get("season_outlook"),
                        "ownership": rec.get("ownership"),
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
