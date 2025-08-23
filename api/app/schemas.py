from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


# Base schemas
class PlayerBase(BaseModel):
    full_name: str
    position: str
    team: Optional[str] = None


class PlayerCreate(PlayerBase):
    pass


class Player(PlayerBase):
    player_id: str
    nflverse_id: Optional[str] = None
    yahoo_id: Optional[str] = None
    sleeper_id: Optional[str] = None

    class Config:
        from_attributes = True


class PlayerWeekStatBase(BaseModel):
    player_id: str
    season: int
    week: int
    stat_key: str
    stat_value: float


class PlayerWeekStatCreate(PlayerWeekStatBase):
    pass


class PlayerWeekStat(PlayerWeekStatBase):
    class Config:
        from_attributes = True


class ScoringRuleBase(BaseModel):
    stat_key: str
    multiplier: float = 0.0
    per: Optional[float] = None
    bonus_min: Optional[float] = None
    bonus_max: Optional[float] = None
    bonus_points: Optional[float] = None
    cap: Optional[float] = None


class ScoringRuleCreate(ScoringRuleBase):
    pass


class ScoringRule(ScoringRuleBase):
    rule_id: str
    profile_id: str

    class Config:
        from_attributes = True


class ScoringProfileBase(BaseModel):
    name: str
    description: Optional[str] = None
    is_public: bool = True


class ScoringProfileCreate(ScoringProfileBase):
    rules: List[ScoringRuleCreate]


class ScoringProfile(ScoringProfileBase):
    profile_id: str
    created_at: int
    rules: List[ScoringRule]

    class Config:
        from_attributes = True


class NewsItemBase(BaseModel):
    source: str
    url: str
    title: str
    summary: str
    players: Dict[str, float] = Field(default_factory=dict)


class NewsItemCreate(NewsItemBase):
    pass


class NewsItem(NewsItemBase):
    news_id: str
    published_at: int
    dedupe_hash: str
    created_at: int

    class Config:
        from_attributes = True


# API Response schemas
class PointsResponse(BaseModel):
    points: float
    stats: Dict[str, float]
    profile_name: str


class PlayerStatsResponse(BaseModel):
    player: Player
    stats: List[PlayerWeekStat]
    points_by_profile: Dict[str, float]


class ScoringProfileListResponse(BaseModel):
    profiles: List[ScoringProfile]


class NewsSearchResponse(BaseModel):
    news_items: List[NewsItem]
    total_count: int


# Yahoo OAuth schemas
class YahooAuthResponse(BaseModel):
    access_token: str
    token_type: str
    expires_in: int
    refresh_token: Optional[str] = None


class YahooLeagueInfo(BaseModel):
    league_id: str
    league_name: str
    team_id: str
    team_name: str
