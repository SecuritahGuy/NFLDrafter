import { describe, expect, it } from 'vitest'
import type { RankingRow } from '../../api'
import { buildDraftConfidence, estimateAvailability } from '../draftConfidence'

const row = (overrides: Partial<RankingRow>): RankingRow => ({
  rank: 10, pos_rank: 2, player_id: 'p1', full_name: 'Player One', position: 'WR', team: 'CHI',
  projection_source: 'ESPN', ecr: 10, tier: 1, sd: null, best: null, worst: null,
  rank_delta: null, bye: 8, projected_points: null, projected_points_per_game: null,
  projection_season: null, ...overrides,
})

describe('draft confidence', () => {
  it('rates a tight three-source consensus with a narrow expert range highly', () => {
    const confidence = buildDraftConfidence(
      row({ ecr: 10, best: 7, worst: 16 }),
      row({ rank: 12 }),
      row({ ecr: 11, sd: 3.5, best: 5, worst: 20 }),
    )
    expect(confidence.level).toBe('high')
    expect(confidence.score).toBe(100)
    expect(confidence.sourceSpread).toBe(2)
    expect(confidence.marketAdpDeviation).toBe(3.5)
  })

  it('labels one-source evidence as limited', () => {
    const confidence = buildDraftConfidence(undefined, row({ rank: 40 }), undefined)
    expect(confidence.level).toBe('limited')
    expect(confidence.sourceCount).toBe(1)
  })

  it('uses ADP variance to estimate whether a player returns', () => {
    const earlyPlayer = estimateAvailability(10, 3, 24)
    const laterPlayer = estimateAvailability(31, 5, 24)
    expect(earlyPlayer?.label).toBe('unlikely')
    expect(earlyPlayer?.probability).toBeLessThan(0.01)
    expect(laterPlayer?.label).toBe('likely')
    expect(laterPlayer?.basis).toBe('ffc_distribution')
  })

  it('labels fallback variance as modeled rather than provider supplied', () => {
    expect(estimateAvailability(30, null, 24)?.basis).toBe('modeled_spread')
  })
})
