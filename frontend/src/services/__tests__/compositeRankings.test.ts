import { describe, expect, it } from 'vitest'
import type { BackendPlayer, RankingRow } from '../../api'
import { buildCompositeRankings } from '../compositeRankings'

const player: BackendPlayer = {
  player_id: 'p1', full_name: 'Player One', position: 'WR', team: 'CHI',
}

const ranking: RankingRow = {
  rank: 10, pos_rank: 2, player_id: 'p1', full_name: 'Player One', position: 'WR', team: 'CHI',
  projection_source: 'FantasyPros', ecr: 10, tier: 1, sd: null, best: null, worst: null,
  rank_delta: null, bye: null, projected_points: null, projected_points_per_game: null,
  projection_season: null,
}

describe('buildCompositeRankings', () => {
  it('returns no rankings when supplied a malformed player payload', () => {
    const rankings = buildCompositeRankings({ players: [player] } as unknown as BackendPlayer[], [ranking])

    expect(rankings).toEqual(new Map())
  })

  it('builds a ranking from an array of players', () => {
    const rankings = buildCompositeRankings([player], [ranking])

    expect(rankings.get('p1')?.rank).toBe(1)
  })
})
