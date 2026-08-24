from __future__ import annotations
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, UniqueConstraint, Index, Text, JSON
from typing import Optional, Dict


class Base(DeclarativeBase):
    pass


class Player(Base):
    __tablename__ = "players"
    
    player_id: Mapped[str] = mapped_column(String, primary_key=True)
    full_name: Mapped[str] = mapped_column(String, index=True)
    position: Mapped[str] = mapped_column(String(5), index=True)
    team: Mapped[Optional[str]] = mapped_column(String(5), index=True, nullable=True)
    nflverse_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    yahoo_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    sleeper_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    espn_id: Mapped[Optional[str]] = mapped_column(String, index=True)
    last_season: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)
    status: Mapped[Optional[str]] = mapped_column(String(8), index=True, nullable=True)
    headshot: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    
    # Relationships
    week_stats: Mapped[list["PlayerWeekStat"]] = relationship("PlayerWeekStat", back_populates="player")


class PlayerIdentifier(Base):
    """Season-aware mapping from an external fantasy platform to a player."""

    __tablename__ = "player_identifiers"

    identifier_id: Mapped[str] = mapped_column(String, primary_key=True)
    canonical_player_id: Mapped[str] = mapped_column(
        ForeignKey("players.player_id"), index=True
    )
    platform: Mapped[str] = mapped_column(String(32), index=True)
    external_id: Mapped[str] = mapped_column(String, index=True)
    season: Mapped[int] = mapped_column(Integer, index=True)
    name: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    team: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    position: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    match_confidence: Mapped[float] = mapped_column(Float)
    match_method: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        UniqueConstraint(
            "platform", "external_id", "season", name="uq_player_identifier"
        ),
        Index("ix_player_identifier_lookup", "platform", "season", "external_id"),
    )


class PlayerWeekStat(Base):
    __tablename__ = "player_week_stats"
    
    player_id: Mapped[str] = mapped_column(ForeignKey("players.player_id"), primary_key=True)
    season: Mapped[int] = mapped_column(Integer, primary_key=True)
    week: Mapped[int] = mapped_column(Integer, primary_key=True)
    stat_key: Mapped[str] = mapped_column(String, primary_key=True)
    stat_value: Mapped[float] = mapped_column(Float, default=0.0)
    
    # Relationships
    player: Mapped["Player"] = relationship("Player", back_populates="week_stats")
    
    __table_args__ = (
        Index("ix_pws_player_season_week", "player_id", "season", "week"),
    )


class ScoringProfile(Base):
    __tablename__ = "scoring_profiles"
    
    profile_id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[int] = mapped_column(Integer)  # epoch timestamp
    
    # Relationships
    rules: Mapped[list["ScoringRule"]] = relationship("ScoringRule", back_populates="profile")


class ScoringRule(Base):
    __tablename__ = "scoring_rules"
    
    rule_id: Mapped[str] = mapped_column(String, primary_key=True)
    profile_id: Mapped[str] = mapped_column(ForeignKey("scoring_profiles.profile_id"))
    stat_key: Mapped[str] = mapped_column(String)
    multiplier: Mapped[float] = mapped_column(Float, default=0.0)
    per: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bonus_min: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bonus_max: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bonus_points: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cap: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    
    # Relationships
    profile: Mapped["ScoringProfile"] = relationship("ScoringProfile", back_populates="rules")
    
    __table_args__ = (
        Index("ix_rules_profile", "profile_id"),
    )


class PlayerRanking(Base):
    """Time-series snapshots of fantasy expert consensus rankings (ECR)."""
    __tablename__ = "player_rankings"

    ranking_id: Mapped[str] = mapped_column(String, primary_key=True)
    player_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("players.player_id"), index=True, nullable=True
    )
    full_name: Mapped[str] = mapped_column(String, index=True)
    position: Mapped[Optional[str]] = mapped_column(String(5), index=True, nullable=True)
    team: Mapped[Optional[str]] = mapped_column(String(5), index=True, nullable=True)

    source: Mapped[str] = mapped_column(String, index=True)  # e.g. "fantasypros-ecr"
    rank_type: Mapped[str] = mapped_column(String, index=True)  # "preseason" | "weekly"
    scoring: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)  # PPR/HALF/STD
    season: Mapped[int] = mapped_column(Integer, index=True)
    week: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)

    rank: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)  # overall ECR
    pos_rank: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # rank within position
    tier: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    ecr: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sd: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    best: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    worst: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    rank_delta: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # vs previous snapshot
    owned_avg: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    bye: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    snapshot_date: Mapped[str] = mapped_column(String, index=True)  # YYYY-MM-DD of scrape
    snapshot_ts: Mapped[int] = mapped_column(Integer, index=True)  # epoch ms
    raw: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        UniqueConstraint(
            "player_id", "source", "rank_type", "scoring", "season",
            "snapshot_date", name="uq_ranking_snapshot"
        ),
        Index("ix_rankings_snapshot", "source", "season", "snapshot_date", "rank"),
    )


