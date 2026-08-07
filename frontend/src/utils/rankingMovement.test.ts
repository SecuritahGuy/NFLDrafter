import { describe, expect, it } from 'vitest'
import { buildRankingMovementSeries } from './rankingMovement'

const point = (snapshot_date: string, rank: number | null, ecr: number | null = null) => ({
  snapshot_date,
  rank,
  ecr,
  pos_rank: null,
  team: null,
  rank_delta: null,
})

describe('buildRankingMovementSeries', () => {
  it('combines sparse source histories by date and prefers ECR', () => {
    const series = buildRankingMovementSeries({
      'fantasypros-ecr': [point('2026-08-07', 11, 10.4)],
      'espn-draft-rank': [point('2026-08-06', 14), point('2026-08-07', 9)],
      'ffc-adp': [point('2026-08-07', 12)],
    })

    expect(series).toEqual([
      { date: '2026-08-06', espn: 14 },
      { date: '2026-08-07', fantasyPros: 10.4, espn: 9, ffc: 12 },
    ])
  })
})
