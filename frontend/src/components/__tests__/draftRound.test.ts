import { describe, expect, it } from 'vitest'
import { estimateDraftRound } from '../PlayerBoard'

describe('estimateDraftRound', () => {
  it('converts ADP into the active league round and pick', () => {
    expect(estimateDraftRound(1.5, 12)).toEqual({ round: 1, pickInRound: 2 })
    expect(estimateDraftRound(12.7, 12)).toEqual({ round: 2, pickInRound: 1 })
    expect(estimateDraftRound(25, 10)).toEqual({ round: 3, pickInRound: 5 })
  })

  it('does not estimate a round without usable ADP', () => {
    expect(estimateDraftRound(0, 12)).toBeNull()
    expect(estimateDraftRound(undefined, 12)).toBeNull()
  })
})
