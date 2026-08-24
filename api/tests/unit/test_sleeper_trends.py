from urllib.parse import parse_qs, urlparse

import pytest
from app.services.sleeper_trends import (
    SLEEPER_ATTRIBUTION,
    SleeperTrendingProvider,
)


def test_load_trends_fetches_both_directions_and_resolves_players():
    calls = []
    directory = {
        "p-1": {
            "full_name": "Opportunity Runner",
            "team": "BUF",
            "position": "RB",
        },
        "p-2": {
            "first_name": "Depth",
            "last_name": "Receiver",
            "team": "SEA",
            "position": "WR",
        },
    }

    def fetch_json(url):
        calls.append(url)
        if "/add?" in url:
            return [{"player_id": "p-1", "count": 321}]
        if "/drop?" in url:
            return [{"player_id": "p-2", "count": "87"}]
        raise AssertionError(f"unexpected URL: {url}")

    provider = SleeperTrendingProvider(fetch_json=fetch_json, clock=lambda: 1234.9)
    records = provider.load_trends(
        lookback_hours=48, limit=10, player_directory=directory
    )

    assert [record["direction"] for record in records] == ["add", "drop"]
    assert records[0] == {
        "source": "sleeper",
        "source_url": "https://sleeper.com/",
        "attribution": SLEEPER_ATTRIBUTION,
        "sport": "nfl",
        "direction": "add",
        "lookback_hours": 48,
        "rank": 1,
        "count": 321,
        "sleeper_player_id": "p-1",
        "player": "Opportunity Runner",
        "team": "BUF",
        "position": "RB",
        "resolved": True,
        "fetched_at": 1234,
    }
    assert records[1]["player"] == "Depth Receiver"
    assert records[1]["count"] == 87
    assert len(calls) == 2
    for url in calls:
        assert parse_qs(urlparse(url).query) == {
            "lookback_hours": ["48"],
            "limit": ["10"],
        }


def test_load_trends_uses_injected_directory_loader_only_once():
    calls = {"directory": 0, "http": []}

    def load_directory():
        calls["directory"] += 1
        return [{"player_id": "p-1", "full_name": "Cached Player"}]

    def fetch_json(url):
        calls["http"].append(url)
        return [{"player_id": "p-1", "count": 1}]

    provider = SleeperTrendingProvider(
        fetch_json=fetch_json,
        player_directory_loader=load_directory,
        clock=lambda: 50,
    )
    records = provider.load_trends()

    assert calls["directory"] == 1
    assert len(calls["http"]) == 2
    assert len(records) == 2
    assert all(record["player"] == "Cached Player" for record in records)


def test_unresolved_player_is_retained_for_later_identity_matching():
    provider = SleeperTrendingProvider(
        fetch_json=lambda _url: [{"player_id": "unknown", "count": 9}],
        clock=lambda: 100,
    )

    record = provider.load_direction("add", player_directory={})[0]

    assert record["sleeper_player_id"] == "unknown"
    assert record["player"] is None
    assert record["team"] is None
    assert record["position"] is None
    assert record["resolved"] is False
    assert record["attribution"] == SLEEPER_ATTRIBUTION


@pytest.mark.parametrize(
    ("kwargs", "message"),
    [
        ({"direction": "hold"}, "direction"),
        ({"direction": "add", "lookback_hours": 0}, "lookback_hours"),
        ({"direction": "drop", "limit": 0}, "limit"),
    ],
)
def test_load_direction_validates_parameters(kwargs, message):
    provider = SleeperTrendingProvider(fetch_json=lambda _url: [])

    with pytest.raises(ValueError, match=message):
        provider.load_direction(player_directory={}, **kwargs)
