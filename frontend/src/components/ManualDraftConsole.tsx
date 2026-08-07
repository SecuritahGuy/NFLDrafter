import React, { useMemo } from 'react'
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

interface ManualDraftConsoleProps {
  session: DraftSession
  players: Player[]
  availablePlayers: Player[]
  onConfigure: (config: DraftConfig) => void
  onUndo: () => void
  onRemovePick: (pick: number) => void
  onReset: () => void
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
  draftPackage,
  onImportPackage,
  onPackageError,
}) => {
  const currentPick = session.picks.length + 1
  const currentTeam = teamForPick(currentPick, session.config.leagueSize)
  const nextUserPick = currentTeam === session.config.draftSlot
    ? currentPick
    : nextPickForTeam(currentPick - 1, session.config.draftSlot, session.config.leagueSize, session.config.rounds)
  const recommendations = useMemo(
    () => recommendPlayers(availablePlayers, session.picks, players, currentPick, nextUserPick, 5),
    [availablePlayers, currentPick, nextUserPick, players, session.picks],
  )
  const playersById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])

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
    <section aria-labelledby="manual-draft-heading" className="mb-6 rounded-xl border border-blue-400/30 bg-slate-900/80 p-4 text-white shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 id="manual-draft-heading" className="text-xl font-bold">Manual Draft Console</h2>
          <p className="mt-1 text-sm text-slate-300">Runs locally. Row click opens details; use the opponent or + controls to record picks.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40" onClick={onUndo} disabled={!session.picks.length}>Undo</button>
          <button type="button" className="rounded bg-slate-700 px-3 py-2 text-sm disabled:opacity-40" onClick={exportDraft} disabled={!session.picks.length}>Export picks</button>
          <button type="button" className="rounded bg-blue-700 px-3 py-2 text-sm disabled:opacity-40" onClick={exportPackage} disabled={!draftPackage}>Export package</button>
          <label className="cursor-pointer rounded bg-slate-700 px-3 py-2 text-sm">
            Import package
            <input aria-label="Import draft package" type="file" accept="application/json,.json" className="sr-only" onChange={importPackage} />
          </label>
          <button type="button" className="rounded bg-red-700 px-3 py-2 text-sm" onClick={onReset}>Reset</button>
        </div>
      </div>

      {draftPackage && (
        <p className="mt-2 text-xs text-emerald-300">
          Offline package ready · {draftPackage.players.length} players · {draftPackage.checksum}
        </p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="text-xs text-slate-300">Teams
          <input aria-label="League size" type="number" min={2} max={20} value={session.config.leagueSize} onChange={(event) => onConfigure({ ...session.config, leagueSize: Number(event.target.value), draftSlot: Math.min(session.config.draftSlot, Number(event.target.value)) })} className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-white" />
        </label>
        <label className="text-xs text-slate-300">My slot
          <input aria-label="Draft slot" type="number" min={1} max={session.config.leagueSize} value={session.config.draftSlot} onChange={(event) => onConfigure({ ...session.config, draftSlot: Number(event.target.value) })} className="mt-1 w-full rounded bg-slate-800 px-2 py-1.5 text-white" />
        </label>
        <div className="rounded bg-slate-800 p-2"><div className="text-xs text-slate-400">On the clock</div><div className="font-bold">Pick {currentPick} · Team {currentTeam}</div></div>
        <div className="rounded bg-slate-800 p-2"><div className="text-xs text-slate-400">My next pick</div><div className="font-bold">{nextUserPick ?? 'Draft complete'}</div></div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-blue-200">Top recommendations</h3>
          <ol className="mt-2 space-y-2">
            {recommendations.map(({ player, score, reason }) => (
              <li key={player.id} className="rounded bg-slate-800 px-3 py-2 text-sm">
                <span className="font-semibold">{player.name} · {player.position}</span>
                <span className="ml-2 text-xs text-slate-400">{score.toFixed(1)}</span>
                <div className="text-xs text-slate-300">{reason}</div>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-blue-200">Recent picks</h3>
          <ol className="mt-2 max-h-48 space-y-2 overflow-auto">
            {[...session.picks].reverse().slice(0, 8).map((pick) => {
              const player = playersById.get(pick.playerId)
              return (
                <li key={pick.pick} className="flex items-center justify-between rounded bg-slate-800 px-3 py-2 text-sm">
                  <span>#{pick.pick} {player?.name ?? pick.playerId} <span className="text-slate-400">({pick.isMine ? 'Me' : `Team ${pick.team}`})</span></span>
                  <button type="button" aria-label={`Remove pick ${pick.pick}`} className="text-xs text-red-300 hover:text-red-100" onClick={() => onRemovePick(pick.pick)}>Correct</button>
                </li>
              )
            })}
            {!session.picks.length && <li className="text-sm text-slate-400">No picks recorded yet.</li>}
          </ol>
        </div>
      </div>
    </section>
  )
}
