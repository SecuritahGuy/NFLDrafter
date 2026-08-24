import { describe, expect, it } from 'vitest'
import type { Player } from '../../types'
import {
  addDraftPick,
  assignRosterSlots,
  createDraftSession,
  nextPickForTeam,
  openingDraftPlan,
  recommendPlayers,
  removeDraftPick,
  teamForPick,
} from '../draftEngine'

const player = (id: string, position: string, vorp: number, adp: number, tier = 2): Player => ({
  id,
  name: id,
  position,
  team: 'NFL',
  fantasyPoints: 250,
  yahooPoints: 0,
  delta: 0,
  vorp,
  tier,
  adp,
  newsCount: 0,
  byeWeek: 8,
})

describe('draftEngine', () => {
  it('calculates snake draft ownership at round turns', () => {
    expect([1, 12, 13, 24, 25].map((pick) => teamForPick(pick, 12))).toEqual([1, 12, 12, 1, 1])
    expect(nextPickForTeam(1, 1, 12, 15)).toBe(24)
    expect(nextPickForTeam(24, 1, 12, 2)).toBeNull()
  })

  it('records, prevents duplicate players, undoes, and resequences corrections', () => {
    let session = createDraftSession({ leagueSize: 10, draftSlot: 4, rounds: 15 })
    session = addDraftPick(session, 'alpha', false, '2026-01-01T00:00:00Z')
    session = addDraftPick(session, 'bravo', true, '2026-01-01T00:00:01Z')
    session = addDraftPick(session, 'alpha', false)
    expect(session.picks).toHaveLength(2)
    expect(session.picks[1]).toMatchObject({ playerId: 'bravo', team: 4, isMine: true })

    session = removeDraftPick(session, 1)
    expect(session.picks).toEqual([
      expect.objectContaining({ pick: 1, playerId: 'bravo', team: 4 }),
    ])
  })

  it('raises an unfilled roster need in explainable recommendations', () => {
    const players = [player('quarterback', 'QB', 12, 18), player('receiver', 'WR', 15, 20)]
    const session = addDraftPick(createDraftSession(), 'receiver', true)
    const recommendations = recommendPlayers([players[0]], session.picks, players, 2, 24)
    expect(recommendations[0].player.id).toBe('quarterback')
    expect(recommendations[0].reason).toContain('roster need')
  })

  it('uses profile-scored VORP and tiers in recommendation order and explanation', () => {
    const highValue = player('profile-value', 'RB', 42, 30, 1)
    const marketFavorite = { ...player('market-rank', 'RB', 4, 3, 4), rank: 1 }
    const recommendations = recommendPlayers(
      [marketFavorite, highValue],
      [],
      [marketFavorite, highValue],
      1,
      24,
    )

    expect(recommendations[0].player.id).toBe('profile-value')
    expect(recommendations[0].reason).toContain('42.0 VORP')
  })

  it('uses the ADP distribution to flag players unlikely to reach the next pick', () => {
    const urgent = {
      ...player('urgent', 'WR', 20, 8, 2),
      draftConfidence: {
        level: 'high' as const, score: 90, sourceCount: 3, sourceSpread: 3,
        sourceDeviation: 1.5, expertRange: { best: 5, worst: 12, spread: 7 },
        marketRange: { best: 4, worst: 15, spread: 11 }, marketAdpDeviation: 2,
        rankMovement: 2, evidence: 'three sources agree',
      },
    }
    const recommendation = recommendPlayers([urgent], [], [urgent], 1, 24)[0]
    expect(recommendation.availability?.label).toBe('unlikely')
    expect(recommendation.availability?.basis).toBe('ffc_distribution')
  })

  it('assigns dedicated starters before flex and bench slots', () => {
    const players = [
      player('rb1', 'RB', 1, 1), player('rb2', 'RB', 1, 2), player('rb3', 'RB', 1, 3),
      player('wr1', 'WR', 1, 4), player('qb1', 'QB', 1, 5), player('qb2', 'QB', 1, 6),
    ]
    const assigned = assignRosterSlots(players, [
      { position: 'QB', required: 1 }, { position: 'RB', required: 2 },
      { position: 'WR', required: 1 }, { position: 'FLEX', required: 1 },
      { position: 'SUPERFLEX', required: 1 },
      { position: 'BN', required: 2 },
    ])
    expect(assigned.RB.map(({ id }) => id)).toEqual(['rb1', 'rb2'])
    expect(assigned.FLEX.map(({ id }) => id)).toEqual(['rb3'])
    expect(assigned.SUPERFLEX.map(({ id }) => id)).toEqual(['qb2'])
    expect(assigned.BN).toHaveLength(0)
  })

  it('treats WR/WR as the flexible default after an RB start from slot one', () => {
    const rb = player('first-rb', 'RB', 50, 1)
    const session = addDraftPick(createDraftSession(), rb.id, true)
    const plan = openingDraftPlan(session.picks, [rb], session.config)
    expect(plan.targets).toEqual(['WR', 'WR'])
    expect(plan.label).toContain('default, not a lock')
    expect(plan.rationale).toContain('picks 24 / 25')
  })
})
