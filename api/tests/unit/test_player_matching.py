import pytest
from sqlalchemy import select

from app.models import Player, PlayerIdentifier
from app.services.player_matching import (
    map_yahoo_rosters,
    match_player,
    normalize_name,
)


def player(player_id, name, position, team, yahoo_id=None, espn_id=None):
    return Player(
        player_id=player_id,
        full_name=name,
        position=position,
        team=team,
        yahoo_id=yahoo_id,
        espn_id=espn_id,
    )


def test_prefers_durable_espn_id_over_changed_team_and_name():
    candidates = [player("gsis-1", "Hollywood Brown", "WR", "KC", espn_id="4431")]
    result = match_player(
        {"espn_id": "4431", "name": "Marquise Brown", "position": "WR", "team": "FA"},
        candidates,
    )
    assert result.canonical_player_id == "gsis-1"
    assert result.method == "espn_id"
    assert result.confidence == 1.0


def test_normalizes_suffixes_punctuation_and_accents():
    assert normalize_name("Marvin Harrison, Jr.") == "marvin harrison"
    assert normalize_name("Amon-Ra St. Brown") == "amon ra st brown"
    assert normalize_name("Ja'Marr Chase") == normalize_name("JaMarr Chase")
    assert normalize_name("De’Von Achane") == normalize_name("DeVon Achane")
    assert normalize_name("A.J. Brown") == normalize_name("AJ Brown")


def test_prefers_durable_yahoo_id_over_changed_team_and_name():
    candidates = [player("gsis-1", "Hollywood Brown", "WR", "KC", "30123")]
    result = match_player(
        {"id": "461.p.30123", "name": "Marquise Brown", "position": "WR", "team": "FA"},
        candidates,
    )
    assert result.canonical_player_id == "gsis-1"
    assert result.method == "yahoo_id"
    assert result.confidence == 1.0


def test_does_not_guess_between_duplicate_names():
    candidates = [
        player("one", "Chris Smith", "WR", "CHI"),
        player("two", "Chris Smith", "WR", "DAL"),
    ]
    result = match_player(
        {"id": "461.p.5", "name": "Chris Smith", "position": "WR", "team": ""},
        candidates,
    )
    assert result.status == "ambiguous"
    assert set(result.candidate_ids) == {"one", "two"}


@pytest.mark.asyncio
async def test_persists_season_aware_yahoo_mapping(db_session):
    db_session.add(player("gsis-2", "Marvin Harrison Jr.", "WR", "ARI"))
    await db_session.flush()
    summary = await map_yahoo_rosters(
        db_session,
        [{"team_id": "team-1", "players": [{
            "id": "461.p.42", "name": "Marvin Harrison", "position": "WR", "team": "ARI"
        }]}],
        2026,
    )
    assert summary["matched"] == 1
    mapping = (await db_session.execute(select(PlayerIdentifier))).scalar_one()
    assert mapping.canonical_player_id == "gsis-2"
    assert mapping.external_id == "461.p.42"
    assert mapping.season == 2026
    assert mapping.match_confidence == 0.99
