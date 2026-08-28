import axios from 'axios';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json',
  },
});

// API endpoints
export const endpoints = {
  // Players
  players: '/players',
  playerStats: '/players',
  positions: '/players/positions',
  teams: '/players/teams',
  
  // Fantasy scoring
  points: '/fantasy/points',
  profiles: '/fantasy/profiles',
  bulkPoints: '/fantasy/points/batch',
  leaderboard: '/fantasy/points/leaderboard',

  // External rankings
  rankings: '/rankings/',
  rankingSources: '/rankings/sources',
  injuries: '/injuries/',
  
  // Health check
  health: '/health',
} as const;

// Types for API responses
export interface BackendPlayer {
  player_id: string;
  full_name: string;
  position: string;
  team: string;
  nflverse_id?: string;
  yahoo_id?: string;
  sleeper_id?: string;
  espn_id?: string;
  last_season?: number;
  status?: string;
  headshot?: string;
}

export interface Player {
  player_id: string;
  name: string;
  position: string;
  team: string;
  fantasy_points?: number;
  yahoo_points?: number;
  delta?: number;
  vorp?: number;
  tier?: number;
  adp?: number;
  news_count?: number;
  bye_week?: number;
  season?: number;
}

export interface PlayerWeekStat {
  player_id: string;
  season: number;
  week: number;
  stats: Record<string, number>;
}

export interface PointsResponse {
  points: number;
  stats: Record<string, number>;
  profile_name: string;
}

export interface ScoringProfile {
  profile_id: string;
  name: string;
  description?: string;
  is_public: boolean;
  created_at: number;
  rules: ScoringRule[];
}

export interface ScoringRule {
  rule_id: string;
  stat_key: string;
  multiplier: number;
  per: number;
  bonus_min?: number;
  bonus_max?: number;
  bonus_points?: number;
  cap?: number;
}

export interface PlayerSearchParams {
  q?: string;
  position?: string;
  team?: string;
  limit?: number;
  current_only?: boolean;
  season?: number;
}

export interface PlayerSummary {
  player: BackendPlayer;
  season: number;
  season_stats: Record<string, { total: number; avg: number; high: number; games: number }>;
  weekly_sparkline: Array<{ week: number; stats: Record<string, number>; fantasy_points: number | null }>;
  fantasy_points: number | null;
  position_ranking: number | null;
  total_games: number;
}

export interface PlayerContext {
  player_id: string;
  season: number;
  projection: {
    source: string;
    scoring: string | null;
    points: number | null;
    points_per_game: number | null;
    profile_id: string | null;
    profile_name: string | null;
    profile_points: number | null;
    profile_points_per_game: number | null;
    projection_season: number | null;
    snapshot_date: string | null;
    stats: Record<string, number>;
    weekly: Array<{
      week: number;
      points: number | null;
      profile_points: number | null;
      stats: Record<string, number>;
    }>;
    season_outlook: string | null;
    ownership: {
      percent_owned?: number | null;
      percent_started?: number | null;
      average_draft_position?: number | null;
      auction_value_average?: number | null;
      updated_at?: number | null;
    };
    opportunity: {
      team: string;
      role_share_estimate: number | null;
      teammates_ranked: number;
      exact_shares: Record<string, {
        share: number;
        player_value: number;
        team_total: number;
        players_covered: number;
      }>;
      method: string;
      exact_share_method: string;
    } | null;
  };
  schedule_strength: {
    available: boolean;
    season: number;
    basis_season: number;
    position?: string;
    schedule_rank?: number | null;
    average_opponent_ease_rank?: number | null;
    label?: string;
    method?: string;
    reason?: string;
    matchups?: Array<{
      week: number;
      opponent: string;
      location: 'home' | 'away';
      ease_rank: number | null;
      points_allowed_per_game: number | null;
    }>;
  };
  injuries: Array<{
    season: number;
    week: number | null;
    report_status: string | null;
    primary_injury: string | null;
    practice_status: string | null;
    source: string;
    is_current: boolean;
  }>;
  news: Array<{
    title: string;
    url: string;
    source: string;
    published_at: number;
    summary: string | null;
    relevance: number | null;
  }>;
}

export interface InjuryReportEntry {
  player_id: string | null;
  full_name: string;
  position: string | null;
  team: string | null;
  season: number;
  week: number;
  season_type: string | null;
  report_status: string | null;
  report_primary_injury: string | null;
  report_secondary_injury: string | null;
  practice_status: string | null;
  practice_primary_injury: string | null;
  practice_secondary_injury: string | null;
}

export interface BulkPointsRequest {
  player_ids: string[];
  season: number;
  week: number;
  profile_id: string;
}

