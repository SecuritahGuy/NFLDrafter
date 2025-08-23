from __future__ import annotations
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, UniqueConstraint, Index, Text, JSON
from typing import Optional


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
    
    # Relationships
    week_stats: Mapped[list["PlayerWeekStat"]] = relationship("PlayerWeekStat", back_populates="player")


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


class NewsItem(Base):
    __tablename__ = "news_items"
    
    news_id: Mapped[str] = mapped_column(String, primary_key=True)
    published_at: Mapped[int] = mapped_column(Integer, index=True)  # epoch ms
    source: Mapped[str] = mapped_column(String)
    url: Mapped[str] = mapped_column(String, unique=True)
    title: Mapped[str] = mapped_column(Text)
    summary: Mapped[str] = mapped_column(Text)
    players: Mapped[dict] = mapped_column(JSON)  # {player_id: score}
    dedupe_hash: Mapped[str] = mapped_column(String, unique=True)
    created_at: Mapped[int] = mapped_column(Integer, index=True)  # epoch timestamp
