import pytest
from sqlalchemy import select

from app.models import ScoringProfile, ScoringRule
from app.services.yahoo_scoring import (
    category_stat_key,
    persist_yahoo_scoring_profile,
    translate_yahoo_settings,
)


SETTINGS = {
    "league_id": "461.l.123",
    "name": "Home League",
    "season": 2026,
    "num_teams": 12,
    "roster_positions": [
        {"position": "QB", "count": 1},
        {"position": "W/R/T", "count": 2},
        {"position": "BN", "count": 6},
        {"position": "IR", "count": 2},
    ],
    "stat_modifiers": [
        {"stat_id": "4", "value": 0.04},
        {"stat_id": "5", "value": 4},
        {"stat_id": "999", "value": 3},
    ],
}

CATEGORIES = [
    {"stat_id": "4", "name": "Passing Yards", "display_name": "Pass Yds", "abbr": "PY"},
    {"stat_id": "5", "name": "Passing Touchdowns", "display_name": "Pass TD", "abbr": "PTD"},
    {"stat_id": "999", "name": "Mystery Bonus", "display_name": "Mystery", "abbr": "MB"},
]


def test_translates_named_categories_and_reports_unknown_rules():
    translated = translate_yahoo_settings(SETTINGS, CATEGORIES)
    assert [rule["stat_key"] for rule in translated["rules"]] == [
        "passing_yards", "passing_touchdowns"
    ]
    assert translated["unmapped_stat_modifiers"] == [{
        "stat_id": "999", "value": 3.0, "name": "Mystery Bonus"
    }]
    assert translated["roster_slots"][1]["normalized_position"] == "FLEX"
    assert translated["draft_config"] == {"league_size": 12, "rounds": 9}
    assert translated["complete"] is False


def test_uses_position_metadata_to_disambiguate_interceptions():
    assert category_stat_key({"name": "Interceptions", "position_types": ["O"]}) == "interceptions"
    assert category_stat_key({"name": "Interceptions", "position_types": ["DT"]}) == "defense_interceptions"


@pytest.mark.asyncio
async def test_profile_import_is_idempotent_and_replaces_rules(db_session):
    translated = translate_yahoo_settings(SETTINGS, CATEGORIES[:2])
    first = await persist_yahoo_scoring_profile(db_session, SETTINGS, translated)
    second = await persist_yahoo_scoring_profile(db_session, SETTINGS, translated)
    assert first["profile_id"] == second["profile_id"]
    profiles = (
        await db_session.execute(
            select(ScoringProfile).where(ScoringProfile.profile_id == first["profile_id"])
        )
    ).scalars().all()
    rules = (
        await db_session.execute(
            select(ScoringRule).where(ScoringRule.profile_id == first["profile_id"])
        )
    ).scalars().all()
    assert len(profiles) == 1
    assert len(rules) == 2
    assert {rule.stat_key for rule in rules} == {"passing_yards", "passing_touchdowns"}
