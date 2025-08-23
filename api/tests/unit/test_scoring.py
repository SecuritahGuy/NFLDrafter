import pytest
from app.scoring import (
    compute_points_from_dict,
    validate_scoring_rule,
    get_default_scoring_profiles
)


class TestScoringEngine:
    """Test the fantasy football scoring engine."""
    
    def test_basic_scoring_calculation(self, sample_scoring_rules, sample_player_stats):
        """Test basic scoring calculation with sample data."""
        points = compute_points_from_dict(sample_player_stats, sample_scoring_rules)
        
        # Expected calculations:
        # passing_yards: 350 * 0.04 = 14.0 + 3 bonus = 17.0
        # passing_touchdowns: 3 * 4 = 12.0
        # rushing_yards: 45 * 0.1 = 4.5 (no bonus, under 100)
        # interceptions: 1 * (-2) = -2.0
        # Total: 17.0 + 12.0 + 4.5 + (-2.0) = 31.5
        expected_points = 31.5
        assert points == expected_points
    
    def test_scoring_with_bonus_threshold(self):
        """Test scoring with bonus threshold."""
        rules = [
            {
                "stat_key": "rushing_yards",
                "multiplier": 0.1,
                "per": 1,
                "bonus_min": 100,
                "bonus_points": 5,
                "cap": None
            }
        ]
        
        stats = {"rushing_yards": 150}
        points = compute_points_from_dict(stats, rules)
        
        # Expected: 150 * 0.1 = 15.0 + 5 bonus = 20.0
        assert points == 20.0
    
    def test_scoring_with_cap(self):
        """Test scoring with maximum point cap."""
        rules = [
            {
                "stat_key": "passing_yards",
                "multiplier": 0.04,
                "per": 1,
                "bonus_min": None,
                "bonus_points": 0,
                "cap": 10.0
            }
        ]
        
        stats = {"passing_yards": 500}
        points = compute_points_from_dict(stats, rules)
        
        # Expected: 500 * 0.04 = 20.0, but capped at 10.0
        assert points == 10.0
    
    def test_scoring_with_per_unit(self):
        """Test scoring with per-unit calculations."""
        rules = [
            {
                "stat_key": "rushing_yards",
                "multiplier": 1.0,
                "per": 10,  # 1 point per 10 yards
                "bonus_min": None,
                "bonus_points": 0,
                "cap": None
            }
        ]
        
        stats = {"rushing_yards": 25}
        points = compute_points_from_dict(stats, rules)
        
        # Expected: floor(25/10) * 1.0 = 2 * 1.0 = 2.0
        assert points == 2.0
    
    def test_scoring_with_zero_stats(self):
        """Test scoring when player has no relevant stats."""
        rules = [
            {
                "stat_key": "passing_yards",
                "multiplier": 0.04,
                "per": 1,
                "bonus_min": None,
                "bonus_points": 0,
                "cap": None
            }
        ]
        
        stats = {"rushing_yards": 100}  # No passing_yards
        points = compute_points_from_dict(stats, rules)
        
        # Expected: 0 points since passing_yards is not in stats
        assert points == 0.0
    
    def test_scoring_with_none_values(self):
        """Test scoring with None values in stats."""
        rules = [
            {
                "stat_key": "passing_yards",
                "multiplier": 0.04,
                "per": 1,
                "bonus_min": None,
                "bonus_points": 0,
                "cap": None
            }
        ]
        
        stats = {"passing_yards": None}
        points = compute_points_from_dict(stats, rules)
        
        # Expected: 0 points since None is treated as 0
        assert points == 0.0
    
    def test_complex_scoring_scenario(self):
        """Test a complex scoring scenario with multiple rules."""
        rules = [
            {
                "stat_key": "passing_yards",
                "multiplier": 0.04,
                "per": 1,
                "bonus_min": 300,
                "bonus_points": 3,
                "cap": 20.0
            },
            {
                "stat_key": "passing_touchdowns",
                "multiplier": 4,
                "per": 1,
                "bonus_min": None,
                "bonus_points": 0,
                "cap": None
            },
            {
                "stat_key": "interceptions",
                "multiplier": -2,
                "per": 1,
                "bonus_min": None,
                "bonus_points": 0,
                "cap": None
            }
        ]
        
        stats = {
            "passing_yards": 400,
            "passing_touchdowns": 2,
            "interceptions": 1
        }
        
        points = compute_points_from_dict(stats, rules)
        
        # Expected calculations:
        # passing_yards: 400 * 0.04 = 16.0 + 3 bonus = 19.0 (capped at 20.0, but 19.0 < 20.0, so no cap applied)
        # passing_touchdowns: 2 * 4 = 8.0
        # interceptions: 1 * -2 = -2.0
        # Total: 19.0 + 8.0 + (-2.0) = 25.0
        expected_points = 25.0
        assert points == expected_points
    
    def test_rounding_to_two_decimal_places(self):
        """Test that points are rounded to two decimal places."""
        rules = [
            {
                "stat_key": "passing_yards",
                "multiplier": 0.033333,  # 1/30
                "per": 1,
                "bonus_min": None,
                "bonus_points": 0,
                "cap": None
            }
        ]
        
        stats = {"passing_yards": 100}
        points = compute_points_from_dict(stats, rules)
        
        # Expected: 100 * 0.033333 = 3.3333... rounded to 3.33
        assert points == 3.33
        assert isinstance(points, float)


