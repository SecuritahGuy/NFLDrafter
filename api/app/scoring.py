import math
from typing import Dict, List, Any
from .models import ScoringRule


def compute_points(stats: Dict[str, float], rules: List[ScoringRule]) -> float:
    """
    Compute fantasy points based on player stats and scoring rules.
    
    Args:
        stats: Dictionary of stat_key -> stat_value
        rules: List of ScoringRule objects
        
    Returns:
        Total fantasy points rounded to 2 decimal places
    """
    total = 0.0
    
    for rule in rules:
        # Get stat value, defaulting to 0 if not present
        val = float(stats.get(rule.stat_key, 0) or 0)
        
        # Calculate units (e.g., yards per unit)
        if rule.per is not None and rule.per > 0:
            units = math.floor(val / rule.per)
        else:
            units = val
        
        # Calculate base points
        base = units * float(rule.multiplier or 0)
        
        # Calculate bonus points
        bonus = 0.0
        if rule.bonus_min is not None:
            if val >= rule.bonus_min:
                if rule.bonus_max is None or val <= rule.bonus_max:
                    bonus = float(rule.bonus_points or 0)
        
        # Calculate subtotal
        subtotal = base + bonus
        
        # Apply cap if specified
        if rule.cap is not None:
            subtotal = min(subtotal, rule.cap)
        
        total += subtotal
    
    return round(total, 2)


def compute_points_from_dict(stats: Dict[str, float], rules: List[Dict[str, Any]]) -> float:
    """
    Compute fantasy points from dictionary-based rules (for API responses).
    
    Args:
        stats: Dictionary of stat_key -> stat_value
        rules: List of rule dictionaries
        
    Returns:
        Total fantasy points rounded to 2 decimal places
    """
    total = 0.0
    
    for rule in rules:
        val = float(stats.get(rule["stat_key"], 0) or 0)
        
        # Calculate units
        if rule.get("per") and rule["per"] > 0:
            units = math.floor(val / rule["per"])
        else:
            units = val
        
        # Calculate base points
        base = units * float(rule.get("multiplier", 0))
        
        # Calculate bonus points
        bonus = 0.0
        if rule.get("bonus_min") is not None:
            if val >= rule["bonus_min"]:
                if rule.get("bonus_max") is None or val <= rule["bonus_max"]:
                    bonus = float(rule.get("bonus_points", 0))
        
        # Calculate subtotal
        subtotal = base + bonus
        
        # Apply cap if specified
        if rule.get("cap") is not None:
            subtotal = min(subtotal, rule["cap"])
        
        total += subtotal
    
    return round(total, 2)


def validate_scoring_rule(rule: Dict[str, Any]) -> bool:
    """
    Validate a scoring rule configuration.
    
    Args:
        rule: Dictionary containing rule configuration
        
    Returns:
        True if valid, False otherwise
    """
    required_fields = ["stat_key", "multiplier"]
    
    # Check required fields
    for field in required_fields:
        if field not in rule:
            return False
    
    # Validate numeric fields
    try:
        multiplier = float(rule["multiplier"])
        if rule.get("per") is not None:
            per = float(rule["per"])
            if per <= 0:
                return False
        if rule.get("bonus_min") is not None:
            bonus_min = float(rule["bonus_min"])
        if rule.get("bonus_max") is not None:
            bonus_max = float(rule["bonus_max"])
            if rule.get("bonus_min") is not None and bonus_max <= float(rule["bonus_min"]):
                return False
        if rule.get("cap") is not None:
            cap = float(rule["cap"])
    except (ValueError, TypeError):
        return False
    
    return True


def get_default_scoring_profiles() -> Dict[str, List[Dict[str, Any]]]:
    """
    Get default scoring profiles for common fantasy football formats.
    
    Returns:
        Dictionary of profile names to rule lists
    """
    return {
        "Standard": [
            {"stat_key": "passing_yards", "multiplier": 0.04, "per": 1},
            {"stat_key": "passing_touchdowns", "multiplier": 4.0},
            {"stat_key": "passing_interceptions", "multiplier": -2.0},
            {"stat_key": "rushing_yards", "multiplier": 0.1, "per": 1},
            {"stat_key": "rushing_touchdowns", "multiplier": 6.0},
            {"stat_key": "receiving_yards", "multiplier": 0.1, "per": 1},
            {"stat_key": "receiving_touchdowns", "multiplier": 6.0},
            {"stat_key": "receptions", "multiplier": 0.5},
            {"stat_key": "fumbles_lost", "multiplier": -2.0},
        ],
        "PPR": [
            {"stat_key": "passing_yards", "multiplier": 0.04, "per": 1},
            {"stat_key": "passing_touchdowns", "multiplier": 4.0},
            {"stat_key": "passing_interceptions", "multiplier": -2.0},
            {"stat_key": "rushing_yards", "multiplier": 0.1, "per": 1},
            {"stat_key": "rushing_touchdowns", "multiplier": 6.0},
            {"stat_key": "receiving_yards", "multiplier": 0.1, "per": 1},
            {"stat_key": "receiving_touchdowns", "multiplier": 6.0},
            {"stat_key": "receptions", "multiplier": 1.0},
            {"stat_key": "fumbles_lost", "multiplier": -2.0},
        ],
        "Half PPR": [
            {"stat_key": "passing_yards", "multiplier": 0.04, "per": 1},
            {"stat_key": "passing_touchdowns", "multiplier": 4.0},
            {"stat_key": "passing_interceptions", "multiplier": -2.0},
            {"stat_key": "rushing_yards", "multiplier": 0.1, "per": 1},
            {"stat_key": "rushing_touchdowns", "multiplier": 6.0},
            {"stat_key": "receiving_yards", "multiplier": 0.1, "per": 1},
            {"stat_key": "receiving_touchdowns", "multiplier": 6.0},
            {"stat_key": "receptions", "multiplier": 0.5},
            {"stat_key": "fumbles_lost", "multiplier": -2.0},
        ]
    }
