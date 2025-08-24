import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ChevronUpIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-up-icon" />
  ),
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-down-icon" />
  ),
  StarIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="star-icon" />
  ),
  XMarkIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="x-mark-icon" />
  ),
  ExclamationTriangleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="exclamation-triangle-icon" />
  ),
  CheckCircleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="check-circle-icon" />
  ),
}))

// 2025 Season Mock Data
const season2025Players = [
  // Top Tier QBs - 2025 Projections
  {
    id: '2025-qb-1',
    name: 'Josh Allen',
    position: 'QB',
    team: 'BUF',
    fantasyPoints: 385.2,
    yahooPoints: 375.8,
    delta: 9.4,
    vorp: 52.3,
    tier: 1,
    adp: 8,
    newsCount: 5,
    byeWeek: 13,
    season: 2025,
    projectedStats: {
      passing_yards: 4500,
      passing_touchdowns: 35,
      rushing_yards: 650,
      rushing_touchdowns: 8,
      interceptions: 12
    }
  },
  {
    id: '2025-qb-2',
    name: 'Patrick Mahomes',
    position: 'QB',
    team: 'KC',
    fantasyPoints: 372.8,
    yahooPoints: 365.4,
    delta: 7.4,
    vorp: 48.9,
    tier: 1,
    adp: 12,
    newsCount: 3,
    byeWeek: 10,
    season: 2025,
    projectedStats: {
      passing_yards: 4300,
      passing_touchdowns: 32,
      rushing_yards: 450,
      rushing_touchdowns: 5,
      interceptions: 10
    }
  },
  {
    id: '2025-qb-3',
    name: 'Jalen Hurts',
    position: 'QB',
    team: 'PHI',
    fantasyPoints: 365.1,
    yahooPoints: 358.7,
    delta: 6.4,
    vorp: 46.2,
    tier: 1,
    adp: 15,
    newsCount: 4,
    byeWeek: 7,
    season: 2025,
    projectedStats: {
      passing_yards: 4100,
      passing_touchdowns: 28,
      rushing_yards: 750,
      rushing_touchdowns: 12,
      interceptions: 8
    }
  },

  // Top Tier RBs - 2025 Projections
  {
    id: '2025-rb-1',
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF',
    fantasyPoints: 398.5,
    yahooPoints: 385.2,
    delta: 13.3,
    vorp: 68.7,
    tier: 1,
    adp: 1,
    newsCount: 6,
    byeWeek: 9,
    season: 2025,
    projectedStats: {
      rushing_yards: 1450,
      rushing_touchdowns: 15,
      receiving_yards: 850,
      receiving_touchdowns: 6,
      receptions: 75
    }
  },
  {
    id: '2025-rb-2',
    name: 'Bijan Robinson',
    position: 'RB',
    team: 'ATL',
    fantasyPoints: 375.2,
    yahooPoints: 368.9,
    delta: 6.3,
    vorp: 58.4,
    tier: 1,
    adp: 3,
    newsCount: 4,
    byeWeek: 11,
    season: 2025,
    projectedStats: {
      rushing_yards: 1350,
      rushing_touchdowns: 12,
      receiving_yards: 650,
      receiving_touchdowns: 4,
      receptions: 55
    }
  },
  {
    id: '2025-rb-3',
    name: 'Saquon Barkley',
    position: 'RB',
    team: 'PHI',
    fantasyPoints: 352.8,
    yahooPoints: 345.6,
    delta: 7.2,
    vorp: 52.1,
    tier: 2,
    adp: 18,
    newsCount: 3,
    byeWeek: 7,
    season: 2025,
    projectedStats: {
      rushing_yards: 1250,
      rushing_touchdowns: 10,
      receiving_yards: 550,
      receiving_touchdowns: 3,
      receptions: 45
    }
  },

  // Top Tier WRs - 2025 Projections
  {
    id: '2025-wr-1',
    name: 'Justin Jefferson',
    position: 'WR',
    team: 'MIN',
    fantasyPoints: 385.6,
    yahooPoints: 378.2,
    delta: 7.4,
    vorp: 62.8,
    tier: 1,
    adp: 4,
    newsCount: 5,
    byeWeek: 13,
    season: 2025,
    projectedStats: {
      receiving_yards: 1650,
      receiving_touchdowns: 12,
      receptions: 110,
      targets: 160
    }
  },
  {
    id: '2025-wr-2',
    name: 'Ja\'Marr Chase',
    position: 'WR',
    team: 'CIN',
    fantasyPoints: 372.3,
    yahooPoints: 365.8,
    delta: 6.5,
    vorp: 58.5,
    tier: 1,
    adp: 6,
    newsCount: 4,
    byeWeek: 12,
    season: 2025,
    projectedStats: {
      receiving_yards: 1550,
      receiving_touchdowns: 11,
      receptions: 105,
      targets: 150
    }
  },
  {
    id: '2025-wr-3',
    name: 'CeeDee Lamb',
    position: 'WR',
    team: 'DAL',
    fantasyPoints: 358.9,
    yahooPoints: 352.4,
    delta: 6.5,
    vorp: 54.1,
    tier: 2,
    adp: 9,
    newsCount: 3,
    byeWeek: 7,
    season: 2025,
    projectedStats: {
      receiving_yards: 1450,
      receiving_touchdowns: 10,
      receptions: 100,
      targets: 140
    }
  },

  // Top Tier TEs - 2025 Projections
  {
    id: '2025-te-1',
    name: 'Sam LaPorta',
    position: 'TE',
    team: 'DET',
    fantasyPoints: 285.4,
    yahooPoints: 278.9,
    delta: 6.5,
    vorp: 48.7,
    tier: 1,
    adp: 25,
    newsCount: 4,
    byeWeek: 9,
    season: 2025,
    projectedStats: {
      receiving_yards: 950,
      receiving_touchdowns: 8,
      receptions: 75,
      targets: 110
    }
  },
  {
    id: '2025-te-2',
    name: 'Travis Kelce',
    position: 'TE',
    team: 'KC',
    fantasyPoints: 275.8,
    yahooPoints: 268.5,
    delta: 7.3,
    vorp: 45.2,
    tier: 1,
    adp: 30,
    newsCount: 2,
    byeWeek: 10,
    season: 2025,
    projectedStats: {
      receiving_yards: 900,
      receiving_touchdowns: 7,
      receptions: 70,
      targets: 100
    }
  },

  // Rookies and Breakout Candidates - 2025
  {
    id: '2025-rookie-1',
    name: 'Marvin Harrison Jr.',
    position: 'WR',
    team: 'ARI',
    fantasyPoints: 285.6,
    yahooPoints: 275.2,
    delta: 10.4,
    vorp: 42.8,
    tier: 3,
    adp: 45,
    newsCount: 8,
    byeWeek: 14,
    season: 2025,
    projectedStats: {
      receiving_yards: 1100,
      receiving_touchdowns: 8,
      receptions: 80,
      targets: 120
    }
  },
  {
    id: '2025-rookie-2',
    name: 'Malik Nabers',
    position: 'WR',
    team: 'NYG',
    fantasyPoints: 265.3,
    yahooPoints: 258.9,
    delta: 6.4,
    vorp: 38.5,
    tier: 3,
    adp: 55,
    newsCount: 6,
    byeWeek: 11,
    season: 2025,
    projectedStats: {
      receiving_yards: 950,
      receiving_touchdowns: 6,
      receptions: 65,
      targets: 95
    }
  },
  {
    id: '2025-rookie-3',
    name: 'Rome Odunze',
    position: 'WR',
    team: 'CHI',
    fantasyPoints: 245.8,
    yahooPoints: 238.5,
    delta: 7.3,
    vorp: 35.2,
    tier: 4,
    adp: 65,
    newsCount: 5,
    byeWeek: 13,
    season: 2025,
    projectedStats: {
      receiving_yards: 850,
      receiving_touchdowns: 5,
      receptions: 55,
      targets: 80
    }
  },

  // Breakout Candidates - 2025
  {
    id: '2025-breakout-1',
    name: 'Tank Bigsby',
    position: 'RB',
    team: 'JAX',
    fantasyPoints: 285.4,
    yahooPoints: 275.8,
    delta: 9.6,
    vorp: 42.3,
    tier: 3,
    adp: 75,
    newsCount: 4,
    byeWeek: 9,
    season: 2025,
    projectedStats: {
      rushing_yards: 950,
      rushing_touchdowns: 8,
      receiving_yards: 350,
      receiving_touchdowns: 2,
      receptions: 30
    }
  },
  {
    id: '2025-breakout-2',
    name: 'Jaxon Smith-Njigba',
    position: 'WR',
    team: 'SEA',
    fantasyPoints: 265.7,
    yahooPoints: 258.3,
    delta: 7.4,
    vorp: 38.9,
    tier: 3,
    adp: 85,
    newsCount: 3,
    byeWeek: 5,
    season: 2025,
    projectedStats: {
      receiving_yards: 900,
      receiving_touchdowns: 6,
      receptions: 60,
      targets: 85
    }
  }
]

