// Integration Tests Index
// This file exports all integration tests for easy importing and organization

export { default as DraftRoomIntegrationTests } from './DraftRoom.integration.test'
export { default as PlayerBoardIntegrationTests } from './PlayerBoard.integration.test'
export { default as ScoringIntegrationTests } from './Scoring.integration.test'

// Integration test utilities and helpers can be added here
export const integrationTestUtils = {
  // Common test data for integration tests
  mockPlayers: [
    {
      id: '1',
      name: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      fantasyPoints: 350.5,
      yahooPoints: 340.2,
      delta: 10.3,
      vorp: 45.2,
      tier: 1,
      adp: 2,
      newsCount: 3,
      byeWeek: 9,
    },
    {
      id: '2',
      name: 'Patrick Mahomes',
      position: 'QB',
      team: 'KC',
      fantasyPoints: 320.8,
      yahooPoints: 315.6,
      delta: 5.2,
      vorp: 38.7,
      tier: 1,
      adp: 15,
      newsCount: 2,
      byeWeek: 10,
    },
    {
      id: '3',
      name: 'Tyreek Hill',
      position: 'WR',
      team: 'MIA',
      fantasyPoints: 310.2,
      yahooPoints: 305.8,
      delta: 4.4,
      vorp: 35.1,
      tier: 1,
      adp: 8,
      newsCount: 4,
      byeWeek: 11,
    },
  ],
  
  // Common test props for integration testing
  defaultProps: {
    scoringProfile: 'Test Profile',
    onPlayerSelect: vi.fn(),
    onAddToWatchlist: vi.fn(),
    onRemoveFromWatchlist: vi.fn(),
    onTierChange: vi.fn(),
    onVorpChange: vi.fn(),
    onReplacementRanksChange: vi.fn(),
  },
  
  // Helper functions for integration tests
  createLargePlayerSet: (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `player-${i}`,
      name: `Player ${i}`,
      position: ['QB', 'RB', 'WR', 'TE'][i % 4],
      team: `TEAM${i % 32}`,
      fantasyPoints: Math.random() * 300,
      yahooPoints: Math.random() * 300,
      delta: Math.random() * 20 - 10,
      vorp: Math.random() * 100,
      tier: Math.floor(Math.random() * 5) + 1,
      adp: Math.floor(Math.random() * 200) + 1,
      newsCount: Math.floor(Math.random() * 5),
      byeWeek: Math.floor(Math.random() * 18) + 1,
    }))
  },
  
  // Mock roster slots for testing
  mockRosterSlots: [
    { position: 'QB', required: 1, filled: 0, byeWeeks: [] },
    { position: 'RB', required: 2, filled: 0, byeWeeks: [] },
    { position: 'WR', required: 2, filled: 0, byeWeeks: [] },
    { position: 'TE', required: 1, filled: 0, byeWeeks: [] },
    { position: 'FLEX', required: 1, filled: 0, byeWeeks: [] },
    { position: 'K', required: 1, filled: 0, byeWeeks: [] },
    { position: 'DEF', required: 1, filled: 0, byeWeeks: [] },
    { position: 'BN', required: 6, filled: 0, byeWeeks: [] },
  ],
}
