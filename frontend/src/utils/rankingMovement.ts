import type { RankingHistoryPoint, RankingSourceId } from '../api'

export type RankingHistoryBySource = Partial<Record<RankingSourceId, RankingHistoryPoint[]>>

const sourceKeys: Array<[RankingSourceId, 'fantasyPros' | 'espn' | 'ffc']> = [
  ['fantasypros-ecr', 'fantasyPros'],
  ['espn-draft-rank', 'espn'],
  ['ffc-adp', 'ffc'],
]

export function buildRankingMovementSeries(histories: RankingHistoryBySource) {
  const dates = new Map<string, Record<string, string | number>>()
  for (const [source, key] of sourceKeys) {
    for (const point of histories[source] ?? []) {
      const row = dates.get(point.snapshot_date) ?? { date: point.snapshot_date }
      const value = point.ecr ?? point.rank
      if (value != null) row[key] = value
      dates.set(point.snapshot_date, row)
    }
  }
  return [...dates.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}
