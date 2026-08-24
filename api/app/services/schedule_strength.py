"""Player schedule context derived from nflverse schedules and prior-year results."""

from __future__ import annotations

import time
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..db import SessionLocal
from ..models import ApiResponseCache


_TEAM_ALIASES = {"LAR": "LA", "WSH": "WAS"}


def _team(value: str | None) -> str:
    team = (value or "").upper()
    return _TEAM_ALIASES.get(team, team)


def _cache_key(team: str, position: str, season: int) -> str:
    return f"nflverse:schedule-strength:{season}:{_team(team)}:{position.upper()}"


def _calculate_schedule_strength(
    team: str,
    position: str,
    season: int,
    stats: list[dict[str, Any]],
    schedules: list[dict[str, Any]],
) -> dict[str, Any]:
    """Estimate matchup ease from prior-year PPR points allowed by position.

    Rank 1 is the easiest schedule and rank 32 is the hardest. This is a
    transparent descriptive baseline, not a projection model.
    """
    position = position.upper()
    if position not in {"QB", "RB", "WR", "TE", "K"}:
        return {
            "available": False,
            "season": season,
            "basis_season": season - 1,
            "reason": "Schedule strength is not modeled for this position yet.",
        }

    basis_season = season - 1
    totals: dict[str, float] = {}
    games: dict[str, set[str]] = {}
    for row in stats:
        if row.get("season_type") != "REG" or str(row.get("position") or "").upper() != position:
            continue
        opponent = _team(row.get("opponent_team"))
        game_id = str(row.get("game_id") or "")
        points = row.get("fantasy_points_ppr")
        if not opponent or points is None:
            continue
        totals[opponent] = totals.get(opponent, 0.0) + float(points)
        games.setdefault(opponent, set()).add(game_id)

    allowed = {
        opponent: total / max(len(games.get(opponent, set())), 1)
        for opponent, total in totals.items()
    }
    # More points allowed means an easier fantasy matchup.
    ranked = sorted(allowed, key=lambda opponent: allowed[opponent], reverse=True)
    ease_rank = {opponent: index + 1 for index, opponent in enumerate(ranked)}

    player_team = _team(team)
    matchups = []
    for row in schedules:
        if row.get("game_type") != "REG" or int(row.get("week") or 0) > 17:
            continue
        away = _team(row.get("away_team"))
        home = _team(row.get("home_team"))
        if player_team not in {away, home}:
            continue
        opponent = home if player_team == away else away
        matchups.append(
            {
                "week": int(row["week"]),
                "opponent": opponent,
                "location": "away" if player_team == away else "home",
                "ease_rank": ease_rank.get(opponent),
                "points_allowed_per_game": round(allowed[opponent], 1) if opponent in allowed else None,
            }
        )
    matchups.sort(key=lambda item: item["week"])

    ranked_matchups = [item["ease_rank"] for item in matchups if item["ease_rank"]]
    average_rank = sum(ranked_matchups) / len(ranked_matchups) if ranked_matchups else None
    all_team_averages: list[float] = []
    for candidate in {_team(row.get("home_team")) for row in schedules}:
        opponents = []
        for row in schedules:
            if row.get("game_type") != "REG" or int(row.get("week") or 0) > 17:
                continue
            away = _team(row.get("away_team"))
            home = _team(row.get("home_team"))
            if candidate in {away, home}:
                opponent = home if candidate == away else away
                if opponent in ease_rank:
                    opponents.append(ease_rank[opponent])
        if opponents:
            all_team_averages.append(sum(opponents) / len(opponents))
    schedule_rank = None
    if average_rank is not None:
        schedule_rank = sorted(all_team_averages).index(min(all_team_averages, key=lambda value: abs(value - average_rank))) + 1

    if schedule_rank is None:
        label = "Unavailable"
    elif schedule_rank <= 10:
        label = "Favorable"
    elif schedule_rank >= 23:
        label = "Challenging"
    else:
        label = "Neutral"

    return {
        "available": bool(matchups and ranked_matchups),
        "season": season,
        "basis_season": basis_season,
        "position": position,
        "schedule_rank": schedule_rank,
        "average_opponent_ease_rank": round(average_rank, 1) if average_rank is not None else None,
        "label": label,
        "method": f"{basis_season} PPR points allowed to {position}s; rank 1 is easiest",
        "matchups": matchups,
    }


async def refresh_schedule_strength_cache(season: int) -> dict[str, Any]:
    """Fetch schedule inputs once and persist every team/position result."""
    import nflreadpy as nfl

    basis_season = season - 1
    stats = nfl.load_player_stats([basis_season], summary_level="week").to_dicts()
    schedules = nfl.load_schedules([season]).to_dicts()
    teams = sorted({
        _team(row.get(side))
        for row in schedules
        for side in ("home_team", "away_team")
        if row.get(side)
    })
    fetched_at = int(time.time())
    stored = 0
    async with SessionLocal() as session:
        for team in teams:
            for position in ("QB", "RB", "WR", "TE", "K"):
                key = _cache_key(team, position, season)
                response = _calculate_schedule_strength(
                    team, position, season, stats, schedules
                )
                values = {
                    "provider": "nflverse",
                    "endpoint": "/schedule-strength",
                    "query": {"team": team, "position": position, "season": season},
                    "response": response,
                    "fetched_at": fetched_at,
                    "expires_at": 2_147_483_647,
                    "last_accessed_at": fetched_at,
                    "status_code": 200,
                    "response_headers": {},
                }
                row = await session.get(ApiResponseCache, key)
                if row:
                    for field, value in values.items():
                        setattr(row, field, value)
                else:
                    session.add(ApiResponseCache(cache_key=key, **values))
                stored += 1
        await session.commit()
    return {
        "loaded": stored,
        "season": season,
        "basis_season": basis_season,
        "teams": len(teams),
    }


async def get_schedule_strength(
    db: AsyncSession, team: str, position: str, season: int
) -> dict[str, Any]:
    """Read schedule context from the database without making web requests."""
    position = position.upper()
    if position not in {"QB", "RB", "WR", "TE", "K"}:
        return {
            "available": False,
            "season": season,
            "basis_season": season - 1,
            "reason": "Schedule strength is not modeled for this position yet.",
        }
    cached = await db.get(ApiResponseCache, _cache_key(team, position, season))
    if not cached:
        return {
            "available": False,
            "season": season,
            "basis_season": season - 1,
            "reason": "Schedule context is not cached yet. Run Refresh all sources.",
        }
    cached.last_accessed_at = int(time.time())
    await db.commit()
    return cached.response