class ApiResponseCache(Base):
    """Persistent cache for quota-limited third-party JSON responses."""

    __tablename__ = "api_response_cache"

    cache_key: Mapped[str] = mapped_column(String, primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    endpoint: Mapped[str] = mapped_column(String, index=True)
    query: Mapped[dict] = mapped_column(JSON)
    response: Mapped[dict] = mapped_column(JSON)
    fetched_at: Mapped[int] = mapped_column(Integer, index=True)
    expires_at: Mapped[int] = mapped_column(Integer, index=True)
    last_accessed_at: Mapped[int] = mapped_column(Integer)
    status_code: Mapped[int] = mapped_column(Integer)
    response_headers: Mapped[dict] = mapped_column(JSON)

    __table_args__ = (
        Index("ix_api_cache_provider_expiry", "provider", "expires_at"),
    )


class ApiCallLog(Base):
    """Local audit of quota-consuming outbound API calls."""

    __tablename__ = "api_call_log"

    call_id: Mapped[str] = mapped_column(String, primary_key=True)
    provider: Mapped[str] = mapped_column(String(32), index=True)
    endpoint: Mapped[str] = mapped_column(String, index=True)
    query: Mapped[dict] = mapped_column(JSON)
    requested_at: Mapped[int] = mapped_column(Integer, index=True)
    status_code: Mapped[int] = mapped_column(Integer)

    __table_args__ = (
        Index("ix_api_calls_provider_requested", "provider", "requested_at"),
    )


class PlayerInjury(Base):
    """Weekly injury report data from nflverse (NFL official reports)."""
    __tablename__ = "player_injuries"

    injury_id: Mapped[str] = mapped_column(String, primary_key=True)
    player_id: Mapped[Optional[str]] = mapped_column(
        ForeignKey("players.player_id"), index=True, nullable=True
    )
    full_name: Mapped[str] = mapped_column(String, index=True)
    position: Mapped[Optional[str]] = mapped_column(String(5), nullable=True)
    team: Mapped[Optional[str]] = mapped_column(String(5), index=True, nullable=True)

    season: Mapped[int] = mapped_column(Integer, index=True)
    season_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # PRE/REG/POST
    week: Mapped[int] = mapped_column(Integer, index=True)

    report_primary_injury: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    report_secondary_injury: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    report_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # OUT/Q/DOUBTFUL
    practice_primary_injury: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    practice_secondary_injury: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    practice_status: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    report_date: Mapped[Optional[str]] = mapped_column(String, index=True, nullable=True)
    snapshot_ts: Mapped[int] = mapped_column(Integer, index=True)

    __table_args__ = (
        UniqueConstraint(
            "player_id", "season", "week", "report_primary_injury",
            "report_status", name="uq_injury_snapshot"
        ),
        Index("ix_injuries_season_week", "season", "week", "report_status"),
    )


class NewsItem(Base):
    __tablename__ = "news_items"
    
    news_id: Mapped[str] = mapped_column(String, primary_key=True)
    published_at: Mapped[int] = mapped_column(Integer, index=True)  # epoch ms
    source: Mapped[str] = mapped_column(String)
    url: Mapped[str] = mapped_column(String, unique=True)
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    story: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    players: Mapped[dict] = mapped_column(JSON)  # {player_id: score}
    dedupe_hash: Mapped[str] = mapped_column(String, unique=True)
    created_at: Mapped[int] = mapped_column(Integer, index=True)  # epoch timestamp


class NewsSource(Base):
    """Persistent provenance and ingestion health for a news publisher/feed."""

    __tablename__ = "news_sources"

    source_id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    homepage_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_type: Mapped[str] = mapped_column(String(32), default="publisher")
    reliability_tier: Mapped[str] = mapped_column(String(32), default="context")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    article_count: Mapped[int] = mapped_column(Integer, default=0)
    first_published_at: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    last_published_at: Mapped[Optional[int]] = mapped_column(Integer, index=True, nullable=True)
    last_ingested_at: Mapped[int] = mapped_column(Integer, index=True)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)


class NewsEntityLink(Base):
    """Explainable article correlation to a player or NFL team."""

    __tablename__ = "news_entity_links"

    link_id: Mapped[str] = mapped_column(String, primary_key=True)
    news_id: Mapped[str] = mapped_column(ForeignKey("news_items.news_id"), index=True)
    entity_type: Mapped[str] = mapped_column(String(16), index=True)  # player | team
    entity_id: Mapped[str] = mapped_column(String, index=True)
    entity_name: Mapped[str] = mapped_column(String, index=True)
    team: Mapped[Optional[str]] = mapped_column(String(5), index=True, nullable=True)
    relevance_score: Mapped[float] = mapped_column(Float)
    correlation_method: Mapped[str] = mapped_column(String(64))
    signals: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[int] = mapped_column(Integer, index=True)

    __table_args__ = (
        UniqueConstraint("news_id", "entity_type", "entity_id", name="uq_news_entity_link"),
        Index("ix_news_entity_team_type", "team", "entity_type"),
    )
