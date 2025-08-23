#!/usr/bin/env python3
"""Debug script to calculate expected values for integration tests."""

from app.scoring import compute_points_from_dict

# Sample scoring rules from conftest.py
sample_scoring_rules = [
    {
        "stat_key": "passing_yards",
        "multiplier": 0.04,
        "per": 1,
        "bonus_min": 300,
        "bonus_points": 3,
        "bonus_max": None,
        "cap": None
    },
    {
        "stat_key": "passing_touchdowns",
        "multiplier": 4.0,
        "per": 1,
        "bonus_min": None,
        "bonus_points": 0,
        "bonus_max": None,
        "cap": None
    },
    {
        "stat_key": "interceptions",
        "multiplier": -2.0,
        "per": 1,
        "bonus_min": None,
        "bonus_points": 0,
        "bonus_max": None,
        "cap": None
    },
    {
        "stat_key": "rushing_yards",
        "multiplier": 0.1,
        "per": 1,
        "bonus_min": 100,
        "bonus_points": 2,
        "bonus_max": None,
        "cap": None
    },
    {
        "stat_key": "rushing_touchdowns",
        "multiplier": 6.0,
        "per": 1,
        "bonus_min": None,
        "bonus_points": 0,
        "bonus_max": None,
        "cap": None
    },
    {
        "stat_key": "receptions",
        "multiplier": 1.0,
        "per": 1,
        "bonus_min": None,
        "bonus_points": 0,
        "bonus_max": None,
        "cap": None
    }
]

def debug_multiple_players():
    """Debug the multiple players scoring test."""
    print("=== Multiple Players Scoring Test ===")
    
    # QB stats: 300 passing yards, 2 TDs, 1 INT
    qb_stats = {
        "passing_yards": 300.0,
        "passing_touchdowns": 2.0,
        "interceptions": 1.0
    }
    
    # RB stats: 120 rushing yards, 1 TD, 5 receptions
    rb_stats = {
        "rushing_yards": 120.0,
        "rushing_touchdowns": 1.0,
        "receptions": 5.0
    }
    
    qb_points = compute_points_from_dict(qb_stats, sample_scoring_rules)
    rb_points = compute_points_from_dict(rb_stats, sample_scoring_rules)
    
    print(f"QB Stats: {qb_stats}")
    print(f"QB Points: {qb_points}")
    print(f"RB Stats: {rb_stats}")
    print(f"RB Points: {rb_points}")
    
    # Calculate manually:
    # QB: 300 * 0.04 = 12.0 + 300+ bonus = 3.0 + 2 * 4 = 8.0 + 1 * (-2) = -2.0 = 21.0
    # RB: 120 * 0.1 = 12.0 + 100+ bonus = 2.0 + 1 * 6 = 6.0 + 5 * 1 = 5.0 = 25.0
    
    print(f"Expected QB: 21.0")
    print(f"Expected RB: 25.0")

def debug_season_long():
    """Debug the season long scoring test."""
    print("\n=== Season Long Scoring Test ===")
    
    weekly_stats = [
        # Week 1: 250 passing yards, 2 TDs, 0 INTs
        {"passing_yards": 250, "passing_touchdowns": 2, "interceptions": 0},
        # Week 2: 350 passing yards, 3 TDs, 1 INT
        {"passing_yards": 350, "passing_touchdowns": 3, "interceptions": 1},
        # Week 3: 200 passing yards, 1 TD, 2 INTs
        {"passing_yards": 200, "passing_touchdowns": 1, "interceptions": 2}
    ]
    
    expected_points = []
    for i, week_stats in enumerate(weekly_stats, 1):
        points = compute_points_from_dict(week_stats, sample_scoring_rules)
        expected_points.append(points)
        
        print(f"Week {i} Stats: {week_stats}")
        print(f"Week {i} Points: {points}")
        
        # Calculate manually:
        if i == 1:  # 250 yards, 2 TDs, 0 INTs
            # 250 * 0.04 = 10.0 + 2 * 4 = 8.0 = 18.0
            expected = 18.0
        elif i == 2:  # 350 yards, 3 TDs, 1 INT
            # 350 * 0.04 = 14.0 + 300+ bonus = 3.0 + 3 * 4 = 12.0 + 1 * (-2) = -2.0 = 27.0
            expected = 27.0
        else:  # Week 3: 200 yards, 1 TD, 2 INTs
            # 200 * 0.04 = 8.0 + 1 * 4 = 4.0 + 2 * (-2) = -4.0 = 8.0
            expected = 8.0
        
        print(f"Week {i} Expected: {expected}")
    
    print(f"All weekly points: {expected_points}")

if __name__ == "__main__":
    debug_multiple_players()
    debug_season_long()
