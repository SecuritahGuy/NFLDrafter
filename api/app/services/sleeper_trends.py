"""Sleeper add/drop trends normalized as fantasy-market signals.

Sleeper exposes these read-only endpoints without authentication. Trending
counts describe actions by Sleeper users during a requested lookback window;
they are market context, not news, rankings, or performance projections.

Data source attribution: Sleeper (https://sleeper.com/).
API documentation: https://docs.sleeper.com/
"""

from __future__ import annotations

import json
import time
import urllib.parse
import urllib.request
from collections.abc import Iterable, Mapping
from dataclasses import dataclass
from typing import Any, Callable

_SLEEPER_API_BASE = "https://api.sleeper.app/v1"
_PLAYERS_URL = f"{_SLEEPER_API_BASE}/players/nfl"
_TRENDING_URL = f"{_SLEEPER_API_BASE}/players/nfl/trending"

SLEEPER_ATTRIBUTION = "Trending data provided by Sleeper"
SLEEPER_HOMEPAGE_URL = "https://sleeper.com/"

JsonFetcher = Callable[[str], Any]
PlayerDirectory = Mapping[str, Mapping[str, Any]] | Iterable[Mapping[str, Any]]


def _fetch_json(url: str) -> Any:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "NFLDrafter/0.1 (+Sleeper public API)"},
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read())


def _clean(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = str(value).strip()
    return cleaned or None


def _directory_by_id(directory: PlayerDirectory) -> dict[str, Mapping[str, Any]]:
    """Accept either Sleeper's keyed payload or an injected normalized list."""
    if isinstance(directory, Mapping):
        return {str(player_id): row for player_id, row in directory.items()}

    indexed: dict[str, Mapping[str, Any]] = {}
    for row in directory:
        player_id = row.get("sleeper_player_id") or row.get("player_id")
        if player_id is not None:
            indexed[str(player_id)] = row
    return indexed


def _player_name(row: Mapping[str, Any]) -> str | None:
    full_name = _clean(row.get("full_name"))
    if full_name:
        return full_name
    parts = [_clean(row.get("first_name")), _clean(row.get("last_name"))]
    joined = " ".join(part for part in parts if part)
    return joined or None


@dataclass(slots=True)
class SleeperTrendingProvider:
    """Fetch and normalize Sleeper add/drop activity.

    ``fetch_json`` and ``player_directory_loader`` are injectable so scheduled
    ingestion and tests can use a cached player directory and deterministic
    transport. If neither a directory nor loader is supplied, the provider
    fetches Sleeper's public NFL player directory once per ``load_trends`` call.
    """

    fetch_json: JsonFetcher = _fetch_json
    player_directory_loader: Callable[[], PlayerDirectory] | None = None
    clock: Callable[[], float] = time.time

    def load_player_directory(self) -> PlayerDirectory:
        if self.player_directory_loader is not None:
            return self.player_directory_loader()
        payload = self.fetch_json(_PLAYERS_URL)
        return payload or {}

    def load_direction(
        self,
        direction: str,
        *,
        lookback_hours: int = 24,
        limit: int = 25,
        player_directory: PlayerDirectory | None = None,
        fetched_at: int | None = None,
    ) -> list[dict[str, Any]]:
        """Return one direction's ranked activity with resolved player fields."""
        normalized_direction = direction.strip().lower()
        if normalized_direction not in {"add", "drop"}:
            raise ValueError("direction must be 'add' or 'drop'")
        if lookback_hours < 1:
            raise ValueError("lookback_hours must be positive")
        if limit < 1:
            raise ValueError("limit must be positive")

        directory = _directory_by_id(
            player_directory
            if player_directory is not None
            else self.load_player_directory()
        )
        query = urllib.parse.urlencode(
            {"lookback_hours": lookback_hours, "limit": limit}
        )
        url = f"{_TRENDING_URL}/{normalized_direction}?{query}"
        payload = self.fetch_json(url) or []
        captured_at = int(self.clock()) if fetched_at is None else fetched_at

        records: list[dict[str, Any]] = []
        for rank, trend in enumerate(payload, start=1):
            player_id = _clean(trend.get("player_id"))
            if not player_id:
                continue
            player = directory.get(player_id, {})
            try:
                count = int(trend.get("count") or 0)
            except (TypeError, ValueError):
                count = 0
            records.append(
                {
                    "source": "sleeper",
                    "source_url": SLEEPER_HOMEPAGE_URL,
                    "attribution": SLEEPER_ATTRIBUTION,
                    "sport": "nfl",
                    "direction": normalized_direction,
                    "lookback_hours": lookback_hours,
                    "rank": rank,
                    "count": count,
                    "sleeper_player_id": player_id,
                    "player": _player_name(player),
                    "team": _clean(player.get("team")),
                    "position": _clean(player.get("position")),
                    "resolved": bool(player),
                    "fetched_at": captured_at,
                }
            )
        return records

    def load_trends(
        self,
        *,
        lookback_hours: int = 24,
        limit: int = 25,
        player_directory: PlayerDirectory | None = None,
    ) -> list[dict[str, Any]]:
        """Fetch both add and drop trends against one player-directory snapshot."""
        directory = (
            player_directory
            if player_directory is not None
            else self.load_player_directory()
        )
        captured_at = int(self.clock())
        records: list[dict[str, Any]] = []
        for direction in ("add", "drop"):
            records.extend(
                self.load_direction(
                    direction,
                    lookback_hours=lookback_hours,
                    limit=limit,
                    player_directory=directory,
                    fetched_at=captured_at,
                )
            )
        return records
