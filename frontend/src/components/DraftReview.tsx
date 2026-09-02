import React, { useMemo } from 'react'
import { ChartBarIcon } from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { usePlayers } from '../hooks/usePlayers'
import type { Player } from '../types'
import { loadDraftPackage } from '../services/draftPackage'
import type { DraftPick, DraftSession } from '../services/draftEngine'
import { rankingsAPI } from '../api'

const SESSION_STORAGE_KEY = 'nfldrafter.manual-draft.v1'

const loadDraftSession = (): DraftSession | null => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SESSION_STORAGE_KEY) || 'null') as DraftSession | null
    return parsed?.version === 1 && Array.isArray(parsed.picks) ? parsed : null
  } catch {
    return null
  }
}

const playerOrder = (player: Player) => player.rank && player.rank > 0
  ? player.rank
  : player.adp && player.adp > 0 ? player.adp : Number.MAX_SAFE_INTEGER

const pickLabel = (pick: DraftPick, leagueSize: number) => `R${Math.ceil(pick.pick / leagueSize)}.${((pick.pick - 1) % leagueSize) + 1}`

export const DraftReview: React.FC = () => {
  const { data: backendPlayers = [], isLoading } = usePlayers({ limit: 1200, current_only: true, season: 2026 })
  const session = useMemo(loadDraftSession, [])
  const draftPackage = useMemo(loadDraftPackage, [])
  const draftTimestamp = useMemo(() => {
    const timestamps = (session?.picks ?? []).map(pick => Date.parse(pick.madeAt)).filter(Number.isFinite)
    return timestamps.length ? timestamps.sort((a, b) => a - b)[Math.floor(timestamps.length / 2)] : null
  }, [session])
  const { data: snapshots = [] } = useQuery({
    queryKey: ['rankings', 'fantasypros-ecr', 'snapshots'],
    queryFn: () => rankingsAPI.getSnapshots('fantasypros-ecr'),
    staleTime: 30 * 60 * 1000,
  })
  const nearestSnapshot = useMemo(() => {
    if (!draftTimestamp || !snapshots.length) return null
    return snapshots.reduce((nearest, snapshot) => Math.abs(snapshot.snapshot_ts - draftTimestamp) < Math.abs(nearest.snapshot_ts - draftTimestamp) ? snapshot : nearest)
  }, [draftTimestamp, snapshots])
  const { data: historicalRankings } = useQuery({
    queryKey: ['rankings', 'fantasypros-ecr', 'draft-review', nearestSnapshot?.snapshot_date],
    queryFn: () => rankingsAPI.getRankings('fantasypros-ecr', 1200, nearestSnapshot?.snapshot_date),
    enabled: Boolean(nearestSnapshot?.snapshot_date),
    staleTime: 30 * 60 * 1000,
  })
  const playersById = useMemo(() => {
    const players = new Map<string, Player>()
    for (const player of draftPackage?.players ?? []) players.set(player.id, player)
    for (const player of backendPlayers) {
      players.set(player.player_id, {
        id: player.player_id,
        name: player.full_name,
        position: player.position,
        team: player.team,
        fantasyPoints: 0,
        yahooPoints: 0,
        delta: 0,
        vorp: 0,
        tier: 0,
        adp: 0,
        newsCount: 0,
        byeWeek: 0,
      })
    }
    return players
  }, [backendPlayers, draftPackage])
  const historicalRankByPlayer = useMemo(() => new Map((historicalRankings?.rankings ?? []).filter(row => row.player_id && row.rank).map(row => [row.player_id!, row.rank!])), [historicalRankings])
  const myPicks = useMemo(() => (session?.picks ?? []).filter(pick => pick.isMine).sort((a, b) => a.pick - b.pick), [session])

  if (!session) return <DraftReviewEmpty title="No recorded draft yet" copy="Complete or import a draft in Draft Room first. Your review is built from the saved local draft ledger." />
  if (!myPicks.length) return <DraftReviewEmpty title="No picks on your roster" copy="The saved ledger does not identify any selections as your team. Check the draft slot or correct the ledger in Draft Room." />

  return <div className="min-h-[calc(100vh-3rem)] bg-slate-950 text-slate-100">
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Post-draft analysis</p><h1 className="mt-2 text-3xl font-black tracking-tight">Draft Review</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Review your selections against players who were selected later. This is an explainable comparison of cached board order, not a claim that another pick would have been definitively better.</p></div>
        <div className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-4 py-3 text-right"><p className="text-xs font-bold uppercase tracking-wide text-cyan-200">Your picks</p><p className="mt-1 text-2xl font-black">{myPicks.length}</p></div>
      </div>
      <div className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm leading-6 text-amber-100"><strong>Snapshot note:</strong> {nearestSnapshot ? `FantasyPros ECR snapshot ${nearestSnapshot.snapshot_date} is the closest cached board to the recorded draft time.` : 'No dated FantasyPros ECR snapshot is available near the recorded draft time, so this report uses the local cached board.'}</div>
      <section className="mt-6 space-y-4">
        {myPicks.map(pick => {
          const chosen = playersById.get(pick.playerId)
          const rankFor = (player: Player) => historicalRankByPlayer.get(player.id) ?? playerOrder(player)
          const alternatives = session.picks.filter(candidate => candidate.pick > pick.pick).map(candidate => ({ pick: candidate, player: playersById.get(candidate.playerId) })).filter((candidate): candidate is { pick: DraftPick; player: Player } => Boolean(candidate.player)).sort((a, b) => rankFor(a.player) - rankFor(b.player)).slice(0, 3)
          const chosenRank = chosen ? historicalRankByPlayer.get(chosen.id) : undefined
          return <article key={pick.pick} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pick {pickLabel(pick, session.config.leagueSize)} · overall #{pick.pick}</p><h2 className="mt-1 text-xl font-black">{chosen?.name ?? pick.playerId}</h2><p className="mt-1 text-sm text-slate-400">{chosen ? `${chosen.position} · ${chosen.team || 'FA'}${chosenRank ? ` · FantasyPros ECR #${chosenRank}` : chosen.rank ? ` · cached composite #${chosen.rank}` : ''}` : 'Player identity was not retained in the local package.'}</p></div><span className="rounded-lg bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">Your selection</span></div><div className="mt-4 border-t border-slate-700 pt-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Best cached board alternatives selected later</p><div className="mt-3 grid gap-2 md:grid-cols-3">{alternatives.map(({ pick: alternativePick, player }) => <div key={alternativePick.pick} className="rounded-xl border border-slate-700 bg-slate-950/50 p-3"><p className="font-bold">{player.name}</p><p className="mt-1 text-xs text-slate-400">{player.position} · {player.team || 'FA'} · selected {pickLabel(alternativePick, session.config.leagueSize)}</p><p className="mt-2 text-xs font-semibold text-cyan-200">{historicalRankByPlayer.get(player.id) ? `FantasyPros ECR #${historicalRankByPlayer.get(player.id)}` : player.rank ? `Cached composite #${player.rank}` : player.adp ? `Cached ADP ${player.adp.toFixed(1)}` : 'No cached ordering'}</p></div>)}{!alternatives.length && <p className="text-sm text-slate-400">No later selections with a cached player record.</p>}</div></div></article>
        })}
      </section>
      {isLoading && <p className="mt-4 text-sm text-slate-400">Loading current player identities…</p>}
    </main>
  </div>
}

const DraftReviewEmpty: React.FC<{ title: string; copy: string }> = ({ title, copy }) => <div className="min-h-[calc(100vh-3rem)] bg-slate-950 px-6 py-20 text-slate-100"><div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-8 text-center"><ChartBarIcon className="mx-auto h-8 w-8 text-cyan-300" /><h1 className="mt-4 text-2xl font-black">{title}</h1><p className="mt-3 leading-6 text-slate-400">{copy}</p></div></div>
