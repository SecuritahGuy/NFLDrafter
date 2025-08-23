import { useQuery } from '@tanstack/react-query';
import { fantasyAPI } from '../api';

export function usePoints(
  playerId: string,
  season: number,
  week: number,
  profileId: string,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['points', playerId, season, week, profileId],
    queryFn: () => fantasyAPI.getPoints(playerId, season, week, profileId),
    enabled: enabled && !!playerId && !!profileId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function usePlayerStats(
  playerId: string,
  season: number,
  week: number,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['playerStats', playerId, season, week],
    queryFn: () => fantasyAPI.getPlayerStats(playerId, season, week),
    enabled: enabled && !!playerId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
}

export function useScoringProfiles() {
  return useQuery({
    queryKey: ['scoringProfiles'],
    queryFn: () => fantasyAPI.getProfiles(),
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
}
