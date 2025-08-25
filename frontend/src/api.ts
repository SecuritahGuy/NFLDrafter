import axios from 'axios';

// Create axios instance with base configuration
export const api = axios.create({
  baseURL: 'http://localhost:8000',
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
  bulkPoints: '/fantasy/bulk-points',
  leaderboard: '/fantasy/leaderboard',
  
  // Health check
  health: '/health',
} as const;

// Types for API responses
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

// API functions
export const playersAPI = {
  // Search players with filters
  async searchPlayers(params: PlayerSearchParams = {}): Promise<Player[]> {
    const response = await api.get(endpoints.players, { params });
    return response.data;
  },

  // Get player by ID
  async getPlayer(playerId: string): Promise<Player> {
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
    return response.data;
  },

  // Get leaderboard
  async getLeaderboard(params: LeaderboardParams): Promise<Player[]> {
    const response = await api.get(endpoints.leaderboard, { params });
    return response.data;
  },

  // Get available scoring profiles
  async getProfiles(): Promise<ScoringProfile[]> {
    const response = await api.get(endpoints.profiles);
    return response.data;
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

// Health check
export const healthAPI = {
  async check(): Promise<{ status: string; service: string }> {
    const response = await api.get(endpoints.health);
    return response.data;
  },
};
