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
  // Fantasy scoring
  points: '/fantasy/points',
  playerStats: '/fantasy/players',
  profiles: '/fantasy/profiles',
  
  // Health check
  health: '/health',
} as const;

// Types for API responses
export interface PointsResponse {
  points: number;
  stats: Record<string, number>;
  profile_name: string;
}

export interface ScoringProfile {
  profile_id: string;
  name: string;
  description?: string;
  created_at: number;
}

export interface PlayerStats {
  player_id: string;
  season: number;
  week: number;
  stats: Record<string, number>;
}

// API functions
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

  // Get player stats for a week
  async getPlayerStats(
    playerId: string,
    season: number,
    week: number
  ): Promise<PlayerStats> {
    const response = await api.get(`${endpoints.playerStats}/${playerId}/stats`, {
      params: { season, week }
    });
    return response.data;
  },

  // Get available scoring profiles
  async getProfiles(): Promise<{ profiles: ScoringProfile[] }> {
    const response = await api.get(endpoints.profiles);
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
