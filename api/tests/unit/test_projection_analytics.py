from types import SimpleNamespace

from app.services.projection_analytics import (
    build_projection_analytics,
    projected_team_opportunity,
    replacement_rank,
    score_projected_stats,
)


def rule(stat_key: str, multiplier: float) -> dict:
    return {
        "stat_key": stat_key,
        "multiplier": multiplier,
        "per": 1,
        "bonus_min": None,
        "bonus_max": None,
        "bonus_points": None,
        "cap": None,
    }


def record(
    player_id: str,
    name: str,
    position: str,
    stats: dict[str, float],
    espn_points: float,
) -> SimpleNamespace:
    return SimpleNamespace(
        player_id=player_id,
        full_name=name,
        position=position,
        team="TST",
        rank=1 if player_id.endswith("a") else 80,
        raw={
            "projected_points": espn_points,
            "projected_stats": stats,
            "weekly_projections": [
                {"week": 1, "points": 10.0, "stats": stats},
            ],
        },
    )


def test_profile_scoring_changes_reception_value():
    stats = {"receptions": 100, "receiving_yards": 1_000}
    ppr = score_projected_stats(stats, [rule("receptions", 1), rule("receiving_yards", 0.1)])
    half = score_projected_stats(stats, [rule("receptions", 0.5), rule("receiving_yards", 0.1)])

    assert ppr == 200
    assert half == 150


def test_missing_projected_rule_returns_none_instead_of_zero():
    assert score_projected_stats({"field_goals_made": 30}, [rule("receptions", 1)]) is None


def test_projected_team_opportunity_derives_rank_and_exact_stat_shares():
    alpha = record("wr-a", "Alpha WR", "WR", {"targets": 120, "receptions": 80}, 250)
    beta = record("wr-b", "Beta WR", "WR", {"targets": 80, "receptions": 40}, 150)

    opportunity = projected_team_opportunity([alpha, beta])

    assert opportunity["wr-a"]["role_share_estimate"] > opportunity["wr-b"]["role_share_estimate"]
    assert opportunity["wr-a"]["exact_shares"]["target_share"]["share"] == 0.6
    assert opportunity["wr-b"]["exact_shares"]["reception_share"]["share"] == 0.3333
    assert opportunity["wr-a"]["teammates_ranked"] == 2


def test_replacement_rank_allocates_flex_evenly():
    starters = {"QB": 1, "RB": 2, "WR": 2, "TE": 1, "K": 1, "DEF": 1}

    assert replacement_rank("QB", 12, starters, 1) == 12
    assert replacement_rank("RB", 12, starters, 1) == 28
    assert replacement_rank("WR", 12, starters, 1) == 28
    assert replacement_rank("TE", 12, starters, 1) == 16
    assert replacement_rank("QB", 12, starters, 1, superflex_slots=1) == 24


def test_projection_board_derives_vorp_tiers_and_weekly_profile_points():
    records = [
        record("qb-a", "Alpha QB", "QB", {"passing_yards": 4_000, "passing_touchdowns": 30}, 280),
        record("qb-b", "Beta QB", "QB", {"passing_yards": 3_000, "passing_touchdowns": 20}, 210),
    ]
    rows, methodology = build_projection_analytics(
        records,
        [rule("passing_yards", 0.04), rule("passing_touchdowns", 4)],
        league_size=2,
        starters={"QB": 1},
        flex_slots=0,
    )

    alpha = next(row for row in rows if row["player_id"] == "qb-a")
    beta = next(row for row in rows if row["player_id"] == "qb-b")
    assert alpha["profile_points"] == 280
    assert alpha["weekly"][0]["profile_points"] == 280
    assert alpha["replacement_rank"] == 2
    assert alpha["replacement_points"] == 200
    assert alpha["vorp"] == 80
    assert alpha["tier"] == 1
    assert beta["tier"] == 2
    assert methodology["replacement_ranks"]["QB"] == 2


def test_projection_board_labels_espn_fallback():
    rows, _ = build_projection_analytics(
        [record("k-a", "Alpha K", "K", {"field_goals_made": 30}, 120)],
        [rule("receptions", 1)],
    )

    assert rows[0]["profile_points"] is None
    assert rows[0]["analytics_points"] == 120
    assert rows[0]["scoring_basis"] == "source_fallback"
