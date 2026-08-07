import React, { useMemo, useRef, useState } from 'react'
import type { Player } from '../types'
import {
  nextPickForTeam,
  recommendPlayers,
  sessionToCsv,
  teamForPick,
  type DraftConfig,
  type DraftSession,
} from '../services/draftEngine'
import {
  parseDraftPackage,
  serializeDraftPackage,
  type DraftPackageV1,
} from '../services/draftPackage'
import { DraftConfidenceBadge } from './DraftConfidenceBadge'

interface ManualDraftConsoleProps {
  session: DraftSession
  players: Player[]
  availablePlayers: Player[]
  onConfigure: (config: DraftConfig) => void
  onUndo: () => void
  onRemovePick: (pick: number) => void
  onReset: () => void
  onDraftPlayer?: (playerId: string, isMine: boolean) => void
  draftPackage?: DraftPackageV1 | null
  onImportPackage?: (draftPackage: DraftPackageV1) => void
  onPackageError?: (message: string) => void
}

export const ManualDraftConsole: React.FC<ManualDraftConsoleProps> = ({
  session,
  players,
  availablePlayers,
  onConfigure,
  onUndo,
  onRemovePick,
  onReset,
  onDraftPlayer,
  draftPackage,
  onImportPackage,
  onPackageError,
}) => {
  const currentPick = session.picks.length + 1
  const currentTeam = teamForPick(currentPick, session.config.leagueSize)
  const nextUserPick = currentTeam === session.config.draftSlot
    ? currentPick
    : nextPickForTeam(currentPick - 1, session.config.draftSlot, session.config.leagueSize, session.config.rounds)
  const recommendationTargetPick = currentTeam === session.config.draftSlot
    ? nextPickForTeam(currentPick, session.config.draftSlot, session.config.leagueSize, session.config.rounds)
    : nextUserPick
  const recommendations = useMemo(
    () => recommendPlayers(availablePlayers, session.picks, players, currentPick, recommendationTargetPick, 5),
    [availablePlayers, currentPick, recommendationTargetPick, players, session.picks],
  )
  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])
  const [draftSearch, setDraftSearch] = useState('')
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'mine'>('all')
  const [confirmReset, setConfirmReset] = useState(false)
  const quickSearchRef = useRef<HTMLInputElement>(null)
  const totalPicks = session.config.leagueSize * session.config.rounds
  const draftComplete = currentPick > totalPicks
  const currentRound = Math.min(session.config.rounds, Math.ceil(currentPick / session.config.leagueSize))
  const pickInRound = ((Math.max(currentPick, 1) - 1) % session.config.leagueSize) + 1
  const isMyTurn = !draftComplete && currentTeam === session.config.draftSlot
  const picksUntilMine = nextUserPick == null ? null : Math.max(0, nextUserPick - currentPick)
  const lastPick = session.picks[session.picks.length - 1]
  const lastPlayer = lastPick ? playersById.get(lastPick.playerId) : null
  const quickResults = useMemo(() => {
    const query = draftSearch.trim().toLowerCase()
    const matches = query ? availablePlayers.filter((player) =>
      player.name.toLowerCase().includes(query)
      || player.team.toLowerCase().includes(query)
      || player.position.toLowerCase().includes(query)
    ) : availablePlayers
    const draftOrder = (player: Player) => {
      if (player.rank != null && player.rank > 0) return player.rank
      if (player.adp != null && player.adp > 0) return player.adp
      return Number.MAX_SAFE_INTEGER
    }
    return [...matches].sort((a, b) => draftOrder(a) - draftOrder(b)).slice(0, query ? 8 : 6)
  }, [availablePlayers, draftSearch])
  const ledgerPicks = useMemo(() => {
    const query = ledgerSearch.trim().toLowerCase()
    return [...session.picks].reverse().filter((pick) => {
      if (ledgerFilter === 'mine' && !pick.isMine) return false
      if (!query) return true
      const player = playersById.get(pick.playerId)
      return `${player?.name ?? pick.playerId} ${player?.position ?? ''} ${player?.team ?? ''} team ${pick.team}`
        .toLowerCase().includes(query)
    })
  }, [ledgerFilter, ledgerSearch, playersById, session.picks])

  const recordPlayer = (player: Player) => {
    if (!onDraftPlayer || draftComplete) return
    onDraftPlayer(player.id, isMyTurn)
    setDraftSearch('')
    quickSearchRef.current?.focus()
  }

  const exportDraft = () => {
    const blob = new Blob([sessionToCsv(session, players)], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'nfldrafter-draft.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const exportPackage = () => {
    if (!draftPackage) return
    const blob = new Blob([serializeDraftPackage(draftPackage)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nfldrafter-${draftPackage.season}-${draftPackage.scoringProfile.name.replaceAll(' ', '-').toLowerCase()}.json`
    link.click()
    URL.revokeObjectURL(url)
  }

  const importPackage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !onImportPackage) return
    try {
      onImportPackage(parseDraftPackage(await file.text()))
    } catch (error) {
      onPackageError?.(error instanceof Error ? error.message : 'Unable to load draft package')
    } finally {
      event.target.value = ''
    }
  }

  return (
    <section aria-labelledby="manual-draft-heading" className="mb-6 overflow-hidden rounded-2xl border border-blue-400/30 bg-slate-950/90 text-white shadow-2xl shadow-slate-950/30">
      <div className={`border-b px-4 py-3 ${isMyTurn ? 'border-emerald-400/40 bg-emerald-500/15' : 'border-blue-400/30 bg-blue-500/10'}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-black ${isMyTurn ? 'bg-emerald-400 text-emerald-950' : 'bg-blue-500 text-white'}`}>{draftComplete ? '✓' : currentPick}</div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{draftComplete ? 'Draft complete' : 'On the clock'}</div>
              <div className="text-lg font-black">{draftComplete ? `${session.picks.length} picks recorded` : `${isMyTurn ? 'Your team' : `Team ${currentTeam}`} · Round ${currentRound}, pick ${pickInRound}`}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <div className="rounded-lg bg-slate-900/70 px-3 py-2"><span className="text-slate-400">Off board</span><strong className="ml-2 text-white">{session.picks.length}</strong></div>
            <div className="rounded-lg bg-slate-900/70 px-3 py-2"><span className="text-slate-400">Available</span><strong className="ml-2 text-white">{availablePlayers.length}</strong></div>
            <div className="rounded-lg bg-slate-900/70 px-3 py-2"><span className="text-slate-400">Your next</span><strong className="ml-2 text-white">{nextUserPick ?? '—'}{picksUntilMine != null && picksUntilMine > 0 ? ` (${picksUntilMine} away)` : ''}</strong></div>
          </div>
        </div>
      </div>

      <div className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="manual-draft-heading" className="text-xl font-bold">Manual draft tracker</h2>
          <p className="mt-1 text-sm text-slate-300">Search, click once, and the snake order assigns the pick automatically. Everything persists locally.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded-lg bg-amber-400 px-3 py-2 text-sm font-bold text-amber-950 disabled:opacity-40" onClick={onUndo} disabled={!session.picks.length}>Undo{lastPlayer ? ` ${lastPlayer.name}` : ''}</button>
          <button type="button" className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40" onClick={exportDraft} disabled={!session.picks.length}>Export picks</button>
          <button type="button" className="rounded bg-blue-700 px-3 py-2 text-sm disabled:opacity-40" onClick={exportPackage} disabled={!draftPackage}>Export package</button>
          <label className="cursor-pointer rounded bg-slate-700 px-3 py-2 text-sm">
            Import package
            <input aria-label="Import draft package" type="file" accept="application/json,.json" className="sr-only" onChange={importPackage} />
          </label>
          {confirmReset ? <div className="flex items-center gap-1 rounded-lg bg-rose-950 p-1"><span className="px-2 text-xs text-rose-200">Clear every pick?</span><button type="button" className="rounded bg-rose-600 px-2 py-1 text-xs font-bold" onClick={() => { onReset(); setConfirmReset(false) }}>Confirm</button><button type="button" className="rounded px-2 py-1 text-xs" onClick={() => setConfirmReset(false)}>Cancel</button></div> : <button type="button" className="rounded bg-red-800 px-3 py-2 text-sm" onClick={() => setConfirmReset(true)}>Reset</button>}
        </div>
      </div>

      {draftPackage && (
        <p className="mt-2 text-xs text-emerald-300">
          Offline package ready · {draftPackage.players.length} players · {draftPackage.checksum}
        </p>
      )}

      <details className="mt-3 rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2">
        <summary className="cursor-pointer text-xs font-bold uppercase tracking-wide text-slate-300">Draft setup · {session.config.leagueSize} teams · slot {session.config.draftSlot} · {session.config.rounds} rounds</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <label className="text-xs text-slate-300">Teams
          <input aria-label="League size" type="number" min={2} max={20} value={session.config.leagueSize} onChange={(event) => onConfigure({ ...session.config, leagueSize: Number(event.target.value), draftSlot: Math.min(session.config.draftSlot, Number(event.target.value)) })} className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-white" />
        </label>
        <label className="text-xs text-slate-300">My slot
          <input aria-label="Draft slot" type="number" min={1} max={session.config.leagueSize} value={session.config.draftSlot} onChange={(event) => onConfigure({ ...session.config, draftSlot: Number(event.target.value) })} className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-white" />
        </label>
        <label className="text-xs text-slate-300">Rounds
          <input aria-label="Draft rounds" type="number" min={1} max={30} value={session.config.rounds} onChange={(event) => onConfigure({ ...session.config, rounds: Number(event.target.value) })} className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-white" />
        </label>
        </div>
      </details>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-xl border border-blue-400/30 bg-slate-900/80 p-3">
          <label htmlFor="draft-quick-search" className="text-xs font-bold uppercase tracking-[0.16em] text-blue-200">Record the next pick</label>
          <div className="mt-2 flex gap-2">
            <input ref={quickSearchRef} id="draft-quick-search" value={draftSearch} onChange={(event) => setDraftSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && quickResults[0]) recordPlayer(quickResults[0]) }} placeholder="Type a player, team, or position…" className="min-w-0 flex-1 rounded-xl border border-slate-600 bg-slate-950 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 focus:border-blue-400 focus:ring-2 focus:ring-blue-400/20" disabled={draftComplete} />
            {draftSearch && <button type="button" className="rounded-xl bg-slate-700 px-3 text-sm" onClick={() => setDraftSearch('')}>Clear</button>}
          </div>
          <div className="mt-2 max-h-64 space-y-1 overflow-auto">
            {quickResults.map((player, index) => <button key={player.id} type="button" onClick={() => recordPlayer(player)} className="grid w-full grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-lg border border-transparent px-3 py-2 text-left hover:border-blue-400/40 hover:bg-blue-500/10" disabled={draftComplete}>
              <span className="text-center text-xs font-black text-slate-500">{index + 1}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-bold text-white">{player.name}</span><span className="text-xs text-slate-400">{player.position} · {player.team} · {player.rank ? `#${player.rank}` : 'unranked'}</span></span>
              <span className={`rounded-lg px-3 py-1.5 text-xs font-black ${isMyTurn ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-700 text-white'}`}>{isMyTurn ? 'Draft to me' : `Taken · T${currentTeam}`}</span>
            </button>)}
            {!quickResults.length && <div className="rounded-lg border border-dashed border-slate-700 p-4 text-center text-sm text-slate-400">No available player matches that search.</div>}
          </div>
        </div>

        <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
          <div className="flex items-center justify-between gap-2"><h3 className="text-xs font-bold uppercase tracking-[0.16em] text-slate-300">Recommended now</h3><span className="text-[10px] text-slate-500">for pick {currentPick}</span></div>
          <ol className="mt-2 space-y-1">
            {recommendations.slice(0, 5).map(({ player, score, reason, availability }, index) => (
              <li key={player.id} className="flex items-center gap-2 rounded-lg bg-slate-950/70 px-3 py-2 text-sm">
                <span className="w-5 text-xs font-black text-violet-300">{index + 1}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 truncate font-semibold"><span className="truncate">{player.name} · {player.position}</span><DraftConfidenceBadge confidence={player.draftConfidence} compact /></span><span className="block truncate text-[10px] text-slate-400">{reason}</span></span>{availability && <span title={`${Math.round(availability.probability * 100)}% directional chance of lasting to pick ${availability.targetPick} · ${availability.basis === 'ffc_distribution' ? 'FFC ADP distribution' : 'modeled ADP spread'}`} className={`whitespace-nowrap rounded-md px-2 py-1 text-[10px] font-black ${availability.label === 'likely' ? 'bg-emerald-500/20 text-emerald-300' : availability.label === 'coin_flip' ? 'bg-amber-500/20 text-amber-300' : 'bg-rose-500/20 text-rose-300'}`}>{availability.label === 'likely' ? 'Likely back' : availability.label === 'coin_flip' ? 'Coin flip' : 'Take now'}</span>}<span className="text-xs font-bold text-slate-400">{score.toFixed(1)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div><h3 className="text-sm font-bold text-white">Draft ledger</h3><p className="text-xs text-slate-400">Every player off the board · newest first</p></div>
          <div className="flex gap-2"><button type="button" className={`rounded-lg px-3 py-1.5 text-xs font-bold ${ledgerFilter === 'all' ? 'bg-blue-500 text-white' : 'bg-slate-800 text-slate-300'}`} onClick={() => setLedgerFilter('all')}>All ({session.picks.length})</button><button type="button" className={`rounded-lg px-3 py-1.5 text-xs font-bold ${ledgerFilter === 'mine' ? 'bg-emerald-500 text-emerald-950' : 'bg-slate-800 text-slate-300'}`} onClick={() => setLedgerFilter('mine')}>My roster ({session.picks.filter((pick) => pick.isMine).length})</button><input aria-label="Search draft ledger" value={ledgerSearch} onChange={(event) => setLedgerSearch(event.target.value)} placeholder="Search drafted…" className="w-40 rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-white placeholder:text-slate-500" /></div>
        </div>
          <ol className="mt-3 grid max-h-72 gap-2 overflow-auto sm:grid-cols-2 xl:grid-cols-3">
            {ledgerPicks.map((pick) => {
              const player = playersById.get(pick.playerId)
              const round = Math.ceil(pick.pick / session.config.leagueSize)
              const roundPick = ((pick.pick - 1) % session.config.leagueSize) + 1
              return (
                <li key={pick.pick} className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${pick.isMine ? 'border-emerald-400/40 bg-emerald-500/10' : 'border-slate-700 bg-slate-950/60'}`}>
                  <span className="min-w-0"><span className="block truncate font-bold">#{pick.pick} {player?.name ?? pick.playerId}</span><span className="text-[10px] text-slate-400">R{round}.{roundPick} · {player?.position} {player?.team} · {pick.isMine ? 'My roster' : `Team ${pick.team}`}</span></span>
                  <button type="button" aria-label={`Remove pick ${pick.pick}`} className="shrink-0 rounded px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-100" onClick={() => onRemovePick(pick.pick)}>Correct</button>
                </li>
              )
            })}
            {!ledgerPicks.length && <li className="p-3 text-sm text-slate-400">{session.picks.length ? 'No drafted players match this filter.' : 'No picks recorded yet. Search above or use a board action to begin.'}</li>}
          </ol>
      </div>
      </div>
    </section>
  )
}
