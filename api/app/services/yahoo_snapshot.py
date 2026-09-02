"""Read-only Yahoo league snapshot ingestion and persistent caching."""

from __future__ import annotations

import asyncio
import hashlib
import os
import time
from typing import Any, Callable

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ApiResponseCache
from .yahoo_xml import (
    parse_draft_results,
    parse_league_metadata,
    parse_players,
    parse_rosters,
    parse_scoreboard,
    parse_settings,
    parse_stat_categories,
    parse_teams,
    parse_transactions,
)
from .yahoo_scoring import translate_yahoo_settings

YAHOO_BASE_URL = "https://fantasysports.yahooapis.com/fantasy/v2"


def _cache_key(league_id: str) -> str:
    return hashlib.sha256(f"yahoo|league-snapshot|{league_id}".encode()).hexdigest()


def _merge_by_id(*groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}
    for group in groups:
        for item in group:
            item_id = item.get("id")
            if not item_id:
                continue
            current = merged.setdefault(item_id, {"id": item_id})
            for key, value in item.items():
                if value not in (None, "", [], {}):
                    current[key] = value
    return list(merged.values())


def _merge_teams(teams: list[dict[str, Any]], standings: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Add standings to team data without replacing Yahoo draft positions with zeros."""
    standings_by_id = {team["id"]: team for team in standings}
    return [
        {
            **team,
            **{
                key: value for key, value in standings_by_id.get(team["id"], {}).items()
                if key not in {"draft_position", "is_current_user"} or value
            },
        }
        for team in teams
    ]


async def get_yahoo_snapshot(db: AsyncSession, league_id: str) -> dict[str, Any] | None:
    row = await db.get(ApiResponseCache, _cache_key(league_id))
    if not row:
        return None
    row.last_accessed_at = int(time.time())
    await db.commit()
    return row.response


async def sync_yahoo_draft_results(
    db: AsyncSession,
    league_id: str,
    access_token: str,
) -> dict[str, Any]:
    """Fetch only the small Yahoo resources needed for the live draft board."""
    headers = {"Authorization": f"Bearer {access_token}"}
    cached_row = await db.get(ApiResponseCache, _cache_key(league_id))
    cached_snapshot = cached_row.response if cached_row and isinstance(cached_row.response, dict) else {}
    cached_players = {
        player.get("id"): player
        for player in cached_snapshot.get("players", [])
        if isinstance(player, dict) and player.get("id")
    }
    async with httpx.AsyncClient(base_url=YAHOO_BASE_URL, timeout=20.0) as client:
        metadata_response, teams_response, results_response = await asyncio.gather(
            client.get(f"/league/{league_id}", headers=headers),
            client.get(f"/league/{league_id}/teams", headers=headers),
            client.get(f"/league/{league_id}/draftresults", headers=headers),
        )

    responses = {"metadata": metadata_response, "teams": teams_response, "draft_results": results_response}
    failed = next((name for name, response in responses.items() if response.status_code != 200), None)
    if failed:
        raise RuntimeError(f"Yahoo HTTP {responses[failed].status_code} while fetching {failed}")

    metadata = parse_league_metadata(metadata_response.text)
    teams = parse_teams(teams_response.text)
    draft_results = parse_draft_results(results_response.text)
    draft_player_ids = list(dict.fromkeys(
        result["player_id"] for result in draft_results if result.get("player_id")
    ))
    missing_player_ids = [player_id for player_id in draft_player_ids if player_id not in cached_players]
    # A player disappears from Yahoo's available feed the moment they are
    # drafted. Hydrate each newly seen result once and retain it in the league
    # snapshot, avoiding opaque player-key placeholders in the draft ledger.
    if missing_player_ids:
        async with httpx.AsyncClient(base_url=YAHOO_BASE_URL, timeout=20.0) as client:
            for start in range(0, len(missing_player_ids), 25):
                keys = ",".join(missing_player_ids[start:start + 25])
                details_response, stats_response = await asyncio.gather(
                    client.get(f"/league/{league_id}/players;player_keys={keys}", headers=headers),
                    client.get(
                        f"/league/{league_id}/players;player_keys={keys}/stats;type=season;season={max(1, int(metadata.get('season') or time.gmtime().tm_year) - 1)}",
                        headers=headers,
                    ),
                )
                if details_response.status_code == 200:
                    for player in parse_players(details_response.text):
                        cached_players[player["id"]] = {**cached_players.get(player["id"], {}), **player}
                if stats_response.status_code == 200:
                    for player in parse_players(stats_response.text):
                        cached_players[player["id"]] = {**cached_players.get(player["id"], {}), **player}
    category_names = {
        category.get("stat_id"): category.get("display_name") or category.get("name")
        for category in cached_snapshot.get("stat_categories", [])
        if isinstance(category, dict) and category.get("stat_id")
    }
    for player in cached_players.values():
        if player.get("stats"):
            player["named_stats"] = {
                category_names.get(stat_id, stat_id): value
                for stat_id, value in player["stats"].items()
            }
    my_team = next((team for team in teams if team.get("is_current_user")), None)
    draft_status = str(metadata.get("draft_status") or "").lower()
    result = {
        "league_id": league_id,
        "fetched_at": int(time.time()),
        "draft_status": draft_status,
        "draft_started": bool(draft_results) or draft_status in {"drafting", "postdraft"},
        "my_team_id": my_team.get("id") if my_team else None,
        "teams": [
            {
                "id": team["id"],
                "name": team.get("name") or team["id"],
                "draft_position": int(team.get("draft_position") or 0),
                "is_current_user": bool(team.get("is_current_user")),
            }
            for team in teams
        ],
        "draft_results": draft_results,
        "players": list(cached_players.values()),
        "read_only": True,
    }

    # Keep the Yahoo detail panel current without downloading the full player pool.
    if cached_row:
        cached_row.response = {
            **cached_snapshot,
            "fetched_at": result["fetched_at"],
            "metadata": {**(cached_snapshot.get("metadata") or {}), **metadata},
            "teams": teams,
            "draft_results": draft_results,
            "players": list(cached_players.values()),
        }
        await db.commit()
    return result


async def sync_yahoo_league_snapshot(
    db: AsyncSession,
    league_id: str,
    access_token: str,
) -> dict[str, Any]:
    """Fetch useful Yahoo read resources and persist one frontend-ready snapshot."""
    headers = {"Authorization": f"Bearer {access_token}"}
    resources: dict[str, dict[str, Any]] = {}
    failures: dict[str, str] = {}

    async with httpx.AsyncClient(base_url=YAHOO_BASE_URL, timeout=45.0) as client:
        async def fetch(name: str, path: str, parser: Callable[[str], Any]) -> Any:
            response = await client.get(path, headers=headers)
            if response.status_code != 200:
                failures[name] = f"Yahoo HTTP {response.status_code}"
                return None
            try:
                parsed = parser(response.text)
            except Exception as exc:  # malformed/unsupported provider response
                failures[name] = str(exc)
                return None
            resources[name] = {"path": path, "status_code": response.status_code}
            return parsed

        metadata = await fetch("metadata", f"/league/{league_id}", parse_league_metadata) or {}
        settings = await fetch("settings", f"/league/{league_id}/settings", parse_settings) or {}
        teams = await fetch("teams", f"/league/{league_id}/teams", parse_teams) or []
        standings = await fetch("standings", f"/league/{league_id}/standings", parse_teams) or []
        rosters = await fetch("rosters", f"/league/{league_id}/teams/roster", parse_rosters) or []
        # Yahoo can return a 200 response containing team containers but no
        # player records for the bulk roster collection.  A completed draft
        # still needs player-level rosters for weekly preparation, so retry
        # through the documented team roster resource before caching an empty
        # result.  Keep this fallback conditional to avoid extra API calls
        # when the bulk resource works normally.
        if teams and not any(roster.get("players") for roster in rosters):
            current_week = int(metadata.get("current_week") or 0)
            roster_suffix = f";week={current_week}" if current_week > 0 else ""
            direct_rosters: list[dict[str, Any]] = []
            for team in teams:
                team_id = team.get("id")
                if not team_id:
                    continue
                parsed = await fetch(
                    f"roster_{team_id}",
                    f"/team/{team_id}/roster{roster_suffix}",
                    parse_rosters,
                ) or []
                direct_rosters.extend(parsed)
            if any(roster.get("players") for roster in direct_rosters):
                rosters = direct_rosters
        draft_results = await fetch("draft_results", f"/league/{league_id}/draftresults", parse_draft_results) or []
        # Draft results only contain Yahoo player keys. Fetch those player
        # records explicitly so a completed draft can still display names and
        # prior-season stats after players leave the available-player feed.
        # This also makes the cached snapshot self-sufficient for a post-draft
        # roster review.
        draft_player_ids = list(dict.fromkeys(
            result["player_id"] for result in draft_results if result.get("player_id")
        ))
        drafted_groups: list[list[dict[str, Any]]] = []
        for start in range(0, len(draft_player_ids), 25):
            keys = ",".join(draft_player_ids[start:start + 25])
            drafted_groups.append(await fetch(
                f"drafted_players_{start}",
                f"/league/{league_id}/players;player_keys={keys}",
                parse_players,
            ) or [])
        transactions = await fetch("transactions", f"/league/{league_id}/transactions;count=50", parse_transactions) or []
        scoreboard = await fetch("scoreboard", f"/league/{league_id}/scoreboard", parse_scoreboard) or {"week": 0, "matchups": []}

        game_key = league_id.split(".", 1)[0]
        categories = await fetch(
            "stat_categories", f"/game/{game_key}/stat_categories", parse_stat_categories
        ) or []
        settings = {**settings, "translation": translate_yahoo_settings(settings, categories)}

        available_limit = max(25, min(int(os.getenv("YAHOO_AVAILABLE_PLAYER_LIMIT", "300")), 300))
        available_groups: list[list[dict[str, Any]]] = []
        for start in range(0, available_limit, 25):
            base = f"/league/{league_id}/players;status=A;sort=OR;start={start};count=25"
            base_players = await fetch(f"available_{start}", base, parse_players)
            if not base_players:
                break
            analysis = await fetch(
                f"draft_analysis_{start}", f"{base}/draft_analysis", parse_players
            ) or []
            owned = await fetch(
                f"percent_owned_{start}", f"{base}/percent_owned", parse_players
            ) or []
            available_groups.append(_merge_by_id(base_players, analysis, owned))

        available_players = _merge_by_id(*available_groups)
        roster_player_ids = [
            player.get("id")
            for roster in rosters
            for player in roster.get("players", [])
            if player.get("id")
        ]
        stat_player_ids = list(dict.fromkeys(
            roster_player_ids + draft_player_ids + [p["id"] for p in available_players]
        ))
        stat_groups: list[list[dict[str, Any]]] = []
        stats_season = max(1, int(metadata.get("season") or time.gmtime().tm_year) - 1)
        stat_limit = max(25, min(int(os.getenv("YAHOO_PLAYER_STATS_LIMIT", "300")), 500))
        for start in range(0, min(len(stat_player_ids), stat_limit), 25):
            keys = ",".join(stat_player_ids[start:start + 25])
            stats = await fetch(
                f"player_stats_{start}",
                f"/league/{league_id}/players;player_keys={keys}/stats;type=season;season={stats_season}",
                parse_players,
            ) or []
            stat_groups.append(stats)
        yahoo_players = _merge_by_id(available_players, *drafted_groups, *stat_groups)

    teams = _merge_teams(teams, standings)
    category_names = {
        category["stat_id"]: category.get("display_name") or category.get("name")
        for category in categories
    }
    for player in yahoo_players:
        player["named_stats"] = {
            category_names.get(stat_id, stat_id): value
            for stat_id, value in (player.get("stats") or {}).items()
        }

    fetched_at = int(time.time())
    snapshot = {
        "league_id": league_id,
        "fetched_at": fetched_at,
        "stats_season": stats_season,
        "metadata": metadata,
        "settings": settings,
        "stat_categories": categories,
        "teams": teams,
        "rosters": rosters,
        "draft_results": draft_results,
        "transactions": transactions,
        "scoreboard": scoreboard,
        "players": yahoo_players,
        "coverage": {
            "teams": len(teams),
            "rosters": len(rosters),
            "rostered_players": len(roster_player_ids),
            "available_players": len(available_players),
            "drafted_players": len(_merge_by_id(*drafted_groups)),
            "players_with_stats": sum(
                any(float(value or 0) != 0 for value in (player.get("stats") or {}).values())
                for player in yahoo_players
            ),
            "draft_results": len(draft_results),
            "transactions": len(transactions),
            "matchups": len(scoreboard.get("matchups") or []),
            "stat_categories": len(categories),
        },
        "resources": resources,
        "failures": failures,
        "read_only": True,
    }
    values = {
        "provider": "yahoo",
        "endpoint": "/league-snapshot",
        "query": {"league_id": league_id},
        "response": snapshot,
        "fetched_at": fetched_at,
        "expires_at": 2_147_483_647,
        "last_accessed_at": fetched_at,
        "status_code": 200,
        "response_headers": {},
    }
    row = await db.get(ApiResponseCache, _cache_key(league_id))
    if row:
        for field, value in values.items():
            setattr(row, field, value)
    else:
        db.add(ApiResponseCache(cache_key=_cache_key(league_id), **values))
    await db.commit()
    return snapshot