export interface LeaderboardParams {
  season: number;
  week: number;
  profile_id: string;
  position?: string;
  limit?: number;
}

export type RankingSourceId = 'fantasypros-ecr' | 'fantasypros-projection' | 'espn-draft-rank' | 'ffc-adp';

export interface RankingRow {
  rank: number | null;
  pos_rank: number | null;
  player_id: string | null;
  full_name: string;
  position: string | null;
  team: string | null;
  projection_source: 'FantasyPros' | 'ESPN';
  ecr: number | null;
  tier: number | null;
  sd: number | null;
  best: number | null;
  worst: number | null;
  rank_delta: number | null;
  bye: number | null;
  projected_points: number | null;
  projected_points_per_game: number | null;
  projection_season: number | null;
}

export interface RankingsResponse {
  source: RankingSourceId;
  snapshot_date: string | null;
  count: number;
  rankings: RankingRow[];
}

export interface RankingHistoryPoint {
  snapshot_date: string;
  rank: number | null;
  pos_rank: number | null;
  ecr: number | null;
  team: string | null;
  rank_delta: number | null;
}

export interface RankingHistoryResponse {
  source: RankingSourceId;
  player_id: string;
  full_name: string;
  history: RankingHistoryPoint[];
}

export interface RankingSourceStatus {
  source: RankingSourceId;
  label: string;
  kind: string;
  purpose: string;
  attribution_url: string;
  available: boolean;
  snapshot_date: string | null;
  season: number | null;
  scoring: string[];
  records: number;
  matched: number;
  match_rate: number;
}

export interface SourceRefreshResponse {
  started_at: string;
  completed_at: string;
  succeeded: number;
  failed: number;
  results: Record<string, Record<string, unknown> & { error?: string }>;
}

export interface ProjectionAnalyticsRow {
  player_id: string;
  full_name: string;
  position: string;
  team: string | null;
  espn_points: number | null;
  profile_points: number | null;
  analytics_points: number;
  points_per_game: number;
  scoring_basis: 'profile' | 'source_fallback';
  position_rank: number;
  replacement_rank: number;
  replacement_points: number;
  vorp: number;
  tier: number;
  weekly: Array<{ week: number; espn_points: number | null; profile_points: number | null }>;
}

export interface ProjectionAnalyticsResponse {
  season: number;
  snapshot_date: string | null;
  snapshot_dates?: Record<string, string | null>;
  profile: { profile_id: string; name: string };
  methodology: {
    league_size?: number;
    replacement_ranks?: Record<string, number>;
    tier_thresholds?: Record<string, number>;
    tier_method?: string;
    flex_allocation?: string;
    fallback?: string;
  };
  players: ProjectionAnalyticsRow[];
}

export interface ProjectionLeagueConfig {
  league_size?: number;
  qb?: number;
  rb?: number;
  wr?: number;
  te?: number;
  flex?: number;
  superflex?: number;
  k?: number;
  defense?: number;
}

// API functions
export const playersAPI = {
  // Search players with filters
  async searchPlayers(params: PlayerSearchParams = {}): Promise<BackendPlayer[]> {
    const response = await api.get(endpoints.players, { params });
    return response.data;
  },

  // Get player by ID
  async getPlayer(playerId: string): Promise<BackendPlayer> {
    const response = await api.get(`${endpoints.players}/${playerId}`);
    return response.data;
  },

  // Get player weekly stats
  async getPlayerStats(
    playerId: string,
    season: number,
    week: number
  ): Promise<PlayerWeekStat> {
    const response = await api.get(`${endpoints.players}/${playerId}/stats`, {
      params: { season, week }
    });
    return response.data;
  },

  async getPlayerSummary(
    playerId: string,
    season: number,
    profileId?: string
  ): Promise<PlayerSummary> {
    const response = await api.get(`${endpoints.players}/${playerId}/summary`, {
      params: { season, profile_id: profileId || undefined }
    });
    return response.data;
  },

  async getPlayerContext(playerId: string, season: number, profileId?: string): Promise<PlayerContext> {
    const response = await api.get(`${endpoints.players}/${playerId}/context`, {
      params: { season, profile_id: profileId || undefined }
    });
    return response.data;
  },

  // Get available positions
  async getPositions(): Promise<{ positions: string[] }> {
    const response = await api.get(endpoints.positions);
    return response.data;
  },

  // Get available teams
  async getTeams(): Promise<{ teams: string[] }> {
    const response = await api.get(endpoints.teams);
    return response.data;
  },
};

