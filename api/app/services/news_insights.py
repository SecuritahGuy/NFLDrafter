"""Explainable draft signals derived from persisted news correlations."""

from __future__ import annotations

import math
import time
from collections import defaultdict
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import NewsEntityLink, NewsItem, Player, PlayerRanking


def _signal_value(signals: dict[str, Any]) -> float:
    return (
        float(signals.get("opportunity_score") or 0)
        + float(signals.get("performance_score") or 0)
        + float(signals.get("momentum_score") or 0)
        - float(signals.get("fade_score") or 0)
        - float(signals.get("risk_score") or 0)
    )


async def build_sleeper_insights(
    db: AsyncSession,
    *,
    season: int,
    days: int = 30,
    min_adp: float = 72,
    limit: int = 12,
    league_size: int = 12,
) -> dict[str, Any]:
    """Rank late-round candidates from direct news evidence plus market cost.

    News can move a candidate up or down, but it cannot create a candidate
    without a matched player and a current FFC ADP at or beyond ``min_adp``.
    Broad roundup articles are diluted by their number of linked players.
    """
    cutoff_ms = (int(time.time()) - days * 86400) * 1000
    snapshot_date = (
        await db.execute(
            select(func.max(PlayerRanking.snapshot_date)).where(
                PlayerRanking.source == "ffc-adp",
                PlayerRanking.rank_type == "preseason",
                PlayerRanking.season == season,
            )
        )
    ).scalar_one_or_none()
    if not snapshot_date:
        return {
            "season": season, "days": days, "min_adp": min_adp,
            "snapshot_date": None, "candidates": [], "team_trends": [],
            "methodology": "No current FFC ADP snapshot is available.",
        }

    rankings = list((await db.execute(
        select(PlayerRanking).where(
            PlayerRanking.source == "ffc-adp",
            PlayerRanking.rank_type == "preseason",
            PlayerRanking.season == season,
            PlayerRanking.snapshot_date == snapshot_date,
        )
    )).scalars().all())
    adp_by_player = {
        row.player_id: float(row.ecr if row.ecr is not None else row.rank)
        for row in rankings
        if row.player_id and (row.ecr is not None or row.rank is not None)
    }

    player_link_counts = dict((await db.execute(
        select(NewsEntityLink.news_id, func.count(NewsEntityLink.link_id))
        .join(NewsItem, NewsItem.news_id == NewsEntityLink.news_id)
        .where(
            NewsEntityLink.entity_type == "player",
            NewsItem.published_at >= cutoff_ms,
        )
        .group_by(NewsEntityLink.news_id)
    )).all())
    player_rows = (await db.execute(
        select(NewsEntityLink, NewsItem, Player)
        .join(NewsItem, NewsItem.news_id == NewsEntityLink.news_id)
        .join(Player, Player.player_id == NewsEntityLink.entity_id)
        .where(
            NewsEntityLink.entity_type == "player",
            NewsItem.published_at >= cutoff_ms,
            Player.position.in_(["QB", "RB", "WR", "TE"]),
        )
    )).all()

    now_ms = int(time.time()) * 1000
    candidates: dict[str, dict[str, Any]] = {}
    for link, item, player in player_rows:
        adp = adp_by_player.get(player.player_id)
        if adp is None or adp < min_adp:
            continue
        signal_value = _signal_value(link.signals or {})
        if signal_value == 0:
            continue
        age_days = max((now_ms - item.published_at) / 86400000.0, 0.0)
        recency = math.exp(-age_days / 14.0)
        breadth = max(player_link_counts.get(item.news_id, 1), 1)
        evidence_weight = 1.0 / math.sqrt(breadth)
        contribution = float(link.relevance_score) * signal_value * recency * evidence_weight
        candidate = candidates.setdefault(player.player_id, {
            "player_id": player.player_id,
            "name": player.full_name,
            "position": player.position,
            "team": player.team,
            "adp": adp,
            "score": 0.0,
            "positive_score": 0.0,
            "risk_score": 0.0,
            "evidence": [],
        })
        candidate["score"] += contribution
        if contribution > 0:
            candidate["positive_score"] += contribution
        else:
            candidate["risk_score"] += abs(contribution)
        candidate["evidence"].append({
            "news_id": item.news_id,
            "title": item.title,
            "url": item.url,
            "source": item.source,
            "published_at": item.published_at,
            "topics": (link.signals or {}).get("topics") or [],
            "contribution": round(contribution, 3),
            "correlation_method": link.correlation_method,
        })

    ranked_candidates = []
    for candidate in candidates.values():
        if candidate["score"] <= 0:
            continue
        candidate["score"] = round(candidate["score"], 2)
        candidate["positive_score"] = round(candidate["positive_score"], 2)
        candidate["risk_score"] = round(candidate["risk_score"], 2)
        candidate["likely_round"] = math.ceil(candidate["adp"] / league_size)
        candidate["evidence"] = sorted(
            candidate["evidence"], key=lambda row: abs(row["contribution"]), reverse=True
        )[:4]
        candidate["confidence"] = (
            "medium" if len(candidate["evidence"]) >= 2 and candidate["score"] >= 2 else "limited"
        )
        ranked_candidates.append(candidate)
    ranked_candidates.sort(key=lambda row: (row["score"], row["adp"]), reverse=True)
    diversified_candidates = []
    position_counts: dict[str, int] = defaultdict(int)
    for candidate in ranked_candidates:
        if position_counts[candidate["position"]] >= 2:
            continue
        diversified_candidates.append(candidate)
        position_counts[candidate["position"]] += 1
        if len(diversified_candidates) >= limit:
            break

    team_rows = (await db.execute(
        select(NewsEntityLink, NewsItem)
        .join(NewsItem, NewsItem.news_id == NewsEntityLink.news_id)
        .where(
            NewsEntityLink.entity_type == "team",
            NewsEntityLink.correlation_method == "direct_team_mention",
            NewsItem.published_at >= cutoff_ms,
        )
    )).all()
    team_scores: dict[str, dict[str, Any]] = defaultdict(
        lambda: {"article_count": 0, "opportunity_score": 0.0, "risk_score": 0.0, "topics": set()}
    )
    for link, _item in team_rows:
        trend = team_scores[link.entity_id]
        trend["article_count"] += 1
        trend["opportunity_score"] += float((link.signals or {}).get("opportunity_score") or 0)
        trend["risk_score"] += float((link.signals or {}).get("risk_score") or 0)
        trend["topics"].update((link.signals or {}).get("topics") or [])
    team_trends = [
        {
            "team": team,
            "article_count": values["article_count"],
            "opportunity_score": round(values["opportunity_score"], 2),
            "risk_score": round(values["risk_score"], 2),
            "topics": sorted(values["topics"]),
        }
        for team, values in team_scores.items()
    ]
    team_trends.sort(key=lambda row: (row["opportunity_score"] + row["risk_score"], row["article_count"]), reverse=True)

    return {
        "season": season,
        "days": days,
        "min_adp": min_adp,
        "league_size": league_size,
        "snapshot_date": snapshot_date,
        "candidates": diversified_candidates,
        "team_trends": team_trends[:12],
        "methodology": (
            "Direct player mentions only; local opportunity/performance terms add weight, injury terms subtract it, "
            "Sleeper adds/drops contribute a smaller market-confirmation weight, evidence decays over 14 days, and broad "
            "roundup articles are diluted. News is a draft-context signal, not a projection."
        ),
    }


