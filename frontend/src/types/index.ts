export interface Player {
  id: string
  name: string
  position: string
  team: string
  fantasyPoints: number
  yahooPoints: number
  delta: number
  vorp: number
  tier: number
  adp: number
  newsCount: number
  byeWeek: number
  rank?: number
  notes?: string
}

export interface PlayerNews {
  id: string
  title: string
  summary: string
  url: string
  publishedAt: string
  source: string
}

export interface WeeklyStats {
  week: number
  fantasyPoints: number
  yahooPoints: number
  passingYards?: number
  passingTDs?: number
  interceptions?: number
  rushingYards?: number
  rushingTDs?: number
  receivingYards?: number
  receivingTDs?: number
  receptions?: number
  fumbles?: number
  touchdowns?: number // For backward compatibility
}

export interface DepthChartPosition {
  position: string
  depth: number
  player: string
  team: string
  rank?: number // For backward compatibility
  playerName?: string // For backward compatibility
  status?: 'starter' | 'backup' | 'practice_squad' | 'injured' // For backward compatibility
}

export interface ADPData {
  name: string
  adp: number
  position: string
  team?: string
}
