import { useQuery } from '@tanstack/react-query'
import { rankingsAPI, type RankingSourceId } from '../api'

export const rankingKeys = {
  all: ['rankings'] as const,
  source: (source: RankingSourceId) => [...rankingKeys.all, source] as const,
  sources: () => [...rankingKeys.all, 'sources'] as const,
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
