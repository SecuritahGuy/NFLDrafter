import { vi } from 'vitest'

// Mock scoring profiles data
export const mockScoringProfiles = {
  profiles: [
    {
      profile_id: 'test-profile-1',
      name: 'Standard PPR',
      description: 'Standard PPR scoring',
      is_public: true,
      created_at: 1640995200
    },
    {
      profile_id: 'test-profile-2', 
      name: 'Half PPR',
      description: 'Half PPR scoring',
      is_public: true,
      created_at: 1640995200
    }
  ]
}

// Mock scoring rules data
export const mockScoringRules = [
  {
    stat_key: 'passing_yards',
    multiplier: 0.04,
    per: 1,
    bonus_min: 300,
    bonus_points: 3,
    cap: null
  },
  {
    stat_key: 'passing_touchdowns',
    multiplier: 4.0,
    per: 1,
    bonus_min: null,
    bonus_points: 0,
    cap: null
  },
  {
    stat_key: 'rushing_yards',
    multiplier: 0.1,
    per: 1,
    bonus_min: 100,
    bonus_points: 2,
    cap: null
  }
]

// Mock player data
export const mockPlayers = [
  {
    id: 'player-1',
    name: 'Patrick Mahomes',
    position: 'QB',
    team: 'KC'
  },
  {
    id: 'player-2',
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF'
  },
  {
    id: 'player-3',
    name: 'Tyreek Hill',
    position: 'WR',
    team: 'MIA'
  }
]

// Mock player stats
export const mockPlayerStats = {
  player_id: 'player-1',
  season: 2023,
  week: 1,
  stats: {
    passing_yards: 350,
    passing_touchdowns: 3,
    rushing_yards: 15,
    interceptions: 1
  }
}

// Mock points calculation result
export const mockPointsResult = {
  player_id: 'player-1',
  season: 2023,
  week: 1,
  profile_id: 'test-profile-1',
  total_points: 25.5,
  breakdown: {
    passing_yards: 14.0,
    passing_touchdowns: 12.0,
    rushing_yards: 1.5,
    interceptions: -2.0
  }
}

// API mocks
export const fantasyAPIMock = {
  getProfiles: vi.fn().mockResolvedValue(mockScoringProfiles),
  getPoints: vi.fn().mockResolvedValue(mockPointsResult),
  getPlayerStats: vi.fn().mockResolvedValue(mockPlayerStats),
  calculatePoints: vi.fn().mockResolvedValue(mockPointsResult)
}

// Export the mock for manual setup in tests
// Don't auto-mock here as it interferes with other tests
