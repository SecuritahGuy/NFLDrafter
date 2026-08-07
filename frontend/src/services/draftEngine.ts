import type { Player } from '../types'

export interface DraftConfig {
  leagueSize: number
  draftSlot: number
  rounds: number
}

export interface DraftPick {
  pick: number
  playerId: string
  team: number
  isMine: boolean
  madeAt: string
}

export interface DraftSession {
  version: 1
  config: DraftConfig
  picks: DraftPick[]
}

export const DEFAULT_DRAFT_CONFIG: DraftConfig = {
  leagueSize: 12,
  draftSlot: 1,
  rounds: 15,
}

export const createDraftSession = (
  config: DraftConfig = DEFAULT_DRAFT_CONFIG,
): DraftSession => ({ version: 1, config, picks: [] })

export const teamForPick = (pick: number, leagueSize: number): number => {
  if (pick < 1 || leagueSize < 2) return 1
  const round = Math.floor((pick - 1) / leagueSize)
  const positionInRound = (pick - 1) % leagueSize
  return round % 2 === 0 ? positionInRound + 1 : leagueSize - positionInRound
}

export const nextPickForTeam = (
  afterPick: number,
  team: number,
  leagueSize: number,
  rounds: number,
): number | null => {
  const finalPick = leagueSize * rounds
  for (let pick = Math.max(1, afterPick + 1); pick <= finalPick; pick += 1) {
    if (teamForPick(pick, leagueSize) === team) return pick
  }
  return null
}

export const addDraftPick = (
  session: DraftSession,
  playerId: string,
  isMine: boolean,
  madeAt = new Date().toISOString(),
): DraftSession => {
  if (session.picks.some((pick) => pick.playerId === playerId)) return session
  const pick = session.picks.length + 1
  return {
    ...session,
    picks: [
      ...session.picks,
      {
        pick,
        playerId,
        team: isMine ? session.config.draftSlot : teamForPick(pick, session.config.leagueSize),
        isMine,
        madeAt,
      },
    ],
  }
}

export const removeDraftPick = (session: DraftSession, pickNumber: number): DraftSession => ({
  ...session,
  picks: session.picks
    .filter((pick) => pick.pick !== pickNumber)
    .map((pick, index) => ({
      ...pick,
      pick: index + 1,
      team: pick.isMine
        ? session.config.draftSlot
        : teamForPick(index + 1, session.config.leagueSize),
    })),
})

export const updateDraftConfig = (
  session: DraftSession,
  config: DraftConfig,
): DraftSession => ({
  ...session,
  config,
  picks: session.picks.map((pick) => ({
    ...pick,
    team: pick.isMine ? config.draftSlot : teamForPick(pick.pick, config.leagueSize),
  })),
})

export const rosterPositionCounts = (
  picks: DraftPick[],
  players: Player[],
): Record<string, number> => {
  const playersById = new Map(players.map((player) => [player.id, player]))
  return picks.filter((pick) => pick.isMine).reduce<Record<string, number>>((counts, pick) => {
    const position = playersById.get(pick.playerId)?.position
    if (position) counts[position] = (counts[position] ?? 0) + 1
    return counts
  }, {})
}

export interface RosterSlotDefinition {
  position: string
  required: number
}

export const assignRosterSlots = (
  players: Player[],
  slots: RosterSlotDefinition[],
): Record<string, Player[]> => {
  const assignments = Object.fromEntries(slots.map((slot) => [slot.position, [] as Player[]]))
  const remaining = [...players]
  const take = (position: string, accepted: string[]) => {
    const slot = slots.find((item) => item.position === position)
    if (!slot) return
    while (assignments[position].length < slot.required) {
      const index = remaining.findIndex((player) => accepted.includes(player.position))
      if (index < 0) break
      assignments[position].push(remaining.splice(index, 1)[0])
    }
  }

  for (const position of ['QB', 'RB', 'WR', 'TE', 'K']) take(position, [position])
  take('DEF', ['DEF', 'DST'])
  take('DST', ['DEF', 'DST'])
  take('FLEX', ['RB', 'WR', 'TE'])
  if (assignments.BN) assignments.BN.push(...remaining.slice(0, slots.find((slot) => slot.position === 'BN')?.required ?? 0))
  return assignments
}

const rosterNeed = (position: string, counts: Record<string, number>): number => {
  const targets: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1, DST: 1 }
  const target = targets[position] ?? 0
  return Math.max(0, target - (counts[position] ?? 0)) * 8
}

export interface Recommendation {
  player: Player
  score: number
  reason: string
}

export const recommendPlayers = (
  available: Player[],
  myPicks: DraftPick[],
  allPlayers: Player[],
  currentPick: number,
  nextUserPick: number | null,
  limit = 5,
): Recommendation[] => {
  const counts = rosterPositionCounts(myPicks, allPlayers)
  const picksUntilTurn = nextUserPick === null ? 0 : Math.max(0, nextUserPick - currentPick)

  return available
    .map((player) => {
      const adpUrgency = player.adp > 0
        ? Math.max(0, picksUntilTurn - Math.max(0, player.adp - currentPick)) * 0.35
        : 0
      const tierDropoff = player.tier > 0 ? Math.max(0, 6 - player.tier) * 2 : 0
      const need = rosterNeed(player.position, counts)
      const sourceRankValue = player.rank
        ? Math.max(0, 250 - player.rank) * 0.08
        : 0
      const score = player.vorp + tierDropoff + adpUrgency + need + sourceRankValue + player.fantasyPoints * 0.01
      const reasons = [
        player.rank ? `multi-source draft rank #${player.rank}` : null,
        player.vorp > 0 ? `${player.vorp.toFixed(1)} VORP` : null,
        need > 0 ? `fills a ${player.position} roster need` : null,
        adpUrgency > 2 ? 'unlikely to reach your next pick' : null,
        tierDropoff >= 6 ? `Tier ${player.tier} scarcity` : null,
      ].filter(Boolean)
      return {
        player,
        score,
        reason: reasons.slice(0, 2).join(' and ') || 'best available projection',
      }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export const sessionToCsv = (session: DraftSession, players: Player[]): string => {
  const playersById = new Map(players.map((player) => [player.id, player]))
  const rows = session.picks.map((pick) => {
    const player = playersById.get(pick.playerId)
    const values = [pick.pick, pick.team, pick.isMine ? 'Me' : 'Opponent', player?.name ?? pick.playerId, player?.position ?? '', player?.team ?? '']
    return values.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')
  })
  return ['"Pick","Team","Drafted By","Player","Position","NFL Team"', ...rows].join('\n')
}
