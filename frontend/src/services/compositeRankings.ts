import type { BackendPlayer, RankingRow } from '../api'
import type { DraftConfidence } from '../types'
import { buildDraftConfidence } from './draftConfidence'

export interface CompositeRanking {
  rank?: number
  score?: number
  fantasyPros?: RankingRow
  espn?: RankingRow
  ffc?: RankingRow
  sourceCount: number
  confidence: DraftConfidence
}

export function buildCompositeRankings(
  players: BackendPlayer[],
  fantasyProsRows: RankingRow[] = [],
  espnRows: RankingRow[] = [],
  ffcRows: RankingRow[] = [],
): Map<string, CompositeRanking> {
  // Keep this utility safe when cached or third-party API data does not match
  // the expected list contract. The API client normalizes known wrappers.
  if (!Array.isArray(players)) return new Map()

  const toMap = (rows: RankingRow[]) => new Map(
    rows.filter((row) => row.player_id).map((row) => [row.player_id as string, row]),
  )
  const fantasyPros = toMap(fantasyProsRows)
  const espn = toMap(espnRows)
  const ffc = toMap(ffcRows)

  const ranked = players.flatMap((player) => {
    const fp = fantasyPros.get(player.player_id)
    const espnRow = espn.get(player.player_id)
    const ffcRow = ffc.get(player.player_id)
    const values: Array<readonly [number, number]> = []
    if (fp?.ecr != null) values.push([fp.ecr, 0.5])
    if (ffcRow?.ecr != null) values.push([ffcRow.ecr, 0.3])
    if (espnRow?.rank != null) values.push([espnRow.rank, 0.2])
    if (!values.length) return []
    const weight = values.reduce((sum, [, itemWeight]) => sum + itemWeight, 0)
    const rawScore = values.reduce((sum, [value, itemWeight]) => sum + value * itemWeight, 0) / weight
    const sourceCount = values.length
    return [{
      playerId: player.player_id,
      score: rawScore + (3 - sourceCount) * 7.5,
      sourceCount,
      fantasyPros: fp,
      espn: espnRow,
      ffc: ffcRow,
      confidence: buildDraftConfidence(fp, espnRow, ffcRow),
    }]
  })

  ranked.sort((a, b) => a.score - b.score || b.sourceCount - a.sourceCount || a.playerId.localeCompare(b.playerId))
  return new Map(ranked.map((item, index) => [item.playerId, {
    rank: index + 1,
    score: item.score,
    sourceCount: item.sourceCount,
    fantasyPros: item.fantasyPros,
    espn: item.espn,
    ffc: item.ffc,
    confidence: item.confidence,
  }]))
}
