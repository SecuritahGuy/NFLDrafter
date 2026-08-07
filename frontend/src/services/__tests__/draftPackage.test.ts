import { beforeEach, describe, expect, it } from 'vitest'
import {
  createDraftPackage,
  loadDraftPackage,
  parseDraftPackage,
  saveDraftPackage,
  serializeDraftPackage,
} from '../draftPackage'

const buildPackage = () => createDraftPackage({
  generatedAt: '2026-08-06T12:00:00.000Z',
  season: 2026,
  scoringProfile: {
    profileId: 'ppr',
    name: 'PPR',
    rules: [{ statKey: 'receptions', multiplier: 1, per: 1 }],
  },
  league: { leagueSize: 12, draftSlot: 4, rounds: 15 },
  rosterSlots: [{ position: 'QB', required: 1 }],
  players: [{
    id: 'player-1', name: 'Example Player', position: 'WR', team: 'CHI',
    fantasyPoints: 100, yahooPoints: 100, delta: 0, vorp: 20, tier: 1,
    adp: 10, newsCount: 0, byeWeek: 7,
  }],
})

describe('draft packages', () => {
  beforeEach(() => window.localStorage.clear())

  it('round-trips a versioned package with its checksum', () => {
    const draftPackage = buildPackage()
    expect(parseDraftPackage(serializeDraftPackage(draftPackage))).toEqual(draftPackage)
    expect(draftPackage.checksum).toMatch(/^fnv1a32:/)
  })

  it('rejects drifted package contents', () => {
    const serialized = serializeDraftPackage(buildPackage()).replace('Example Player', 'Changed Player')
    expect(() => parseDraftPackage(serialized)).toThrow(/checksum/)
  })

  it('persists the prepared package for offline recovery', () => {
    const draftPackage = buildPackage()
    saveDraftPackage(draftPackage)
    expect(loadDraftPackage()).toEqual(draftPackage)
  })
})
