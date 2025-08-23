import pytest
import asyncio
from sqlalchemy import select
from app.models import Player, PlayerWeekStat, ScoringProfile, ScoringRule
from app.scoring import compute_points_from_dict


class TestScoringFlowIntegration:
    """Integration tests for the complete scoring flow."""
    
    @pytest.mark.integration
    async def test_complete_scoring_flow(self, db_session, sample_player, sample_scoring_rules):
        """Test the complete flow from player creation to points calculation."""
        # 1. Create a scoring profile
        profile = ScoringProfile(
            profile_id="integration-test-profile",
            name="Integration Test Profile",
            description="Test profile for integration testing",
            is_public=True,
            created_at=1234567890
        )
        db_session.add(profile)
        await db_session.commit()
        
        # 2. Add scoring rules to the profile
        for rule_data in sample_scoring_rules:
            rule = ScoringRule(
                rule_id=f"integration-rule-{rule_data['stat_key']}",
                profile_id=profile.profile_id,
                **rule_data
            )
            db_session.add(rule)
        await db_session.commit()
        
        # 3. Create a player
        player = Player(**sample_player)
        db_session.add(player)
        await db_session.commit()
        
        # 4. Add weekly stats for the player
        stats_data = [
            {"stat_key": "passing_yards", "stat_value": 350.0},
            {"stat_key": "passing_touchdowns", "stat_value": 3.0},
            {"stat_key": "rushing_yards", "stat_value": 45.0},
            {"stat_key": "interceptions", "stat_value": 1.0}
        ]
        
        for stat_data in stats_data:
            stat = PlayerWeekStat(
                player_id=player.player_id,
                season=2023,
                week=1,
                **stat_data
            )
            db_session.add(stat)
        await db_session.commit()
        
        # 5. Retrieve the scoring rules from the database
        rules_result = await db_session.execute(
            select(ScoringRule).where(ScoringRule.profile_id == profile.profile_id)
        )
        db_rules = rules_result.scalars().all()
        
        # 6. Convert database rules to dictionary format
        rules_dict = []
        for rule in db_rules:
            rule_dict = {
                "stat_key": rule.stat_key,
                "multiplier": rule.multiplier,
                "per": rule.per,
                "bonus_min": rule.bonus_min,
                "bonus_max": rule.bonus_max,
                "bonus_points": rule.bonus_points,
                "cap": rule.cap
            }
            rules_dict.append(rule_dict)
        
        # 7. Retrieve player stats from the database
        stats_result = await db_session.execute(
            select(PlayerWeekStat).where(
                PlayerWeekStat.player_id == player.player_id,
                PlayerWeekStat.season == 2023,
                PlayerWeekStat.week == 1
            )
        )
        db_stats = stats_result.scalars().all()
        
        # 8. Convert database stats to dictionary format
        stats_dict = {stat.stat_key: stat.stat_value for stat in db_stats}
        
        # 9. Calculate points using the scoring engine
        points = compute_points_from_dict(stats_dict, rules_dict)
        
        # 10. Verify the results
        assert points > 0
        assert isinstance(points, float)
        
        # Expected calculations based on sample_scoring_rules:
        # passing_yards: 350 * 0.04 = 14.0 + 3 bonus = 17.0
        # passing_touchdowns: 3 * 4 = 12.0
        # rushing_yards: 45 * 0.1 = 4.5 (no bonus, under 100)
        # interceptions: 1 * (-2) = -2.0
        # Total: 17.0 + 12.0 + 4.5 + (-2.0) = 31.5
        expected_points = 31.5
        assert abs(points - expected_points) < 0.01  # Allow for floating point precision
    
    @pytest.mark.integration
    async def test_multiple_players_scoring(self, db_session, sample_scoring_rules):
        """Test scoring multiple players with the same profile."""
        # 1. Create scoring profile
        profile = ScoringProfile(
            profile_id="multi-player-test",
            name="Multi Player Test Profile",
            description="Test profile for multiple players",
            is_public=True,
            created_at=1234567890
        )
        db_session.add(profile)
        await db_session.commit()
        
        # 2. Add scoring rules
        for rule_data in sample_scoring_rules:
            rule = ScoringRule(
                rule_id=f"multi-rule-{rule_data['stat_key']}",
                profile_id=profile.profile_id,
                **rule_data
            )
            db_session.add(rule)
        await db_session.commit()
        
        # 3. Create multiple players
        players_data = [
            {
                "player_id": "qb-1",
                "full_name": "Quarterback One",
                "position": "QB",
                "team": "TEAM1",
                "nflverse_id": "nfl-1",
                "yahoo_id": "yahoo-1",
                "sleeper_id": "sleeper-1"
            },
            {
                "player_id": "rb-1",
                "full_name": "Running Back One",
                "position": "RB",
                "team": "TEAM1",
                "nflverse_id": "nfl-2",
                "yahoo_id": "yahoo-2",
                "sleeper_id": "sleeper-2"
            }
        ]
        
        for player_data in players_data:
            player = Player(**player_data)
            db_session.add(player)
        await db_session.commit()
        
        # 4. Add stats for each player
        qb_stats = [
            {"stat_key": "passing_yards", "stat_value": 300.0},
            {"stat_key": "passing_touchdowns", "stat_value": 2.0},
            {"stat_key": "interceptions", "stat_value": 1.0}
        ]
        
        rb_stats = [
            {"stat_key": "rushing_yards", "stat_value": 120.0},
            {"stat_key": "rushing_touchdowns", "stat_value": 1.0},
            {"stat_key": "receptions", "stat_value": 5.0}
        ]
        
        # Add QB stats
        for stat_data in qb_stats:
            stat = PlayerWeekStat(
                player_id="qb-1",
                season=2023,
                week=1,
                **stat_data
            )
            db_session.add(stat)
        
        # Add RB stats
        for stat_data in rb_stats:
            stat = PlayerWeekStat(
                player_id="rb-1",
                season=2023,
                week=1,
                **stat_data
            )
            db_session.add(stat)
        
        await db_session.commit()
        
        # 5. Calculate points for each player
        rules_result = await db_session.execute(
            select(ScoringRule).where(ScoringRule.profile_id == profile.profile_id)
        )
        rules = rules_result.scalars().all()
        rules_dict = [
            {
                "stat_key": rule.stat_key,
                "multiplier": rule.multiplier,
                "per": rule.per,
                "bonus_min": rule.bonus_min,
                "bonus_max": rule.bonus_max,
                "bonus_points": rule.bonus_points,
                "cap": rule.cap
            }
            for rule in rules
        ]
        
        # QB points calculation
        qb_stats_result = await db_session.execute(
            select(PlayerWeekStat).where(
                PlayerWeekStat.player_id == "qb-1",
                PlayerWeekStat.season == 2023,
                PlayerWeekStat.week == 1
            )
        )
        qb_stats_dict = {stat.stat_key: stat.stat_value for stat in qb_stats_result.scalars().all()}
        qb_points = compute_points_from_dict(qb_stats_dict, rules_dict)
        
        # RB points calculation
        rb_stats_result = await db_session.execute(
            select(PlayerWeekStat).where(
                PlayerWeekStat.player_id == "rb-1",
                PlayerWeekStat.season == 2023,
                PlayerWeekStat.week == 1
            )
        )
        rb_stats_dict = {stat.stat_key: stat.stat_value for stat in rb_stats_result.scalars().all()}
        rb_points = compute_points_from_dict(rb_stats_dict, rules_dict)
        
        # 6. Verify results
        assert qb_points > 0
        assert rb_points > 0
        assert qb_points != rb_points  # Different positions should have different scores
        
                # QB expected: 300 * 0.04 = 12.0 + 300+ bonus = 3.0 + 2 * 4 = 8.0 + 1 * (-2) = -2.0 = 21.0
        # RB expected: 120 * 0.1 = 12.0 + 100+ bonus = 2.0 + 1 * 6 = 6.0 + 5 * 1 = 5.0 = 25.0
        expected_qb_points = 21.0
        expected_rb_points = 25.0

        assert abs(qb_points - expected_qb_points) < 0.01
        assert abs(rb_points - expected_rb_points) < 0.01
    
    @pytest.mark.integration
    async def test_season_long_scoring(self, db_session, sample_scoring_rules):
        """Test scoring across multiple weeks of a season."""
        # 1. Create scoring profile
        profile = ScoringProfile(
            profile_id="season-test",
            name="Season Test Profile",
            description="Test profile for season-long scoring",
            is_public=True,
            created_at=1234567890
        )
        db_session.add(profile)
        await db_session.commit()
        
        # 2. Add scoring rules
        for rule_data in sample_scoring_rules:
            rule = ScoringRule(
                rule_id=f"season-rule-{rule_data['stat_key']}",
                profile_id=profile.profile_id,
                **rule_data
            )
            db_session.add(rule)
        await db_session.commit()
        
        # 3. Create player
        player = Player(
            player_id="season-player",
            full_name="Season Player",
            position="QB",
            team="SEASON",
            nflverse_id="season-nfl",
            yahoo_id="season-yahoo",
            sleeper_id="season-sleeper"
        )
        db_session.add(player)
        await db_session.commit()
        
        # 4. Add stats for multiple weeks
        weekly_stats = [
            # Week 1
            {"week": 1, "passing_yards": 250, "passing_touchdowns": 2, "interceptions": 0},
            # Week 2
            {"week": 2, "passing_yards": 350, "passing_touchdowns": 3, "interceptions": 1},
            # Week 3
            {"week": 3, "passing_yards": 200, "passing_touchdowns": 1, "interceptions": 2}
        ]
        
        for week_data in weekly_stats:
            week_num = week_data.pop("week")
            for stat_key, stat_value in week_data.items():
                stat = PlayerWeekStat(
                    player_id=player.player_id,
                    season=2023,
                    week=week_num,
                    stat_key=stat_key,
                    stat_value=float(stat_value)
                )
                db_session.add(stat)
        
        await db_session.commit()
        
        # 5. Calculate points for each week
        rules_result = await db_session.execute(
            select(ScoringRule).where(ScoringRule.profile_id == profile.profile_id)
        )
        rules = rules_result.scalars().all()
        rules_dict = [
            {
                "stat_key": rule.stat_key,
                "multiplier": rule.multiplier,
                "per": rule.per,
                "bonus_min": rule.bonus_min,
                "bonus_max": rule.bonus_max,
                "bonus_points": rule.bonus_points,
                "cap": rule.cap
            }
            for rule in rules
        ]
        
        weekly_points = []
        for week in [1, 2, 3]:
            stats_result = await db_session.execute(
                select(PlayerWeekStat).where(
                    PlayerWeekStat.player_id == player.player_id,
                    PlayerWeekStat.season == 2023,
                    PlayerWeekStat.week == week
                )
            )
            week_stats = {stat.stat_key: stat.stat_value for stat in stats_result.scalars().all()}
            points = compute_points_from_dict(week_stats, rules_dict)
            weekly_points.append(points)
        
        # 6. Verify weekly results
        assert len(weekly_points) == 3
        assert all(points > 0 for points in weekly_points)
        
                # Week 1: 250 * 0.04 = 10.0 + 2 * 4 = 8.0 = 18.0
        # Week 2: 350 * 0.04 = 14.0 + 300+ bonus = 3.0 + 3 * 4 = 12.0 + 1 * (-2) = -2.0 = 27.0
        # Week 3: 200 * 0.04 = 8.0 + 1 * 4 = 4.0 + 2 * (-2) = -4.0 = 8.0

        expected_weekly_points = [18.0, 27.0, 8.0]
        for actual, expected in zip(weekly_points, expected_weekly_points):
            assert abs(actual - expected) < 0.01
        
        # 7. Calculate season total
        season_total = sum(weekly_points)
        expected_season_total = sum(expected_weekly_points)
        assert abs(season_total - expected_season_total) < 0.01
