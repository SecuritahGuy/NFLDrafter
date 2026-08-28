from app.services.yahoo_xml import (
    parse_draft_results,
    parse_league_metadata,
    parse_leagues,
    parse_players,
    parse_rosters,
    parse_scoreboard,
    parse_settings,
    parse_stat_categories,
    parse_teams,
    parse_transactions,
)


XML = """<?xml version="1.0"?>
<fantasy_content xmlns="http://fantasysports.yahooapis.com/fantasy/v2/base.rng">
  <league>
    <league_key>461.l.123</league_key><name>Home League</name><season>2026</season>
    <scoring_type>headpoint</scoring_type><num_teams>12</num_teams><is_public>0</is_public>
    <settings>
      <roster_positions><roster_position><position>QB</position><count>1</count></roster_position></roster_positions>
      <stat_modifiers><stats><stat><stat_id>4</stat_id><value>4</value></stat></stats></stat_modifiers>
    </settings>
  </league>
  <teams>
    <team>
      <team_key>461.l.123.t.1</team_key><name>Chicago Dogs</name>
      <managers><manager><nickname>Tim</nickname><is_current_login>1</is_current_login></manager></managers>
      <draft_position>4</draft_position>
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

READ_RESOURCES_XML = """<fantasy_content xmlns="http://fantasysports.yahooapis.com/fantasy/v2/base.rng">
  <league><league_key>461.l.123</league_key><name>Home League</name><season>2026</season><num_teams>12</num_teams><draft_status>postdraft</draft_status><current_week>3</current_week><start_week>1</start_week><end_week>17</end_week></league>
  <draft_results><draft_result><pick>1</pick><round>1</round><team_key>461.l.123.t.1</team_key><player_key>461.p.42</player_key><cost>55</cost></draft_result></draft_results>
  <transactions><transaction><transaction_key>461.l.123.tr.1</transaction_key><type>add/drop</type><status>successful</status><timestamp>1234</timestamp><players><player><player_key>461.p.42</player_key><name><full>Example Player</full></name><display_position>WR</display_position><transaction_data><type>add</type><destination_type>team</destination_type><destination_team_key>461.l.123.t.1</destination_team_key></transaction_data></player></players></transaction></transactions>
  <scoreboard><week>3</week><matchups><matchup><week>3</week><status>postevent</status><winner_team_key>461.l.123.t.1</winner_team_key><teams><team><team_key>461.l.123.t.1</team_key><name>Chicago Dogs</name><team_points><total>121.5</total></team_points><team_projected_points><total>118.2</total></team_projected_points></team></teams></matchup></matchups></scoreboard>
  <players><player><player_key>461.p.42</player_key><name><full>Example Player</full></name><display_position>WR</display_position><editorial_team_abbr>CHI</editorial_team_abbr><percent_owned><value>81</value><delta>2</delta></percent_owned><draft_analysis><average_pick>22.4</average_pick><average_round>2.8</average_round><percent_drafted>99</percent_drafted></draft_analysis><player_stats><stats><stat><stat_id>4</stat_id><value>100</value></stat></stats></player_stats></player></players>
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
        "id": "461.l.123.t.1", "name": "Chicago Dogs", "owner": "Tim", "draft_position": 4,
        "is_current_user": True, "rank": 2,
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


def test_parses_high_value_read_only_resources():
    metadata = parse_league_metadata(READ_RESOURCES_XML)
    assert metadata["draft_status"] == "postdraft"
    assert metadata["current_week"] == 3
    assert parse_draft_results(READ_RESOURCES_XML)[0]["player_id"] == "461.p.42"
    assert parse_transactions(READ_RESOURCES_XML)[0]["players"][0]["action"] == "add"
    assert parse_scoreboard(READ_RESOURCES_XML)["matchups"][0]["teams"][0]["points"] == 121.5
    player = parse_players(READ_RESOURCES_XML)[0]
    assert player["percent_owned"] == 81.0
    assert player["average_pick"] == 22.4
    assert player["stats"] == {"4": 100.0}
