import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { playersAPI, Player, PlayerSearchParams, PlayerWeekStat } from '../api';

// Query keys for caching
export const playerKeys = {
  all: ['players'] as const,
  lists: () => [...playerKeys.all, 'list'] as const,
  list: (filters: PlayerSearchParams) => [...playerKeys.lists(), filters] as const,
  details: () => [...playerKeys.all, 'detail'] as const,
  detail: (id: string) => [...playerKeys.details(), id] as const,
  stats: () => [...playerKeys.all, 'stats'] as const,
  stat: (playerId: string, season: number, week: number) => 
    [...playerKeys.stats(), playerId, season, week] as const,
  positions: () => [...playerKeys.all, 'positions'] as const,
  teams: () => [...playerKeys.all, 'teams'] as const,
};

// Hook for searching players
export const usePlayers = (params: PlayerSearchParams = {}) => {
  return useQuery({
    queryKey: playerKeys.list(params),
    queryFn: () => playersAPI.searchPlayers(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

// Hook for getting a specific player
export const usePlayer = (playerId: string) => {
  return useQuery({
    queryKey: playerKeys.detail(playerId),
    queryFn: () => playersAPI.getPlayer(playerId),
    enabled: !!playerId,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for getting player weekly stats
export const usePlayerStats = (playerId: string, season: number, week: number) => {
  return useQuery({
    queryKey: playerKeys.stat(playerId, season, week),
    queryFn: () => playersAPI.getPlayerStats(playerId, season, week),
    enabled: !!playerId && !!season && !!week,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for getting available positions
export const usePositions = () => {
  return useQuery({
    queryKey: playerKeys.positions(),
    queryFn: () => playersAPI.getPositions(),
    staleTime: 30 * 60 * 1000, // 30 minutes (positions don't change often)
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

// Hook for getting available teams
export const useTeams = () => {
  return useQuery({
    queryKey: playerKeys.teams(),
    queryFn: () => playersAPI.getTeams(),
    staleTime: 30 * 60 * 1000, // 30 minutes (teams don't change often)
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

// Hook for getting top players by position
export const useTopPlayers = (position: string, limit: number = 50) => {
  return useQuery({
    queryKey: playerKeys.list({ position, limit }),
    queryFn: () => playersAPI.searchPlayers({ position, limit }),
    enabled: !!position,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for getting players by team
export const usePlayersByTeam = (team: string, limit: number = 100) => {
  return useQuery({
    queryKey: playerKeys.list({ team, limit }),
    queryFn: () => playersAPI.searchPlayers({ team, limit }),
    enabled: !!team,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
};

// Hook for getting players with recent stats (for current season)
export const useCurrentSeasonPlayers = (season: number = 2024, limit: number = 100) => {
  return useQuery({
    queryKey: playerKeys.list({ limit }),
    queryFn: () => playersAPI.searchPlayers({ limit }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    select: (players) => players.filter(player => player.season === season),
  });
};
