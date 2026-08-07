"""Profile-aware projection scoring, tiers, and value over replacement."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any, Iterable

from ..scoring import compute_points_from_dict


FANTASY_POSITIONS = ("QB", "RB", "WR", "TE", "K", "DEF")
FLEX_POSITIONS = {"RB", "WR", "TE"}
DEFAULT_STARTERS = {"QB": 1, "RB": 2, "WR": 2, "TE": 1, "K": 1, "DEF": 1}
OPPORTUNITY_POSITIONS = {"RB", "WR", "TE"}
OPPORTUNITY_STATS = {
    "carries": "carry_share",
    "targets": "target_share",
    "receptions": "reception_share",
    "rushing_yards": "rushing_yard_share",
    "receiving_yards": "receiving_yard_share",
}


def normalize_position(position: str | None) -> str:
    value = (position or "").upper()
    if value == "PK":
        return "K"
    if value == "DST":
        return "DEF"
    return value


def rule_dicts(rules: Iterable[Any]) -> list[dict[str, Any]]:
    """Normalize ORM rules or dictionaries for the scoring engine."""
    fields = (
        "stat_key", "multiplier", "per", "bonus_min", "bonus_max",
        "bonus_points", "cap",
    )
    return [
        {field: rule.get(field) if isinstance(rule, dict) else getattr(rule, field) for field in fields}
        for rule in rules
    ]


def score_projected_stats(
    stats: dict[str, float] | None,
    rules: list[dict[str, Any]],
) -> float | None:
    """Return profile points when at least one projected stat has a matching rule."""
    stats = stats or {}
    rule_keys = {rule["stat_key"] for rule in rules}
    if not set(stats).intersection(rule_keys):
        return None
    return compute_points_from_dict(stats, rules)


def projected_team_opportunity(records: Iterable[Any]) -> dict[str, dict[str, Any]]:
    """Estimate each skill player's share of their projected team opportunity.

    Exact shares use projected box-score totals when a provider supplies them.
    The role estimate is deliberately separate: it converts ESPN draft rank into
    a decayed value signal and normalizes that signal among a team's RB/WR/TE
    players. It is a directional depth-chart proxy, not a projected snap share.
    """
    eligible = [
        record for record in records
        if record.player_id and record.team
        and normalize_position(record.position) in OPPORTUNITY_POSITIONS
    ]
    teams: dict[str, list[Any]] = defaultdict(list)
    for record in eligible:
        teams[record.team].append(record)

    result: dict[str, dict[str, Any]] = {}
    for team, teammates in teams.items():
        role_weights = {
            record.player_id: math.exp(-max(float(record.rank or 500) - 1, 0) / 75)
            for record in teammates
        }
        role_total = sum(role_weights.values())
        stat_totals = {
            stat: sum(
                float(((record.raw or {}).get("projected_stats") or {}).get(stat) or 0)
                for record in teammates
            )
            for stat in OPPORTUNITY_STATS
        }
        projected_players = {
            stat: sum(
                1 for record in teammates
                if ((record.raw or {}).get("projected_stats") or {}).get(stat) is not None
            )
            for stat in OPPORTUNITY_STATS
        }

        for record in teammates:
            stats = (record.raw or {}).get("projected_stats") or {}
            shares: dict[str, Any] = {}
            for stat, share_key in OPPORTUNITY_STATS.items():
                if stats.get(stat) is None or stat_totals[stat] <= 0:
                    continue
                shares[share_key] = {
                    "share": round(float(stats[stat]) / stat_totals[stat], 4),
                    "player_value": round(float(stats[stat]), 2),
                    "team_total": round(stat_totals[stat], 2),
                    "players_covered": projected_players[stat],
                }
            result[record.player_id] = {
                "team": team,
                "role_share_estimate": round(role_weights[record.player_id] / role_total, 4)
                if role_total and len(teammates) > 1 else None,
                "teammates_ranked": len(teammates),
                "exact_shares": shares,
                "method": (
                    "Role share is a directional estimate derived from the projection provider's rank "
                    "and normalized among the team's ranked RB, WR, and TE players."
                ),
                "exact_share_method": (
                    "Stat shares divide this player's projection by the sum of available "
                    "projections for ranked teammates; missing players can make them incomplete."
                ),
            }
    return result


def replacement_rank(
    position: str,
    league_size: int,
    starters: dict[str, int],
    flex_slots: int,
    superflex_slots: int = 0,
) -> int:
    """Estimate the last starter at a position, allocating FLEX evenly."""
    flex_share = flex_slots / len(FLEX_POSITIONS) if position in FLEX_POSITIONS else 0
    superflex_share = superflex_slots if position == "QB" else 0
    return max(1, math.ceil(league_size * (starters.get(position, 0) + flex_share + superflex_share)))


def build_projection_analytics(
    records: Iterable[Any],
    rules: Iterable[Any],
    *,
    league_size: int = 12,
    starters: dict[str, int] | None = None,
    flex_slots: int = 1,
    superflex_slots: int = 0,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Score provider projection records and derive position-relative analytics."""
    records = list(records)
    opportunity_by_player = projected_team_opportunity(records)
    normalized_rules = rule_dicts(rules)
    starter_config = {**DEFAULT_STARTERS, **(starters or {})}
    groups: dict[str, list[dict[str, Any]]] = defaultdict(list)

    for record in records:
        position = normalize_position(record.position)
        if not record.player_id or position not in FANTASY_POSITIONS:
            continue
        raw = record.raw or {}
        stats = raw.get("projected_stats") or {}
        native_points = raw.get("projected_points")
        profile_points = score_projected_stats(stats, normalized_rules)
        analytics_points = profile_points if profile_points is not None else native_points
        if analytics_points is None:
            continue

        weekly = []
        for week in raw.get("weekly_projections") or []:
            weekly_profile_points = score_projected_stats(week.get("stats"), normalized_rules)
            weekly.append({
                "week": week.get("week"),
                "espn_points": week.get("points"),
                "profile_points": weekly_profile_points,
            })

        groups[position].append({
            "player_id": record.player_id,
            "full_name": record.full_name,
            "position": position,
            "team": record.team,
            "projection_source": "FantasyPros" if getattr(record, "source", None) == "fantasypros-projection" else "ESPN",
            "espn_points": round(float(native_points), 2) if native_points is not None else None,
            "profile_points": profile_points,
            "analytics_points": round(float(analytics_points), 2),
            "points_per_game": round(float(analytics_points) / 17, 2),
            "scoring_basis": "profile" if profile_points is not None else "source_fallback",
            "weekly": weekly,
            "opportunity": opportunity_by_player.get(record.player_id),
        })

    replacement_ranks: dict[str, int] = {}
    tier_thresholds: dict[str, float] = {}
    rows: list[dict[str, Any]] = []
    for position, players in groups.items():
        players.sort(key=lambda row: (-row["analytics_points"], row["full_name"]))
        rank = replacement_rank(
            position, league_size, starter_config, flex_slots, superflex_slots
        )
        replacement_ranks[position] = rank
        replacement_points = players[min(rank, len(players)) - 1]["analytics_points"]
        threshold = round(max(8.0, players[0]["analytics_points"] * 0.04), 2)
        tier_thresholds[position] = threshold
        tier = 1
        tier_anchor = players[0]["analytics_points"]
        for position_rank, player in enumerate(players, start=1):
            if tier_anchor - player["analytics_points"] >= threshold:
                tier += 1
                tier_anchor = player["analytics_points"]
            player.update({
                "position_rank": position_rank,
                "replacement_rank": rank,
                "replacement_points": replacement_points,
                "vorp": round(player["analytics_points"] - replacement_points, 2),
                "tier": tier,
            })
            rows.append(player)

    rows.sort(key=lambda row: (-row["vorp"], -row["analytics_points"], row["full_name"]))
    methodology = {
        "league_size": league_size,
        "starters": starter_config,
        "flex_slots": flex_slots,
        "superflex_slots": superflex_slots,
        "flex_allocation": "FLEX slots are allocated evenly across RB, WR, and TE.",
        "superflex_allocation": "SUPERFLEX slots are allocated to QB for the replacement baseline.",
        "replacement_ranks": replacement_ranks,
        "tier_thresholds": tier_thresholds,
        "tier_method": "A new position tier begins when projected points fall by at least 4% of the position leader or 8 points from the current tier anchor.",
        "fallback": "A provider's native PPR projection is used only when the selected profile has no rule matching the available projected stats.",
    }
    return rows, methodology
