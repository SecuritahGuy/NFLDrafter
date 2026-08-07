"""Translate Yahoo league settings into NFLDrafter configuration."""

from __future__ import annotations

import re
import time
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import ScoringProfile, ScoringRule


def _label(value: str | None) -> str:
    return " ".join(re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).split())


_CATEGORY_ALIASES = {
    "pass attempts": "passing_attempts",
    "passing attempts": "passing_attempts",
    "pass completions": "passing_completions",
    "passing completions": "passing_completions",
    "pass yards": "passing_yards",
    "passing yards": "passing_yards",
    "pass touchdowns": "passing_touchdowns",
    "passing touchdowns": "passing_touchdowns",
    "pass td": "passing_touchdowns",
    "interceptions": "interceptions",
    "interceptions thrown": "interceptions",
    "rush attempts": "carries",
    "rushing attempts": "carries",
    "rush yards": "rushing_yards",
    "rushing yards": "rushing_yards",
    "rush touchdowns": "rushing_touchdowns",
    "rushing touchdowns": "rushing_touchdowns",
    "rush td": "rushing_touchdowns",
    "receptions": "receptions",
    "reception yards": "receiving_yards",
    "receiving yards": "receiving_yards",
    "receiving touchdowns": "receiving_touchdowns",
    "reception touchdowns": "receiving_touchdowns",
    "rec touchdowns": "receiving_touchdowns",
    "rec td": "receiving_touchdowns",
    "targets": "targets",
    "fumbles lost": "fumbles_lost",
    "return yards": "return_yards",
    "return touchdowns": "return_touchdowns",
    "2 point conversions": "two_point_conversions",
    "two point conversions": "two_point_conversions",
    "field goals made": "field_goals_made",
    "field goals missed": "field_goals_missed",
    "field goal attempts": "field_goal_attempts",
    "point after attempts made": "extra_points_made",
    "extra points made": "extra_points_made",
    "points after attempts missed": "extra_points_missed",
    "extra points missed": "extra_points_missed",
    "sacks": "defense_sacks",
    "interceptions caught": "defense_interceptions",
    "fumble recoveries": "defense_fumble_recoveries",
    "defensive touchdowns": "defense_touchdowns",
    "safeties": "defense_safeties",
    "blocked kicks": "defense_blocked_kicks",
    "points allowed": "defense_points_allowed",
}


def category_stat_key(category: dict) -> str | None:
    for field in ("name", "display_name", "abbr"):
        label = _label(category.get(field))
        position_types = {
            str(item).upper() for item in category.get("position_types", [])
        }
        if label == "interceptions" and position_types and "O" not in position_types:
            return "defense_interceptions"
        if label in _CATEGORY_ALIASES:
            return _CATEGORY_ALIASES[label]
    return None


def normalize_roster_position(position: str) -> str:
    original = position.upper().strip()
    compact = re.sub(r"[^A-Z]", "", position.upper())
    if "/" in original:
        if "Q" in compact:
            return "SUPERFLEX"
        return "FLEX"
    aliases = {
        "WRT": "FLEX",
        "WT": "FLEX",
        "QWRTE": "SUPERFLEX",
        "D": "DEF",
        "DST": "DEF",
    }
    return aliases.get(compact, compact or position.upper())


def translate_yahoo_settings(settings: dict, categories: list[dict]) -> dict:
    """Join stat IDs to names, returning rules plus an explicit unmapped list."""

    categories_by_id = {str(item.get("stat_id")): item for item in categories}
    rules = []
    unmapped = []
    for modifier in settings.get("stat_modifiers", []):
        stat_id = str(modifier.get("stat_id") or "")
        category = categories_by_id.get(stat_id, {})
        stat_key = category_stat_key(category)
        if not stat_key:
            unmapped.append(
                {
                    "stat_id": stat_id,
                    "value": float(modifier.get("value") or 0),
                    "name": category.get("name") or category.get("display_name") or "",
                }
            )
            continue
        rules.append(
            {
                "stat_key": stat_key,
                "multiplier": float(modifier.get("value") or 0),
                "per": 1.0,
                "source_stat_id": stat_id,
                "source_name": category.get("name") or category.get("display_name") or "",
            }
        )

    roster_slots = [
        {
            **slot,
            "normalized_position": normalize_roster_position(slot.get("position", "")),
        }
        for slot in settings.get("roster_positions", [])
    ]
    draft_rounds = sum(
        int(slot.get("count") or 0)
        for slot in roster_slots
        if slot["normalized_position"] not in {"IR", "IRPLUS", "IL", "NA"}
    )
    return {
        "rules": rules,
        "unmapped_stat_modifiers": unmapped,
        "roster_slots": roster_slots,
        "draft_config": {
            "league_size": int(settings.get("num_teams") or 0),
            "rounds": draft_rounds,
        },
        "complete": bool(rules) and not unmapped,
    }


async def persist_yahoo_scoring_profile(
    db: AsyncSession,
    settings: dict,
    translation: dict,
) -> dict | None:
    """Create or replace the internal profile for one Yahoo league."""

    rules = translation.get("rules", [])
    if not rules:
        return None
    league_id = settings.get("league_id") or "unknown"
    league_name = settings.get("name") or league_id
    profile_name = f"Yahoo — {league_name} ({league_id})"
    profile = (
        await db.execute(select(ScoringProfile).where(ScoringProfile.name == profile_name))
    ).scalar_one_or_none()
    if profile is None:
        profile = ScoringProfile(
            profile_id=str(uuid.uuid4()),
            name=profile_name,
            description=f"Imported from Yahoo league {league_id} for {settings.get('season') or 'unknown season'}",
            is_public=False,
            created_at=int(time.time()),
        )
        db.add(profile)
        await db.flush()
    else:
        await db.execute(delete(ScoringRule).where(ScoringRule.profile_id == profile.profile_id))

    for rule in rules:
        db.add(
            ScoringRule(
                rule_id=str(uuid.uuid4()),
                profile_id=profile.profile_id,
                stat_key=rule["stat_key"],
                multiplier=rule["multiplier"],
                per=rule["per"],
            )
        )
    await db.flush()
    return {
        "profile_id": profile.profile_id,
        "name": profile.name,
        "rule_count": len(rules),
        "complete": translation["complete"],
    }
