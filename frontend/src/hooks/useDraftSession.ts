import { useCallback, useEffect, useState } from 'react'
import {
  addDraftPick,
  createDraftSession,
  removeDraftPick,
  replaceDraftPicks,
  updateDraftConfig,
  type DraftConfig,
  type DraftPick,
  type DraftSession,
} from '../services/draftEngine'

const STORAGE_KEY = 'nfldrafter.manual-draft.v1'

const loadSession = (): DraftSession => {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (!stored) return createDraftSession()
    const parsed = JSON.parse(stored) as DraftSession
    if (parsed.version !== 1 || !Array.isArray(parsed.picks)) return createDraftSession()
    return parsed
  } catch {
    return createDraftSession()
  }
}

export const useDraftSession = () => {
  const [session, setSession] = useState<DraftSession>(loadSession)

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  }, [session])

  const draftPlayer = useCallback((playerId: string, isMine: boolean) => {
    setSession((current) => addDraftPick(current, playerId, isMine))
  }, [])

  const undo = useCallback(() => {
    setSession((current) => current.picks.length
      ? removeDraftPick(current, current.picks[current.picks.length - 1].pick)
      : current)
  }, [])

  const removePick = useCallback((pickNumber: number) => {
    setSession((current) => removeDraftPick(current, pickNumber))
  }, [])

  const syncDraftPicks = useCallback((picks: DraftPick[]) => {
    setSession((current) => replaceDraftPicks(current, picks))
  }, [])

  const configure = useCallback((config: DraftConfig) => {
    setSession((current) => updateDraftConfig(current, config))
  }, [])

  const reset = useCallback(() => setSession(createDraftSession(session.config)), [session.config])

  return { session, draftPlayer, undo, removePick, syncDraftPicks, configure, reset }
}
