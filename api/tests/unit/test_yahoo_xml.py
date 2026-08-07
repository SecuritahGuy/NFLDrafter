from app.services.yahoo_xml import (
    parse_leagues,
    parse_rosters,
    parse_settings,
    parse_stat_categories,
    parse_teams,
)


XML = """<?xml version="1.0"?>
<fantasy_content xmlns="http://fantasysports.yahooapis.com/fantasy/v2/base.rng">
  <league>
    <league_key>461.l.123</league_key><name>Home League</name><season>2026</season>
    <scoring_type>headpoint</scoring_type><num_teams>12</num_teams><is_public>0</is_public>
    <settings>
      <roster_positions><roster_position><position>QB</position><count>1</count></roster_position></roster_positions>
      <stat_modifiers><stat_modifier><stat_id>4</stat_id><value>4</value></stat_modifier></stat_modifiers>
    </settings>
  </league>
  <teams>
    <team>
      <team_key>461.l.123.t.1</team_key><name>Chicago Dogs</name>
      <managers><manager><nickname>Tim</nickname></manager></managers>
      <team_standings><rank>2</rank><outcome_totals><wins>8</wins><losses>5</losses><ties>1</ties></outcome_totals><points_for>1500.2</points_for><points_against>1401.1</points_against></team_standings>
      <roster><players><player><player_key>461.p.42</player_key><name><full>Example Player</full></name><display_position>WR</display_position><editorial_team_abbr>CHI</editorial_team_abbr><selected_position><position>WR</position></selected_position></player></players></roster>
    </team>
  </teams>
</fantasy_content>"""

CATEGORIES_XML = """<fantasy_content xmlns="http://fantasysports.yahooapis.com/fantasy/v2/base.rng">
  <game><stat_categories><stats>
    <stat><stat_id>4</stat_id><name>Passing Yards</name><display_name>Pass Yds</display_name><abbr>PY</abbr><position_types><position_type>O</position_type></position_types></stat>
  </stats></stat_categories></game>
</fantasy_content>"""


def test_parses_league_and_settings_with_namespaces():
    assert parse_leagues(XML) == [{
        "id": "461.l.123", "name": "Home League", "season": 2026,
        "scoring_type": "headpoint", "num_teams": 12, "is_public": False,
    }]
    settings = parse_settings(XML)
    assert settings["roster_positions"] == [{"position": "QB", "count": 1}]
    assert settings["stat_modifiers"] == [{"stat_id": "4", "value": 4.0}]


def test_parses_teams_and_rosters_without_name_only_matching():
    teams = parse_teams(XML)
    assert teams[0] == {
        "id": "461.l.123.t.1", "name": "Chicago Dogs", "owner": "Tim", "rank": 2,
        "wins": 8, "losses": 5, "ties": 1, "points_for": 1500.2, "points_against": 1401.1,
    }
    rosters = parse_rosters(XML)
    assert rosters[0]["players"][0] == {
        "id": "461.p.42", "name": "Example Player", "position": "WR",
        "selected_position": "WR", "team": "CHI",
    }


def test_parses_stat_category_metadata():
    assert parse_stat_categories(CATEGORIES_XML) == [{
        "stat_id": "4",
        "name": "Passing Yards",
        "display_name": "Pass Yds",
        "abbr": "PY",
        "position_types": ["O"],
    }]