// 2025 Season Scoring Profiles
const season2025ScoringProfiles = [
  {
    id: '2025-standard-ppr',
    name: '2025 Standard PPR',
    description: 'Standard PPR scoring for 2025 season',
    rules: [
      { stat_key: 'passing_yards', multiplier: 0.04, bonus_min: 300, bonus_points: 3 },
      { stat_key: 'passing_touchdowns', multiplier: 4.0 },
      { stat_key: 'rushing_yards', multiplier: 0.1, bonus_min: 100, bonus_points: 2 },
      { stat_key: 'rushing_touchdowns', multiplier: 6.0 },
      { stat_key: 'receiving_yards', multiplier: 0.1, bonus_min: 100, bonus_points: 2 },
      { stat_key: 'receiving_touchdowns', multiplier: 6.0 },
      { stat_key: 'receptions', multiplier: 1.0 },
      { stat_key: 'interceptions', multiplier: -2.0 }
    ]
  },
  {
    id: '2025-half-ppr',
    name: '2025 Half PPR',
    description: 'Half PPR scoring for 2025 season',
    rules: [
      { stat_key: 'passing_yards', multiplier: 0.04, bonus_min: 300, bonus_points: 3 },
      { stat_key: 'passing_touchdowns', multiplier: 4.0 },
      { stat_key: 'rushing_yards', multiplier: 0.1, bonus_min: 100, bonus_points: 2 },
      { stat_key: 'rushing_touchdowns', multiplier: 6.0 },
      { stat_key: 'receiving_yards', multiplier: 0.1, bonus_min: 100, bonus_points: 2 },
      { stat_key: 'receiving_touchdowns', multiplier: 6.0 },
      { stat_key: 'receptions', multiplier: 0.5 },
      { stat_key: 'interceptions', multiplier: -2.0 }
    ]
  },
  {
    id: '2025-superflex',
    name: '2025 Superflex',
    description: 'Superflex scoring for 2025 season',
    rules: [
      { stat_key: 'passing_yards', multiplier: 0.04, bonus_min: 300, bonus_points: 3 },
      { stat_key: 'passing_touchdowns', multiplier: 4.0 },
      { stat_key: 'rushing_yards', multiplier: 0.1, bonus_min: 100, bonus_points: 2 },
      { stat_key: 'rushing_touchdowns', multiplier: 6.0 },
      { stat_key: 'receiving_yards', multiplier: 0.1, bonus_min: 100, bonus_points: 2 },
      { stat_key: 'receiving_touchdowns', multiplier: 6.0 },
      { stat_key: 'receptions', multiplier: 1.0 },
      { stat_key: 'interceptions', multiplier: -2.0 },
      { stat_key: 'qb_rush_yards', multiplier: 0.15, bonus_min: 50, bonus_points: 1 }
    ]
  }
]

