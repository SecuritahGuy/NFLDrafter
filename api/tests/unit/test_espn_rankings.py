from app.services.espn_rankings import _parse_ranking_record


def test_parse_ranking_record_keeps_current_espn_projection():
    record = _parse_ranking_record(
        {
            "player": {
                "id": 3918298,
                "fullName": "Josh Allen",
                "defaultPositionId": 1,
                "proTeamId": 2,
                "injuryStatus": "ACTIVE",
                "seasonOutlook": "A top-tier fantasy quarterback.",
                "ownership": {"percentOwned": 99.8, "percentStarted": 97.2},
                "draftRanksByRankType": {"PPR": {"rank": 26, "auctionValue": 22}},
                "stats": [
                    {
                        "seasonId": 2025,
                        "scoringPeriodId": 0,
                        "statSourceId": 1,
                        "statSplitTypeId": 0,
                        "appliedTotal": 360.0,
                        "appliedAverage": 21.2,
                    },
                    {
                        "seasonId": 2026,
                        "scoringPeriodId": 0,
                        "statSourceId": 1,
                        "statSplitTypeId": 0,
                        "appliedTotal": 381.7,
                        "appliedAverage": 22.5,
                        "stats": {"0": 510, "3": 3950, "4": 27, "20": 11, "23": 115, "24": 580, "25": 12},
                    },
                    {
                        "seasonId": 2026,
                        "scoringPeriodId": 1,
                        "statSourceId": 1,
                        "statSplitTypeId": 1,
                        "stats": {"0": 30, "3": 225, "4": 1.3, "20": 0.7, "23": 7, "24": 35, "25": 0.6},
                    },
                ],
            }
        },
        "PPR",
        "PPR",
    )

    assert record is not None
    assert record["projected_points"] == 381.7
    assert record["projected_points_per_game"] == 22.5
    assert record["projection_season"] == 2026
    assert record["projected_stats"]["passing_yards"] == 3950.0
    assert record["weekly_projections"][0]["week"] == 1
    assert record["weekly_projections"][0]["points"] == 19.9
    assert record["season_outlook"] == "A top-tier fantasy quarterback."
    assert record["ownership"]["percent_owned"] == 99.8