export const injuriesAPI = {
  async getInjuries(season: number): Promise<InjuryReportEntry[]> {
    const response = await api.get(endpoints.injuries, { params: { season, limit: 1000 } });
    return Array.isArray(response.data?.injuries) ? response.data.injuries : [];
  },
};

export const fantasyAPI = {
  // Calculate points for a player
  async getPoints(
    playerId: string,
    season: number,
    week: number,
    profileId: string
  ): Promise<PointsResponse> {
    const response = await api.get(endpoints.points, {
      params: { player_id: playerId, season, week, profile_id: profileId }
    });
    return response.data;
  },

  // Calculate points for multiple players
  async getBulkPoints(request: BulkPointsRequest): Promise<Record<string, PointsResponse>> {
    const response = await api.post(endpoints.bulkPoints, request);
    // Transform backend response format to frontend expected format
    const results = response.data.results || [];
    const transformed: Record<string, PointsResponse> = {};
    
    results.forEach((result: any) => {
      if (result.player_id && !result.error) {
        transformed[result.player_id] = {
          points: result.fantasy_points || 0,
          stats: result.stats || {},
          profile_name: response.data.profile_name || ''
        };
      }
    });
    
    return transformed;
  },

  // Get leaderboard
  async getLeaderboard(params: LeaderboardParams): Promise<Player[]> {
    const response = await api.get(endpoints.leaderboard, { params });
    // Transform backend response format to frontend expected format
    const leaderboard = response.data.leaderboard || [];
    return leaderboard.map((item: any) => ({
      player_id: item.player_id,
      name: item.full_name,
      position: item.position,
      team: item.team,
      fantasy_points: item.fantasy_points,
      yahoo_points: 0, // TODO: Implement Yahoo points
      delta: 0, // TODO: Calculate delta
      vorp: 0, // TODO: Calculate VORP
      tier: 0, // TODO: Calculate tier
      adp: 0, // TODO: Get ADP data
      news_count: 0, // TODO: Get news count
      bye_week: 0, // TODO: Get bye week
    }));
  },

  // Get available scoring profiles
  async getProfiles(): Promise<ScoringProfile[]> {
    const response = await api.get(endpoints.profiles);
    // Transform backend response format to frontend expected format
    const profiles = response.data.profiles || [];
    return profiles.map((profile: any) => ({
      profile_id: profile.profile_id,
      name: profile.name,
      description: profile.description,
      is_public: profile.is_public,
      created_at: profile.created_at,
      rules: profile.rules || [],
    }));
  },

  // Get specific scoring profile
  async getProfile(profileId: string): Promise<ScoringProfile> {
    const response = await api.get(`${endpoints.profiles}/${profileId}`);
    return response.data;
  },

  // Create scoring profile
  async createProfile(profile: Omit<ScoringProfile, 'profile_id' | 'created_at'>): Promise<ScoringProfile> {
    const response = await api.post(endpoints.profiles, profile);
    return response.data;
  },

  // Update scoring profile
  async updateProfile(profileId: string, profile: Omit<ScoringProfile, 'profile_id' | 'created_at'>): Promise<ScoringProfile> {
    const response = await api.put(`${endpoints.profiles}/${profileId}`, profile);
    return response.data;
  },

  // Delete scoring profile
  async deleteProfile(profileId: string): Promise<void> {
    await api.delete(`${endpoints.profiles}/${profileId}`);
  },
};

export const rankingsAPI = {
  async getRankings(source: RankingSourceId, limit = 500): Promise<RankingsResponse> {
    const response = await api.get(endpoints.rankings, {
      params: { source, rank_type: 'preseason', scoring: 'PPR', limit },
    });
    return response.data;
  },

  async getSources(): Promise<RankingSourceStatus[]> {
    const response = await api.get(endpoints.rankingSources);
    return response.data.sources || [];
  },

  async refreshAll(): Promise<SourceRefreshResponse> {
    const response = await api.post(`${endpoints.rankings}refresh-all`);
    return response.data;
  },

  async getHistory(playerId: string, source: RankingSourceId): Promise<RankingHistoryResponse> {
    const response = await api.get(`${endpoints.rankings}${playerId}/history`, {
      params: { source, rank_type: 'preseason' },
    });
    return response.data;
  },

  async getProjectionAnalytics(
    profileId: string,
    season: number,
    config: ProjectionLeagueConfig = {},
  ): Promise<ProjectionAnalyticsResponse> {
    const response = await api.get(`${endpoints.rankings}projection-analytics`, {
      params: { profile_id: profileId, season, ...config },
    });
    return response.data;
  },
};

// Health check
export const healthAPI = {
  async check(): Promise<{ status: string; service: string }> {
    const response = await api.get(endpoints.health);
    return response.data;
  },
};
