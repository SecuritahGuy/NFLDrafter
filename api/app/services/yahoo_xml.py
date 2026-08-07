"""Small, fixture-friendly Yahoo Fantasy Sports XML parser."""

from __future__ import annotations

from xml.etree import ElementTree as ET


def _name(element: ET.Element) -> str:
    return element.tag.rsplit("}", 1)[-1]


def _children(element: ET.Element, name: str) -> list[ET.Element]:
    return [child for child in element if _name(child) == name]


def _descendants(element: ET.Element, name: str) -> list[ET.Element]:
    return [child for child in element.iter() if _name(child) == name]


def _text(element: ET.Element, name: str, default: str = "") -> str:
    for child in element:
        if _name(child) == name:
            return (child.text or default).strip()
    return default


def _nested_text(element: ET.Element, path: tuple[str, ...], default: str = "") -> str:
    current = element
    for name in path:
        matches = _children(current, name)
        if not matches:
            return default
        current = matches[0]
    return (current.text or default).strip()


def _int(value: str, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _float(value: str, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def parse_user(xml: str) -> dict:
    root = ET.fromstring(xml)
    users = _descendants(root, "user")
    user = users[0] if users else root
    guid = _text(user, "guid") or _nested_text(user, ("profile", "guid"))
    nickname = _nested_text(user, ("profile", "nickname"))
    return {"id": guid, "email": "", "name": nickname or "Yahoo Fantasy user", "leagues": []}


def parse_leagues(xml: str) -> list[dict]:
    root = ET.fromstring(xml)
    leagues = []
    for league in _descendants(root, "league"):
        league_key = _text(league, "league_key")
        if not league_key:
            continue
        leagues.append(
            {
                "id": league_key,
                "name": _text(league, "name", league_key),
                "season": _int(_text(league, "season")),
                "scoring_type": _text(league, "scoring_type", "unknown"),
                "num_teams": _int(_text(league, "num_teams")),
                "is_public": _text(league, "is_public") == "1",
            }
        )
    return leagues


def parse_teams(xml: str) -> list[dict]:
    root = ET.fromstring(xml)
    teams = []
    for team in _descendants(root, "team"):
        team_key = _text(team, "team_key")
        if not team_key:
            continue
        managers = _descendants(team, "manager")
        owner = _text(managers[0], "nickname") if managers else ""
        teams.append(
            {
                "id": team_key,
                "name": _text(team, "name", team_key),
                "owner": owner,
                "rank": _int(_nested_text(team, ("team_standings", "rank"))),
                "wins": _int(_nested_text(team, ("team_standings", "outcome_totals", "wins"))),
                "losses": _int(_nested_text(team, ("team_standings", "outcome_totals", "losses"))),
                "ties": _int(_nested_text(team, ("team_standings", "outcome_totals", "ties"))),
                "points_for": _float(_nested_text(team, ("team_standings", "points_for"))),
                "points_against": _float(_nested_text(team, ("team_standings", "points_against"))),
            }
        )
    return teams


def parse_rosters(xml: str) -> list[dict]:
    root = ET.fromstring(xml)
    rosters = []
    for team in _descendants(root, "team"):
        team_key = _text(team, "team_key")
        if not team_key:
            continue
        players = []
        for player in _descendants(team, "player"):
            player_key = _text(player, "player_key")
            if not player_key:
                continue
            full = _nested_text(player, ("name", "full")) or _text(player, "name")
            players.append(
                {
                    "id": player_key,
                    "name": full,
                    "position": _text(player, "display_position"),
                    "selected_position": _nested_text(player, ("selected_position", "position")),
                    "team": _text(player, "editorial_team_abbr"),
                }
            )
        rosters.append({"team_id": team_key, "players": players})
    return rosters


def parse_settings(xml: str) -> dict:
    root = ET.fromstring(xml)
    league_nodes = _descendants(root, "league")
    league = league_nodes[0] if league_nodes else root
    roster_positions = []
    for position in _descendants(league, "roster_position"):
        roster_positions.append(
            {
                "position": _text(position, "position"),
                "count": _int(_text(position, "count")),
            }
        )
    modifiers = []
    for modifier in _descendants(league, "stat_modifier"):
        modifiers.append(
            {
                "stat_id": _text(modifier, "stat_id"),
                "value": _float(_text(modifier, "value")),
            }
        )
    return {
        "league_id": _text(league, "league_key"),
        "name": _text(league, "name"),
        "season": _int(_text(league, "season")),
        "scoring_type": _text(league, "scoring_type"),
        "num_teams": _int(_text(league, "num_teams")),
        "roster_positions": roster_positions,
        "stat_modifiers": modifiers,
    }


def parse_stat_categories(xml: str) -> list[dict]:
    """Parse game-level stat metadata used to interpret league modifiers."""

    root = ET.fromstring(xml)
    categories = []
    for stat in _descendants(root, "stat"):
        stat_id = _text(stat, "stat_id")
        if not stat_id:
            continue
        categories.append(
            {
                "stat_id": stat_id,
                "name": _text(stat, "name"),
                "display_name": _text(stat, "display_name"),
                "abbr": _text(stat, "abbr"),
                "position_types": [
                    (node.text or "").strip()
                    for node in _descendants(stat, "position_type")
                    if (node.text or "").strip()
                ],
            }
        )
    return categories
