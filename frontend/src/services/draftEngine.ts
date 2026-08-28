import type { Player, PlayerAvailability } from '../types'
import { estimateAvailability } from './draftConfidence'

export interface DraftConfig {
  leagueSize: number
  draftSlot: number
  rounds: number
  /** Optional provider-imported labels, keyed by snake-order slot. */
  teamNames?: Record<number, string>
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

export const teamLabel = (team: number, config: DraftConfig): string =>
  config.teamNames?.[team] || `Team ${team}`

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
  take('SUPERFLEX', ['QB', 'RB', 'WR', 'TE'])
  take('SF', ['QB', 'RB', 'WR', 'TE'])
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
  availability: PlayerAvailability | null
  news?: DraftNewsSignal
}

export interface DraftNewsSignal {
  adjustment: number
  positive: number
  risk: number
  headlines: Array<{ title: string; url: string; source: string; topics: string[] }>
}

export interface OpeningDraftPlan {
  label: string
  targets: string[]
  rationale: string
}

export const openingDraftPlan = (
  picks: DraftPick[],
  players: Player[],
  config: DraftConfig,
): OpeningDraftPlan => {
  const playersById = new Map(players.map((player) => [player.id, player]))
  const myPositions = picks
    .filter((pick) => pick.isMine)
    .map((pick) => playersById.get(pick.playerId)?.position)
    .filter((position): position is string => Boolean(position))
  const turn = config.draftSlot === 1
    ? `${config.leagueSize * 2} / ${config.leagueSize * 2 + 1}`
    : 'your next turn'
  if (!myPositions.length) return {
    label: 'Opening principle: elite value first',
    targets: ['RB or WR'],
    rationale: `At slot ${config.draftSlot}, take the last player in a true top tier; position rules begin after that pick.`,
  }
  if (myPositions[0] === 'RB' && myPositions.length === 1) return {
    label: 'RB start: WR/WR is the default, not a lock',
    targets: ['WR', 'WR'],
    rationale: `At picks ${turn}, build receiving volume before the long wait. Break the plan only for a clear tier faller at RB, TE, or an elite-value QB.`,
  }
  if (myPositions[0] === 'WR' && myPositions.length === 1) return {
    label: 'WR start: secure one RB at the turn',
    targets: ['RB', 'WR or RB'],
    rationale: `At picks ${turn}, leave the turn with at least one starting RB while preserving access to an elite second receiver.`,
  }
  const counts = myPositions.reduce<Record<string, number>>((result, position) => {
    result[position] = (result[position] ?? 0) + 1
    return result
  }, {})
  if ((counts.RB ?? 0) >= 2 && !(counts.WR ?? 0)) return {
    label: 'Correct the roster toward receivers', targets: ['WR', 'WR'],
    rationale: 'Two early backs create weekly stability, but the next priority is target volume before the WR tiers flatten.',
  }
  if ((counts.RB ?? 0) >= 1 && (counts.WR ?? 0) >= 1) return {
    label: 'Balanced start: follow the tier break', targets: ['WR or RB', 'TE or QB value'],
    rationale: 'With both core positions started, draft the strongest scarcity/value signal instead of forcing a preset sequence.',
  }
  return { label: 'Receiver-heavy start: watch RB scarcity', targets: ['RB', 'RB or WR'], rationale: 'Do not chase an RB solely for balance, but compare the last starter-tier backs against the next WR tier.' }
}

export const recommendPlayers = (
  available: Player[],
  myPicks: DraftPick[],
  allPlayers: Player[],
  currentPick: number,
  nextUserPick: number | null,
  limit = 5,
  newsSignals: Record<string, DraftNewsSignal> = {},
): Recommendation[] => {
  const counts = rosterPositionCounts(myPicks, allPlayers)
  const picksUntilTurn = nextUserPick === null ? 0 : Math.max(0, nextUserPick - currentPick)

  return available
    .map((player) => {
      const availability = estimateAvailability(
        player.adp,
        player.draftConfidence?.marketAdpDeviation,
        nextUserPick,
      )
      const adpUrgency = availability
        ? (1 - availability.probability) * Math.min(14, Math.max(5, picksUntilTurn * 0.7))
        : player.adp > 0
          ? Math.max(0, picksUntilTurn - Math.max(0, player.adp - currentPick)) * 0.35
          : 0
      const tierDropoff = player.tier > 0 ? Math.max(0, 6 - player.tier) * 2 : 0
      const need = rosterNeed(player.position, counts)
      const sourceRankValue = player.rank
        ? Math.max(0, 250 - player.rank) * 0.08
        : 0
      const news = newsSignals[player.id]
      const newsAdjustment = Math.max(-6, Math.min(6, news?.adjustment ?? 0))
      const score = player.vorp + tierDropoff + adpUrgency + need + sourceRankValue + player.fantasyPoints * 0.01 + newsAdjustment
      const reasons = [
        player.rank ? `multi-source draft rank #${player.rank}` : null,
        player.vorp > 0 ? `${player.vorp.toFixed(1)} VORP` : null,
        newsAdjustment >= 1.5 ? 'recent opportunity news supports the role' : null,
        newsAdjustment <= -1.5 ? 'recent news adds role or injury risk' : null,
        need > 0 ? `fills a ${player.position} roster need` : null,
        adpUrgency > 2 ? 'unlikely to reach your next pick' : null,
        player.draftConfidence?.level === 'high' ? 'high-confidence rank' : null,
        tierDropoff >= 6 ? `Tier ${player.tier} scarcity` : null,
      ].filter(Boolean)
      return {
        player,
        score,
        reason: reasons.slice(0, 3).join(' and ') || 'best available projection',
        availability,
        news,
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