class TestScoringRuleValidation:
    """Test scoring rule validation."""
    
    def test_valid_rule(self):
        """Test that a valid rule passes validation."""
        rule = {
            "stat_key": "passing_yards",
            "multiplier": 0.04,
            "per": 1,
            "bonus_min": 300,
            "bonus_points": 3,
            "cap": None
        }
        
        # This should not raise an exception
        validate_scoring_rule(rule)
    
    def test_missing_required_fields(self):
        """Test that missing required fields raise errors."""
        rule = {
            "stat_key": "passing_yards",
            # Missing multiplier
            "per": 1
        }
        
        with pytest.raises(ValueError, match="multiplier"):
            validate_scoring_rule(rule)
    
    def test_invalid_multiplier_type(self):
        """Test that invalid multiplier types raise errors."""
        rule = {
            "stat_key": "passing_yards",
            "multiplier": "invalid",
            "per": 1
        }
        
        with pytest.raises(ValueError, match="multiplier"):
            validate_scoring_rule(rule)
    
    def test_invalid_per_value(self):
        """Test that invalid per values raise errors."""
        rule = {
            "stat_key": "passing_yards",
            "multiplier": 0.04,
            "per": 0  # Must be > 0
        }
        
        with pytest.raises(ValueError, match="per"):
            validate_scoring_rule(rule)
    
    def test_bonus_min_greater_than_bonus_max(self):
        """Test that bonus_min > bonus_max raises an error."""
        rule = {
            "stat_key": "passing_yards",
            "multiplier": 0.04,
            "per": 1,
            "bonus_min": 100,
            "bonus_max": 50,  # Less than bonus_min
            "bonus_points": 3
        }
        
        with pytest.raises(ValueError, match="bonus_max must be greater than bonus_min"):
            validate_scoring_rule(rule)


class TestDefaultScoringProfiles:
    """Test default scoring profile generation."""
    
    def test_default_profiles_exist(self):
        """Test that default profiles are generated."""
        profiles = get_default_scoring_profiles()
        
        assert "Standard" in profiles
        assert "PPR" in profiles
        assert "Half PPR" in profiles
    
    def test_standard_scoring_rules(self):
        """Test Standard scoring profile rules."""
        profiles = get_default_scoring_profiles()
        standard_rules = profiles["Standard"]
        
        # Check for key scoring rules
        stat_keys = [rule["stat_key"] for rule in standard_rules]
        assert "passing_yards" in stat_keys
        assert "rushing_yards" in stat_keys
        assert "receiving_yards" in stat_keys
        assert "passing_touchdowns" in stat_keys
        assert "rushing_touchdowns" in stat_keys
        assert "receiving_touchdowns" in stat_keys
    
    def test_ppr_scoring_rules(self):
        """Test PPR scoring profile rules."""
        profiles = get_default_scoring_profiles()
        ppr_rules = profiles["PPR"]
        
        # Find receptions rule
        receptions_rule = next(
            (rule for rule in ppr_rules if rule["stat_key"] == "receptions"),
            None
        )
        
        assert receptions_rule is not None
        assert receptions_rule["multiplier"] == 1.0  # 1 point per reception
    
    def test_half_ppr_scoring_rules(self):
        """Test Half PPR scoring profile rules."""
        profiles = get_default_scoring_profiles()
        half_ppr_rules = profiles["Half PPR"]
        
        # Find receptions rule
        receptions_rule = next(
            (rule for rule in half_ppr_rules if rule["stat_key"] == "receptions"),
            None
        )
        
        assert receptions_rule is not None
        assert receptions_rule["multiplier"] == 0.5  # 0.5 points per reception
    
    def test_rule_structure_consistency(self):
        """Test that all rules have consistent structure."""
        profiles = get_default_scoring_profiles()
        
        for profile_name, rules in profiles.items():
            for rule in rules:
                # Check required fields
                assert "stat_key" in rule
                assert "multiplier" in rule
                assert "per" in rule
                
                # Check data types
                assert isinstance(rule["stat_key"], str)
                assert isinstance(rule["multiplier"], (int, float))
                assert isinstance(rule["per"], (int, float))
                
                # Check values
                assert rule["per"] > 0
                # Note: multipliers can be negative (e.g., interceptions)
