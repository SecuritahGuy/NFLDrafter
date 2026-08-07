import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { Player } from '../../types'
import { ProjectionAnalyticsPanel } from '../ProjectionAnalyticsPanel'

const players: Player[] = [
  {
    id: 'wr-1', name: 'Profile Star', position: 'WR', team: 'CHI',
    fantasyPoints: 300, yahooPoints: 285, delta: 15, vorp: 90, tier: 1,
    adp: 4, newsCount: 0, byeWeek: 8, replacementRank: 28,
    projectionScoringBasis: 'profile',
  },
  {
    id: 'k-1', name: 'Fallback Kicker', position: 'K', team: 'BUF',
    fantasyPoints: 120, yahooPoints: 120, delta: 0, vorp: 15, tier: 1,
    adp: 160, newsCount: 0, byeWeek: 7, replacementRank: 12,
    projectionScoringBasis: 'source_fallback',
  },
]

describe('ProjectionAnalyticsPanel', () => {
  it('shows the selected profile, VORP, tiers, fallback count, and methodology', () => {
    render(
      <ProjectionAnalyticsPanel
        players={players}
        profileName="Custom PPR"
        snapshotDate="2026-08-07"
        methodology={{
          replacement_ranks: { WR: 28, K: 12 },
          flex_allocation: 'FLEX method',
          tier_method: 'Tier method',
          fallback: 'Fallback method',
        }}
      />,
    )

    expect(screen.getByText('Custom PPR tiers & VORP')).toBeInTheDocument()
    expect(screen.getByText('Profile Star')).toBeInTheDocument()
    expect(screen.getByText('+90.0')).toBeInTheDocument()
    expect(screen.getByText('1', { selector: 'div.text-xl' })).toBeInTheDocument()
    expect(screen.getByText('How replacement and tiers are calculated')).toBeInTheDocument()
  })
})
