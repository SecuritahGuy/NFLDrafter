from app.services.nflverse import build_usage_stat_records


def test_build_usage_stat_records_maps_snap_and_opportunity_metrics():
    records = build_usage_stat_records(
        2025,
        [{
            "season": 2025, "week": 1, "game_type": "REG",
            "pfr_player_id": "TestPl01", "offense_snaps": 48, "offense_pct": 0.75,
        }],
        [{
            "season": "2025", "week": 1.0, "player_id": "00-test",
            "rush_attempt": 12, "rush_attempt_team": 24,
            "total_fantasy_points_exp": 18.4,
            "rec_fantasy_points_exp": 7.2,
            "rush_fantasy_points_exp": 11.2,
        }],
        [{"pfr_id": "TestPl01", "gsis_id": "00-test"}],
    )

    values = {record["stat_key"]: record["stat_value"] for record in records}
    assert values == {
        "offense_snaps": 48.0,
        "offense_snap_share": 0.75,
        "rushing_attempt_share": 0.5,
        "expected_fantasy_points": 18.4,
        "receiving_expected_fantasy_points": 7.2,
        "rushing_expected_fantasy_points": 11.2,
    }


def test_build_usage_stat_records_excludes_postseason_and_unmatched_snaps():
    records = build_usage_stat_records(
        2025,
        [
            {"season": 2025, "week": 19, "game_type": "POST", "pfr_player_id": "A", "offense_snaps": 20},
            {"season": 2025, "week": 1, "game_type": "REG", "pfr_player_id": "missing", "offense_snaps": 20},
        ],
        [],
        [{"pfr_id": "A", "gsis_id": "00-test"}],
    )

    assert records == []