async def build_draft_signals(db: AsyncSession, *, days: int = 30) -> dict[str, Any]:
    """Create small, explainable news adjustments for live draft choices.

    These are deliberately capped context signals. They cannot replace a
    projection, ADP, or an injury report; the client applies them only as a
    tie-breaker alongside its normal draft model.
    """
    cutoff_ms = (int(time.time()) - days * 86400) * 1000
    rows = (await db.execute(
        select(NewsEntityLink, NewsItem).join(NewsItem, NewsItem.news_id == NewsEntityLink.news_id)
        .where(NewsEntityLink.entity_type == "player", NewsItem.published_at >= cutoff_ms)
        .order_by(NewsItem.published_at.desc())
    )).all()
    now_ms = int(time.time()) * 1000
    signals: dict[str, dict[str, Any]] = {}
    for link, item in rows:
        raw_signal = _signal_value(link.signals or {})
        if raw_signal == 0:
            continue
        age_days = max((now_ms - item.published_at) / 86400000.0, 0.0)
        contribution = float(link.relevance_score) * raw_signal * math.exp(-age_days / 14.0)
        entry = signals.setdefault(link.entity_id, {
            "player_id": link.entity_id,
            "adjustment": 0.0,
            "positive": 0.0,
            "risk": 0.0,
            "headlines": [],
        })
        entry["adjustment"] += contribution
        if contribution > 0:
            entry["positive"] += contribution
        else:
            entry["risk"] += abs(contribution)
        entry["headlines"].append({
            "title": item.title,
            "url": item.url,
            "source": item.source,
            "topics": (link.signals or {}).get("topics") or [],
            "contribution": round(contribution, 3),
        })
    for entry in signals.values():
        # Keep this adjustment intentionally modest relative to VORP and roster need.
        entry["adjustment"] = round(max(-6.0, min(6.0, entry["adjustment"])), 2)
        entry["positive"] = round(entry["positive"], 2)
        entry["risk"] = round(entry["risk"], 2)
        entry["headlines"] = sorted(entry["headlines"], key=lambda value: abs(value["contribution"]), reverse=True)[:2]
    return {"days": days, "signals": list(signals.values())}
