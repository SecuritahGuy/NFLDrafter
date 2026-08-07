import type { RankingRow } from '../api'
import type { DraftConfidence, PlayerAvailability } from '../types'

const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length

const standardDeviation = (values: number[]) => {
  if (values.length < 2) return null
  const average = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - average) ** 2)))
}

export const buildDraftConfidence = (
  fantasyPros?: RankingRow,
  espn?: RankingRow,
  ffc?: RankingRow,
): DraftConfidence => {
  const sourceRanks = [fantasyPros?.ecr, espn?.rank, ffc?.ecr]
    .filter((value): value is number => value != null && value > 0)
  const sourceSpread = sourceRanks.length > 1 ? Math.max(...sourceRanks) - Math.min(...sourceRanks) : null
  const sourceDeviation = standardDeviation(sourceRanks)
  const expertRange = fantasyPros?.best != null && fantasyPros.worst != null
    ? { best: fantasyPros.best, worst: fantasyPros.worst, spread: Math.abs(fantasyPros.worst - fantasyPros.best) }
    : null
  const marketRange = ffc?.best != null && ffc.worst != null
    ? { best: ffc.best, worst: ffc.worst, spread: Math.abs(ffc.worst - ffc.best) }
    : null

  let score = sourceRanks.length === 3 ? 45 : sourceRanks.length === 2 ? 30 : sourceRanks.length === 1 ? 15 : 0
  if (sourceDeviation != null) score += sourceDeviation <= 6 ? 30 : sourceDeviation <= 14 ? 20 : sourceDeviation <= 25 ? 10 : 0
  if (expertRange) score += expertRange.spread <= 12 ? 25 : expertRange.spread <= 24 ? 15 : 5
  score = Math.min(100, score)

  const level: DraftConfidence['level'] = sourceRanks.length <= 1
    ? 'limited'
    : score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low'
  const evidence = [
    `${sourceRanks.length} ranking source${sourceRanks.length === 1 ? '' : 's'}`,
    sourceSpread != null ? `${Math.round(sourceSpread)}-pick disagreement` : null,
    expertRange ? `expert range ${Math.round(expertRange.best)}–${Math.round(expertRange.worst)}` : null,
  ].filter(Boolean).join(' · ')

  return {
    level,
    score,
    sourceCount: sourceRanks.length,
    sourceSpread,
    sourceDeviation,
    expertRange,
    marketRange,
    marketAdpDeviation: ffc?.sd ?? null,
    rankMovement: fantasyPros?.rank_delta ?? espn?.rank_delta ?? ffc?.rank_delta ?? null,
    evidence: evidence || 'No current ranking evidence',
  }
}

// Abramowitz-Stegun approximation; sufficient for a directional ADP model.
const normalCdf = (value: number) => {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value) / Math.sqrt(2)
  const t = 1 / (1 + 0.3275911 * x)
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x))
  return 0.5 * (1 + erf)
}

export const estimateAvailability = (
  adp: number | null | undefined,
  adpDeviation: number | null | undefined,
  targetPick: number | null,
): PlayerAvailability | null => {
  if (!adp || adp <= 0 || !targetPick || targetPick <= 0) return null
  const hasProviderDeviation = adpDeviation != null && adpDeviation > 0
  const deviation = hasProviderDeviation ? adpDeviation : Math.max(5, adp * 0.14)
  const probability = Math.max(0, Math.min(1, 1 - normalCdf((targetPick + 0.5 - adp) / deviation)))
  const label: PlayerAvailability['label'] = probability >= 0.7
    ? 'likely' : probability >= 0.35 ? 'coin_flip' : 'unlikely'
  return {
    targetPick,
    probability,
    label,
    basis: hasProviderDeviation ? 'ffc_distribution' : 'modeled_spread',
  }
}