describe('2025 Season Fantasy Football Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('2025 Season Data Validation', () => {
    it('should have correct number of players for 2025 season', () => {
      expect(season2025Players).toHaveLength(16)
    })

    it('should have all required positions represented', () => {
      const positions = season2025Players.map(p => p.position)
      expect(positions).toContain('QB')
      expect(positions).toContain('RB')
      expect(positions).toContain('WR')
      expect(positions).toContain('TE')
    })

    it('should have realistic 2025 fantasy point projections', () => {
      season2025Players.forEach(player => {
        expect(player.fantasyPoints).toBeGreaterThan(200)
        expect(player.fantasyPoints).toBeLessThan(500)
        expect(player.yahooPoints).toBeGreaterThan(200)
        expect(player.yahooPoints).toBeLessThan(500)
      })
    })

    it('should have valid 2025 season data', () => {
      season2025Players.forEach(player => {
        expect(player.season).toBe(2025)
        expect(player.adp).toBeGreaterThan(0)
        expect(player.adp).toBeLessThan(200)
        expect(player.byeWeek).toBeGreaterThan(0)
        expect(player.byeWeek).toBeLessThan(19)
      })
    })
  })

  describe('2025 Season Player Rankings', () => {
    it('should rank QBs correctly for 2025 season', () => {
      const qbs = season2025Players.filter(p => p.position === 'QB')
      const sortedQBs = qbs.sort((a, b) => b.fantasyPoints - a.fantasyPoints)
      
      expect(sortedQBs[0].name).toBe('Josh Allen')
      expect(sortedQBs[1].name).toBe('Patrick Mahomes')
      expect(sortedQBs[2].name).toBe('Jalen Hurts')
    })

    it('should rank RBs correctly for 2025 season', () => {
      const rbs = season2025Players.filter(p => p.position === 'RB')
      const sortedRBs = rbs.sort((a, b) => b.fantasyPoints - a.fantasyPoints)
      
      expect(sortedRBs[0].name).toBe('Christian McCaffrey')
      expect(sortedRBs[1].name).toBe('Bijan Robinson')
      expect(sortedRBs[2].name).toBe('Saquon Barkley')
    })

    it('should rank WRs correctly for 2025 season', () => {
      const wrs = season2025Players.filter(p => p.position === 'WR')
      const sortedWRs = wrs.sort((a, b) => b.fantasyPoints - a.fantasyPoints)
      
      expect(sortedWRs[0].name).toBe('Justin Jefferson')
      expect(sortedWRs[1].name).toBe('Ja\'Marr Chase')
      expect(sortedWRs[2].name).toBe('CeeDee Lamb')
    })

    it('should rank TEs correctly for 2025 season', () => {
      const tes = season2025Players.filter(p => p.position === 'TE')
      const sortedTEs = tes.sort((a, b) => b.fantasyPoints - a.fantasyPoints)
      
      expect(sortedTEs[0].name).toBe('Sam LaPorta')
      expect(sortedTEs[1].name).toBe('Travis Kelce')
    })
  })

  describe('2025 Season VORP Calculations', () => {
    it('should calculate VORP correctly for 2025 QBs', () => {
      const qbs = season2025Players.filter(p => p.position === 'QB')
      const sortedQBs = qbs.sort((a, b) => b.fantasyPoints - a.fantasyPoints)
      
      // Top QB should have highest VORP
      expect(sortedQBs[0].vorp).toBeGreaterThan(sortedQBs[1].vorp)
      expect(sortedQBs[0].vorp).toBeGreaterThan(sortedQBs[2].vorp)
    })

    it('should calculate VORP correctly for 2025 RBs', () => {
      const rbs = season2025Players.filter(p => p.position === 'RB')
      const sortedRBs = rbs.sort((a, b) => b.fantasyPoints - a.fantasyPoints)
      
      // Top RB should have highest VORP
      expect(sortedRBs[0].vorp).toBeGreaterThan(sortedRBs[1].vorp)
      expect(sortedRBs[0].vorp).toBeGreaterThan(sortedRBs[2].vorp)
    })

    it('should have realistic VORP values for 2025 season', () => {
      season2025Players.forEach(player => {
        expect(player.vorp).toBeGreaterThan(0)
        expect(player.vorp).toBeLessThan(100)
      })
    })
  })

  describe('2025 Season Tier Analysis', () => {
    it('should group players into appropriate tiers for 2025', () => {
      const tier1Players = season2025Players.filter(p => p.tier === 1)
      const tier2Players = season2025Players.filter(p => p.tier === 2)
      const tier3Players = season2025Players.filter(p => p.tier === 3)
      const tier4Players = season2025Players.filter(p => p.tier === 4)
      
      expect(tier1Players.length).toBeGreaterThan(0)
      expect(tier2Players.length).toBeGreaterThan(0)
      expect(tier3Players.length).toBeGreaterThan(0)
      expect(tier4Players.length).toBeGreaterThan(0)
    })

    it('should have top players in tier 1 for 2025', () => {
      const tier1Players = season2025Players.filter(p => p.tier === 1)
      const topNames = tier1Players.map(p => p.name)
      
      expect(topNames).toContain('Christian McCaffrey')
      expect(topNames).toContain('Justin Jefferson')
      expect(topNames).toContain('Josh Allen')
    })
  })

  describe('2025 Season ADP Analysis', () => {
    it('should have realistic ADP values for 2025 season', () => {
      season2025Players.forEach(player => {
        expect(player.adp).toBeGreaterThan(0)
        expect(player.adp).toBeLessThan(200)
      })
    })

    it('should have top players with early ADP for 2025', () => {
      const topPlayers = season2025Players.filter(p => p.adp <= 10)
      expect(topPlayers.length).toBeGreaterThan(0)
      
      const topNames = topPlayers.map(p => p.name)
      expect(topNames).toContain('Christian McCaffrey')
      expect(topNames).toContain('Justin Jefferson')
    })

    it('should have rookies with appropriate ADP for 2025', () => {
      const rookies = season2025Players.filter(p => p.name.includes('Marvin') || p.name.includes('Malik') || p.name.includes('Rome'))
      rookies.forEach(rookie => {
        expect(rookie.adp).toBeGreaterThan(40)
        expect(rookie.adp).toBeLessThan(70)
      })
    })
  })

  describe('2025 Season Bye Week Analysis', () => {
    it('should have valid bye weeks for 2025 season', () => {
      season2025Players.forEach(player => {
        expect(player.byeWeek).toBeGreaterThan(0)
        expect(player.byeWeek).toBeLessThan(19)
      })
    })

    it('should have diverse bye week distribution for 2025', () => {
      const byeWeeks = season2025Players.map(p => p.byeWeek)
      const uniqueByeWeeks = new Set(byeWeeks)
      
      // Should have at least 8 different bye weeks
      expect(uniqueByeWeeks.size).toBeGreaterThan(7)
    })

    it('should identify bye week conflicts for 2025 season', () => {
      const week7Players = season2025Players.filter(p => p.byeWeek === 7)
      const week9Players = season2025Players.filter(p => p.byeWeek === 9)
      const week10Players = season2025Players.filter(p => p.byeWeek === 10)
      
      expect(week7Players.length).toBeGreaterThan(0)
      expect(week9Players.length).toBeGreaterThan(0)
      expect(week10Players.length).toBeGreaterThan(0)
    })
  })

  describe('2025 Season News and Updates', () => {
    it('should have appropriate news counts for 2025 season', () => {
      season2025Players.forEach(player => {
        expect(player.newsCount).toBeGreaterThanOrEqual(0)
        expect(player.newsCount).toBeLessThan(10)
      })
    })

    it('should have rookies with higher news counts for 2025', () => {
      const rookies = season2025Players.filter(p => p.name.includes('Marvin') || p.name.includes('Malik') || p.name.includes('Rome'))
      rookies.forEach(rookie => {
        expect(rookie.newsCount).toBeGreaterThan(4)
      })
    })

    it('should have established players with moderate news counts for 2025', () => {
      const established = season2025Players.filter(p => 
        p.name === 'Patrick Mahomes' || p.name === 'Christian McCaffrey' || p.name === 'Justin Jefferson'
      )
      established.forEach(player => {
        expect(player.newsCount).toBeGreaterThan(2)
        expect(player.newsCount).toBeLessThan(7)
      })
    })
  })

  describe('2025 Season Scoring Profile Validation', () => {
    it('should have valid 2025 scoring profiles', () => {
      expect(season2025ScoringProfiles).toHaveLength(3)
      
      season2025ScoringProfiles.forEach(profile => {
        expect(profile.id).toContain('2025')
        expect(profile.name).toContain('2025')
        expect(profile.rules.length).toBeGreaterThan(0)
      })
    })

    it('should have appropriate scoring rules for 2025 season', () => {
      const standardPPR = season2025ScoringProfiles.find(p => p.id === '2025-standard-ppr')
      expect(standardPPR).toBeDefined()
      expect(standardPPR!.rules).toHaveLength(8)
      
      const pprRule = standardPPR!.rules.find(r => r.stat_key === 'receptions')
      expect(pprRule).toBeDefined()
      expect(pprRule!.multiplier).toBe(1.0)
    })

    it('should have superflex scoring for 2025 season', () => {
      const superflex = season2025ScoringProfiles.find(p => p.id === '2025-superflex')
      expect(superflex).toBeDefined()
      expect(superflex!.rules).toHaveLength(9)
      
      const qbRushRule = superflex!.rules.find(r => r.stat_key === 'qb_rush_yards')
      expect(qbRushRule).toBeDefined()
      expect(qbRushRule!.multiplier).toBe(0.15)
    })
  })

  describe('2025 Season Projected Stats Validation', () => {
    it('should have realistic passing projections for 2025 QBs', () => {
      const qbs = season2025Players.filter(p => p.position === 'QB')
      qbs.forEach(qb => {
        const stats = qb.projectedStats
        expect(stats.passing_yards).toBeGreaterThan(3000)
        expect(stats.passing_yards).toBeLessThan(5500)
        expect(stats.passing_touchdowns).toBeGreaterThan(20)
        expect(stats.passing_touchdowns).toBeLessThan(45)
      })
    })

    it('should have realistic rushing projections for 2025 RBs', () => {
      const rbs = season2025Players.filter(p => p.position === 'RB')
      rbs.forEach(rb => {
        const stats = rb.projectedStats
        expect(stats.rushing_yards).toBeGreaterThan(800)
        expect(stats.rushing_yards).toBeLessThan(2000)
        expect(stats.rushing_touchdowns).toBeGreaterThan(6)
        expect(stats.rushing_touchdowns).toBeLessThan(20)
      })
    })

    it('should have realistic receiving projections for 2025 WRs', () => {
      const wrs = season2025Players.filter(p => p.position === 'WR')
      wrs.forEach(wr => {
        const stats = wr.projectedStats
        expect(stats.receiving_yards).toBeGreaterThan(600)
        expect(stats.receiving_yards).toBeLessThan(2000)
        expect(stats.receiving_touchdowns).toBeGreaterThan(3)
        expect(stats.receiving_touchdowns).toBeLessThan(15)
      })
    })
  })

  describe('2025 Season Breakout Candidates', () => {
    it('should identify potential breakout players for 2025', () => {
      const breakouts = season2025Players.filter(p => 
        p.name === 'Tank Bigsby' || p.name === 'Jaxon Smith-Njigba'
      )
      
      expect(breakouts).toHaveLength(2)
      breakouts.forEach(player => {
        expect(player.tier).toBe(3)
        expect(player.adp).toBeGreaterThan(70)
        expect(player.adp).toBeLessThan(90)
      })
    })

    it('should have rookies with breakout potential for 2025', () => {
      const rookies = season2025Players.filter(p => 
        p.name.includes('Marvin') || p.name.includes('Malik') || p.name.includes('Rome')
      )
      
      expect(rookies).toHaveLength(3)
      rookies.forEach(rookie => {
        expect(rookie.tier).toBeGreaterThanOrEqual(3)
        expect(rookie.tier).toBeLessThanOrEqual(4)
        expect(rookie.adp).toBeGreaterThan(40)
        expect(rookie.adp).toBeLessThan(70)
      })
    })
  })

  describe('2025 Season Team Distribution', () => {
    it('should have players from diverse teams for 2025', () => {
      const teams = season2025Players.map(p => p.team)
      const uniqueTeams = new Set(teams)
      
      // Should have players from at least 14 different teams
      expect(uniqueTeams.size).toBeGreaterThanOrEqual(14)
    })

    it('should have multiple players from powerhouse teams for 2025', () => {
      const kcPlayers = season2025Players.filter(p => p.team === 'KC')
      const sfPlayers = season2025Players.filter(p => p.team === 'SF')
      const phiPlayers = season2025Players.filter(p => p.team === 'PHI')
      
      expect(kcPlayers.length).toBeGreaterThan(0)
      expect(sfPlayers.length).toBeGreaterThan(0)
      expect(phiPlayers.length).toBeGreaterThan(0)
    })
  })
})
