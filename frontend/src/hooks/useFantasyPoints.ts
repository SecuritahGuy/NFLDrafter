import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fantasyAPI, PointsResponse, BulkPointsRequest, LeaderboardParams, Player } from '../api';

// Query keys for caching
export const fantasyPointsKeys = {
  all: ['fantasyPoints'] as const,
  points: () => [...fantasyPointsKeys.all, 'points'] as const,
  point: (playerId: string, season: number, week: number, profileId: string) => 
    [...fantasyPointsKeys.points(), playerId, season, week, profileId] as const,
  bulk: () => [...fantasyPointsKeys.all, 'bulk'] as const,
  bulkPoints: (request: BulkPointsRequest) => [...fantasyPointsKeys.bulk(), request] as const,
  leaderboard: () => [...fantasyPointsKeys.all, 'leaderboard'] as const,
  leaderboardData: (params: LeaderboardParams) => 
    [...fantasyPointsKeys.leaderboard(), params] as const,
};

// Hook for calculating points for a single player
export const useFantasyPoints = (
  playerId: string,
  season: number,
  week: number,
  profileId: string
) => {
  return useQuery({
    queryKey: fantasyPointsKeys.point(playerId, season, week, profileId),
    queryFn: () => fantasyAPI.getPoints(playerId, season, week, profileId),
    enabled: !!playerId && !!season && !!week && !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for calculating points for multiple players
export const useBulkFantasyPoints = (request: BulkPointsRequest) => {
  return useQuery({
    queryKey: fantasyPointsKeys.bulkPoints(request),
    queryFn: () => fantasyAPI.getBulkPoints(request),
    enabled: !!request.player_ids.length && !!request.season && !!request.week && !!request.profile_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for getting leaderboard
export const useLeaderboard = (params: LeaderboardParams) => {
  return useQuery({
    queryKey: fantasyPointsKeys.leaderboardData(params),
    queryFn: () => fantasyAPI.getLeaderboard(params),
    enabled: !!params.season && !!params.week && !!params.profile_id,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for calculating points for a list of players (useful for PlayerBoard)
export const usePlayersWithPoints = (
  playerIds: string[],
  season: number,
  week: number,
  profileId: string
) => {
  return useQuery({
    queryKey: fantasyPointsKeys.bulkPoints({ player_ids: playerIds, season, week, profile_id: profileId }),
    queryFn: () => fantasyAPI.getBulkPoints({ player_ids: playerIds, season, week, profile_id: profileId }),
    enabled: playerIds.length > 0 && !!season && !!week && !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for getting top performers by position
export const useTopPerformersByPosition = (
  position: string,
  season: number,
  week: number,
  profileId: string,
  limit: number = 20
) => {
  return useQuery({
    queryKey: fantasyPointsKeys.leaderboardData({ 
      season, 
      week, 
      profile_id: profileId, 
      position, 
      limit 
    }),
    queryFn: () => fantasyAPI.getLeaderboard({ 
      season, 
      week, 
      profile_id: profileId, 
      position, 
      limit 
    }),
    enabled: !!position && !!season && !!week && !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for getting weekly top performers
export const useWeeklyTopPerformers = (
  season: number,
  week: number,
  profileId: string,
  limit: number = 50
) => {
  return useQuery({
    queryKey: fantasyPointsKeys.leaderboardData({ 
      season, 
      week, 
      profile_id: profileId, 
      limit 
    }),
    queryFn: () => fantasyAPI.getLeaderboard({ 
      season, 
      week, 
      profile_id: profileId, 
      limit 
    }),
    enabled: !!season && !!week && !!profileId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for getting season-long top performers
export const useSeasonTopPerformers = (
  season: number,
  profileId: string,
  limit: number = 100
) => {
  return useQuery({
    queryKey: fantasyPointsKeys.leaderboardData({ 
      season, 
      week: 0, // 0 indicates season-long stats
      profile_id: profileId, 
      limit 
    }),
    queryFn: () => fantasyAPI.getLeaderboard({ 
      season, 
      week: 0, // 0 indicates season-long stats
      profile_id: profileId, 
      limit 
    }),
    enabled: !!season && !!profileId,
    staleTime: 10 * 60 * 1000, // Season stats change less frequently
    gcTime: 30 * 60 * 1000,
  });
};
