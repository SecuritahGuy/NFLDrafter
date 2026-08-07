"""Durable, conservative matching for external fantasy player identifiers."""

from __future__ import annotations

from dataclasses import asdict, dataclass
import re
import time
import unicodedata
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Player, PlayerIdentifier


_SUFFIXES = {"jr", "sr", "ii", "iii", "iv", "v"}
_TEAM_ALIASES = {
    "GBP": "GB",
    "KCC": "KC",
    "LVR": "LV",
    "NEP": "NE",
    "NOS": "NO",
    "SFO": "SF",
    "TBB": "TB",
    "JAC": "JAX",
    "OAK": "LV",
    "SD": "LAC",
    "STL": "LAR",
    "WSH": "WAS",
}


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    ascii_name = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    ascii_name = re.sub(r"['’`]+", "", ascii_name).replace(".", "")
    parts = re.sub(r"[^a-z0-9]+", " ", ascii_name.lower()).split()
    while parts and parts[-1] in _SUFFIXES:
        parts.pop()
    return " ".join(parts)


def normalize_team(value: str | None) -> str:
    team = re.sub(r"[^A-Z]", "", (value or "").upper())
    return _TEAM_ALIASES.get(team, team)


def normalize_position(value: str | None) -> str:
    position = re.sub(r"[^A-Z]", "", (value or "").upper())
    return "DST" if position in {"D", "DEF", "DST"} else position


def yahoo_numeric_id(value: str | None) -> str:
    if not value:
        return ""
    match = re.search(r"(?:\.p\.)?(\d+)$", value)
    return match.group(1) if match else value


@dataclass(frozen=True)
class PlayerMatch:
    status: str
    canonical_player_id: str | None = None
    confidence: float = 0.0
    method: str = "unmatched"
    candidate_ids: tuple[str, ...] = ()


def match_player(
    external: dict,
    candidates: list[Player],
) -> PlayerMatch:
    """Match only when identity evidence is unique; ambiguity is never guessed."""

    espn_id = str(external.get("espn_id") or "")
    if espn_id:
        espn_matches = [
            player for player in candidates if player.espn_id and str(player.espn_id) == espn_id
        ]
        if len(espn_matches) == 1:
            return PlayerMatch("matched", espn_matches[0].player_id, 1.0, "espn_id")
        if len(espn_matches) > 1:
            return PlayerMatch(
                "ambiguous", candidate_ids=tuple(player.player_id for player in espn_matches)
            )

    external_id = str(external.get("id") or "")
    numeric_id = yahoo_numeric_id(external_id)
    id_matches = [
        player
        for player in candidates
        if player.yahoo_id and yahoo_numeric_id(player.yahoo_id) == numeric_id
    ]
    if len(id_matches) == 1:
        return PlayerMatch("matched", id_matches[0].player_id, 1.0, "yahoo_id")
    if len(id_matches) > 1:
        return PlayerMatch(
            "ambiguous", candidate_ids=tuple(player.player_id for player in id_matches)
        )

    name = normalize_name(external.get("name"))
    position = normalize_position(external.get("position"))
    team = normalize_team(external.get("team"))
    facts = [
        (
            player,
            normalize_name(player.full_name),
            normalize_position(player.position),
            normalize_team(player.team),
        )
        for player in candidates
    ]

    if position == "DST" and team:
        matches = [player for player, _, pos, nfl_team in facts if pos == "DST" and nfl_team == team]
        if len(matches) == 1:
            return PlayerMatch("matched", matches[0].player_id, 0.99, "defense_team_position")

    strategies = (
        (
            "name_position_team",
            0.99,
            bool(name and position and team),
            lambda item: item[1] == name and item[2] == position and item[3] == team,
        ),
        (
            "name_position",
            0.90,
            bool(name and position),
            lambda item: item[1] == name and item[2] == position,
        ),
        (
            "name_team",
            0.86,
            bool(name and team),
            lambda item: item[1] == name and item[3] == team,
        ),
    )
    for method, confidence, has_evidence, predicate in strategies:
        if not has_evidence:
            continue
        matches = [item[0] for item in facts if predicate(item)]
        if len(matches) == 1:
            return PlayerMatch("matched", matches[0].player_id, confidence, method)
        if len(matches) > 1:
            return PlayerMatch(
                "ambiguous",
                method=method,
                candidate_ids=tuple(player.player_id for player in matches),
            )
    return PlayerMatch("unmatched")


async def map_yahoo_rosters(
    db: AsyncSession,
    rosters: list[dict],
    season: int,
) -> dict:
    """Resolve Yahoo roster players and persist successful mappings atomically."""

    players = list((await db.execute(select(Player))).scalars().all())
    identifiers = list(
        (
            await db.execute(
                select(PlayerIdentifier).where(
                    PlayerIdentifier.platform == "yahoo",
                    PlayerIdentifier.season == season,
                )
            )
        ).scalars().all()
    )
    existing = {identifier.external_id: identifier for identifier in identifiers}
    seen: set[str] = set()
    results: list[dict] = []

    for roster in rosters:
        for external in roster.get("players", []):
            external_id = str(external.get("id") or "")
            if not external_id or external_id in seen:
                continue
            seen.add(external_id)
            identifier = existing.get(external_id)
            if identifier:
                match = PlayerMatch(
                    "matched",
                    identifier.canonical_player_id,
                    identifier.match_confidence,
                    "existing_mapping",
                )
            else:
                match = match_player(external, players)
                if match.status == "matched" and match.canonical_player_id:
                    identifier = PlayerIdentifier(
                        identifier_id=str(uuid.uuid4()),
                        canonical_player_id=match.canonical_player_id,
                        platform="yahoo",
                        external_id=external_id,
                        season=season,
                        name=external.get("name") or None,
                        team=external.get("team") or None,
                        position=external.get("position") or None,
                        match_confidence=match.confidence,
                        match_method=match.method,
                        created_at=int(time.time()),
                    )
                    db.add(identifier)
                    player = next(
                        item for item in players if item.player_id == match.canonical_player_id
                    )
                    if not player.yahoo_id:
                        player.yahoo_id = yahoo_numeric_id(external_id)

            results.append({"external_id": external_id, **asdict(match)})

    await db.flush()
    return {
        "season": season,
        "total": len(results),
        "matched": sum(item["status"] == "matched" for item in results),
        "ambiguous": sum(item["status"] == "ambiguous" for item in results),
        "unmatched": sum(item["status"] == "unmatched" for item in results),
        "results": results,
    }
