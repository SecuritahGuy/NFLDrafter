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
        is_current_user = any(_text(manager, "is_current_login") == "1" for manager in managers)
        teams.append(
            {
                "id": team_key,
                "name": _text(team, "name", team_key),
                "owner": owner,
                # Yahoo includes this on the league teams response once the order is set.
                # It is intentionally kept separate from standings rank.
                "draft_position": _int(_text(team, "draft_position")),
                "is_current_user": is_current_user,
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
    modifier_nodes = _descendants(league, "stat_modifier")
    for container in _descendants(league, "stat_modifiers"):
        modifier_nodes.extend(_descendants(container, "stat"))
    seen_modifier_ids: set[str] = set()
    for modifier in modifier_nodes:
        stat_id = _text(modifier, "stat_id")
        if not stat_id or stat_id in seen_modifier_ids:
            continue
        seen_modifier_ids.add(stat_id)
        modifiers.append({"stat_id": stat_id, "value": _float(_text(modifier, "value"))})
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


def parse_league_metadata(xml: str) -> dict:
    """Parse the league fields that drive draft and in-season UI context."""
    root = ET.fromstring(xml)
    leagues = _descendants(root, "league")
    league = leagues[0] if leagues else root
    return {
        "league_id": _text(league, "league_key"),
        "name": _text(league, "name"),
        "season": _int(_text(league, "season")),
        "num_teams": _int(_text(league, "num_teams")),
        "scoring_type": _text(league, "scoring_type"),
        "league_type": _text(league, "league_type"),
        "draft_status": _text(league, "draft_status"),
        "current_week": _int(_text(league, "current_week")),
        "start_week": _int(_text(league, "start_week")),
        "end_week": _int(_text(league, "end_week")),
        "is_finished": _text(league, "is_finished") == "1",
        "renew": _text(league, "renew"),
        "renewed": _text(league, "renewed"),
    }


def parse_draft_results(xml: str) -> list[dict]:
    root = ET.fromstring(xml)
    return [
        {
            "pick": _int(_text(result, "pick")),
            "round": _int(_text(result, "round")),
            "team_id": _text(result, "team_key"),
            "player_id": _text(result, "player_key"),
            "cost": _float(_text(result, "cost")),
        }
        for result in _descendants(root, "draft_result")
        if _text(result, "player_key")
    ]


def parse_transactions(xml: str) -> list[dict]:
    root = ET.fromstring(xml)
    transactions = []
    for transaction in _descendants(root, "transaction"):
        key = _text(transaction, "transaction_key")
        if not key:
            continue
        players = []
        for player in _children(next(iter(_children(transaction, "players")), transaction), "player"):
            data_nodes = _children(player, "transaction_data")
            data = data_nodes[0] if data_nodes else player
            players.append({
                "player_id": _text(player, "player_key"),
                "name": _nested_text(player, ("name", "full")),
                "position": _text(player, "display_position"),
                "team": _text(player, "editorial_team_abbr"),
                "action": _text(data, "type"),
                "source_type": _text(data, "source_type"),
                "source_team_id": _text(data, "source_team_key"),
                "destination_type": _text(data, "destination_type"),
                "destination_team_id": _text(data, "destination_team_key"),
            })
        transactions.append({
            "id": key,
            "type": _text(transaction, "type"),
            "status": _text(transaction, "status"),
            "timestamp": _int(_text(transaction, "timestamp")),
            "trader_team_id": _text(transaction, "trader_team_key"),
            "tradee_team_id": _text(transaction, "tradee_team_key"),
            "players": players,
        })
    return transactions


def parse_scoreboard(xml: str) -> dict:
    root = ET.fromstring(xml)
    scoreboard_nodes = _descendants(root, "scoreboard")
    scoreboard = scoreboard_nodes[0] if scoreboard_nodes else root
    matchups = []
    for matchup in _descendants(scoreboard, "matchup"):
        teams = []
        for team in _descendants(matchup, "team"):
            team_key = _text(team, "team_key")
            if not team_key:
                continue
            teams.append({
                "id": team_key,
                "name": _text(team, "name"),
                "points": _float(_nested_text(team, ("team_points", "total"))),
                "projected_points": _float(_nested_text(team, ("team_projected_points", "total"))),
            })
        if teams:
            matchups.append({
                "week": _int(_text(matchup, "week")),
                "status": _text(matchup, "status"),
                "is_playoffs": _text(matchup, "is_playoffs") == "1",
                "is_consolation": _text(matchup, "is_consolation") == "1",
                "winner_team_id": _text(matchup, "winner_team_key"),
                "teams": teams,
            })
    return {"week": _int(_text(scoreboard, "week")), "matchups": matchups}


def parse_players(xml: str) -> list[dict]:
    """Parse player identity plus optional ownership and draft-analysis subresources."""
    root = ET.fromstring(xml)
    players: dict[str, dict] = {}
    for player in _descendants(root, "player"):
        player_key = _text(player, "player_key")
        if not player_key:
            continue
        stats = {
            _text(stat, "stat_id"): _float(_text(stat, "value"))
            for stat in _descendants(player, "stat")
            if _text(stat, "stat_id") and _text(stat, "value") not in {"", "-"}
        }
        record = {
            "id": player_key,
            "name": _nested_text(player, ("name", "full")),
            "position": _text(player, "display_position"),
            "team": _text(player, "editorial_team_abbr"),
            "status": _text(player, "status"),
            "status_full": _text(player, "status_full"),
            "bye_week": _int(_nested_text(player, ("bye_weeks", "week"))),
            "ownership_type": _nested_text(player, ("ownership", "ownership_type")),
            "owner_team_id": _nested_text(player, ("ownership", "owner_team_key")),
            "percent_owned": _float(_nested_text(player, ("percent_owned", "value"))),
            "percent_owned_delta": _float(_nested_text(player, ("percent_owned", "delta"))),
            "average_pick": _float(_nested_text(player, ("draft_analysis", "average_pick"))),
            "average_round": _float(_nested_text(player, ("draft_analysis", "average_round"))),
            "average_cost": _float(_nested_text(player, ("draft_analysis", "average_cost"))),
            "percent_drafted": _float(_nested_text(player, ("draft_analysis", "percent_drafted"))),
            "stats": stats,
        }
        current = players.setdefault(player_key, {"id": player_key})
        for key, value in record.items():
            if key == "id" or value not in (None, "", [], {}, 0, 0.0):
                current[key] = value
            elif key not in current:
                current[key] = value
    return list(players.values())
