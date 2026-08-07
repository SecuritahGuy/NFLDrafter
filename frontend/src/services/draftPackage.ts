import type { Player } from '../types'
import type { DraftConfig, RosterSlotDefinition } from './draftEngine'

export const DRAFT_PACKAGE_SCHEMA = 'nfldrafter.draft-package' as const
export const DRAFT_PACKAGE_VERSION = 1 as const
export const DRAFT_PACKAGE_STORAGE_KEY = 'nfldrafter.draft-package.v1'

export interface PreparedScoringProfile {
  profileId: string
  name: string
  rules: Array<{
    statKey: string
    multiplier: number
    per?: number | null
  }>
}

export interface DraftPackagePayloadV1 {
  schema: typeof DRAFT_PACKAGE_SCHEMA
  version: typeof DRAFT_PACKAGE_VERSION
  generatedAt: string
  season: number
  scoringProfile: PreparedScoringProfile
  league: DraftConfig
  rosterSlots: RosterSlotDefinition[]
  players: Player[]
}

export interface DraftPackageV1 extends DraftPackagePayloadV1 {
  checksum: string
}

const checksumPayload = (payload: DraftPackagePayloadV1): string => {
  const input = JSON.stringify(payload)
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`
}

export const createDraftPackage = (
  input: Omit<DraftPackagePayloadV1, 'schema' | 'version' | 'generatedAt'> & { generatedAt?: string },
): DraftPackageV1 => {
  const payload: DraftPackagePayloadV1 = {
    schema: DRAFT_PACKAGE_SCHEMA,
    version: DRAFT_PACKAGE_VERSION,
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    season: input.season,
    scoringProfile: input.scoringProfile,
    league: input.league,
    rosterSlots: input.rosterSlots,
    players: input.players,
  }
  return { ...payload, checksum: checksumPayload(payload) }
}

export const serializeDraftPackage = (draftPackage: DraftPackageV1): string =>
  JSON.stringify(draftPackage, null, 2)

export const parseDraftPackage = (value: string): DraftPackageV1 => {
  const parsed = JSON.parse(value) as Partial<DraftPackageV1>
  if (parsed.schema !== DRAFT_PACKAGE_SCHEMA || parsed.version !== DRAFT_PACKAGE_VERSION) {
    throw new Error('Unsupported NFLDrafter package schema or version')
  }
  if (!Array.isArray(parsed.players) || !parsed.players.length) {
    throw new Error('Draft package does not contain any players')
  }
  if (!parsed.league || parsed.league.leagueSize < 2 || parsed.league.rounds < 1) {
    throw new Error('Draft package has invalid league settings')
  }
  const { checksum, ...payload } = parsed as DraftPackageV1
  if (checksum !== checksumPayload(payload)) {
    throw new Error('Draft package checksum does not match its contents')
  }
  return parsed as DraftPackageV1
}

export const saveDraftPackage = (draftPackage: DraftPackageV1): void => {
  window.localStorage.setItem(DRAFT_PACKAGE_STORAGE_KEY, serializeDraftPackage(draftPackage))
}

export const loadDraftPackage = (): DraftPackageV1 | null => {
  try {
    const stored = window.localStorage.getItem(DRAFT_PACKAGE_STORAGE_KEY)
    return stored ? parseDraftPackage(stored) : null
  } catch {
    return null
  }
}
