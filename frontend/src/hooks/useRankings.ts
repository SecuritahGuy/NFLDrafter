import { useQuery } from '@tanstack/react-query'
import { rankingsAPI, type ProjectionLeagueConfig, type RankingSourceId } from '../api'

export const rankingKeys = {
  all: ['rankings'] as const,
  source: (source: RankingSourceId) => [...rankingKeys.all, source] as const,
  sources: () => [...rankingKeys.all, 'sources'] as const,
  projections: (profileId: string, season: number, config: ProjectionLeagueConfig) =>
    [...rankingKeys.all, 'projection-analytics', profileId, season, config] as const,
}

export const useRankings = (source: RankingSourceId) => useQuery({
  queryKey: rankingKeys.source(source),
  queryFn: () => rankingsAPI.getRankings(source),
  staleTime: 30 * 60 * 1000,
})

export const useRankingSources = () => useQuery({
  queryKey: rankingKeys.sources(),
  queryFn: () => rankingsAPI.getSources(),
  staleTime: 5 * 60 * 1000,
})

export const useProjectionAnalytics = (
  profileId: string,
  season: number,
  config: ProjectionLeagueConfig = {},
) => useQuery({
  queryKey: rankingKeys.projections(profileId, season, config),
  queryFn: () => rankingsAPI.getProjectionAnalytics(profileId, season, config),
  enabled: Boolean(profileId),
  staleTime: 30 * 60 * 1000,
})
