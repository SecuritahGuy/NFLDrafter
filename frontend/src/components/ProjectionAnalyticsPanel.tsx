import { useMemo } from 'react'
import type { Player } from '../types'
import type { ProjectionAnalyticsResponse } from '../api'

interface ProjectionAnalyticsPanelProps {
  players: Player[]
  profileName: string
  snapshotDate?: string | null
  methodology?: ProjectionAnalyticsResponse['methodology']
}

export function ProjectionAnalyticsPanel({
  players,
  profileName,
  snapshotDate,
  methodology,
}: ProjectionAnalyticsPanelProps) {
  const projected = useMemo(
    () => players.filter((player) => player.tier > 0).sort((a, b) => b.vorp - a.vorp),
    [players],
  )
  const positions = useMemo(() => {
    const grouped = new Map<string, Player[]>()
    for (const player of projected) {
      grouped.set(player.position, [...(grouped.get(player.position) ?? []), player])
    }
    return [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
  }, [projected])
  const fallbackCount = projected.filter((player) => player.projectionScoringBasis === 'source_fallback').length

  if (!projected.length) {
    return (
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
        <div className="text-xs font-bold uppercase tracking-wider text-blue-700">Projection analytics</div>
        <h3 className="mt-1 text-lg font-black text-slate-950">Waiting for scored projections</h3>
        <p className="mt-2 text-sm leading-6 text-slate-600">Load a FantasyPros or ESPN projection snapshot and choose a scoring profile to activate tiers and value over replacement.</p>
      </div>
    )
  }

  return (
    <section className="overflow-hidden rounded-xl border border-violet-200 bg-white shadow-sm">
      <header className="bg-gradient-to-r from-violet-700 to-blue-700 px-4 py-4 text-white">
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Projection analytics</div>
        <h3 className="mt-1 text-lg font-black">{profileName} tiers &amp; VORP</h3>
        <p className="mt-1 text-xs text-violet-100">FantasyPros projections with ESPN fallback · snapshot {snapshotDate ?? 'latest'}</p>
      </header>

      <div className="space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black text-slate-950">{projected.length}</div><div className="text-[10px] font-bold uppercase text-slate-500">Scored</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black text-slate-950">{positions.reduce((sum, [, rows]) => sum + new Set(rows.map((row) => row.tier)).size, 0)}</div><div className="text-[10px] font-bold uppercase text-slate-500">Position tiers</div></div>
          <div className="rounded-xl bg-slate-50 p-3"><div className="text-xl font-black text-slate-950">{fallbackCount}</div><div className="text-[10px] font-bold uppercase text-slate-500">Native fallback</div></div>
        </div>

        <div>
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Top value over replacement</h4>
          <div className="mt-2 space-y-2">
            {projected.slice(0, 8).map((player) => (
              <div key={player.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border border-slate-100 px-3 py-2">
                <div className="min-w-0"><div className="truncate text-sm font-bold text-slate-950">{player.name}</div><div className="text-[10px] text-slate-500">{player.position} · {player.team} · replacement {player.position}{player.replacementRank ?? '—'}</div></div>
                <div className="rounded-full bg-violet-100 px-2 py-1 text-xs font-black text-violet-800">T{player.tier}</div>
                <div className={`text-sm font-black ${player.vorp >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>{player.vorp >= 0 ? '+' : ''}{player.vorp.toFixed(1)}</div>
              </div>
            ))}
          </div>
        </div>

        <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <summary className="cursor-pointer font-bold text-slate-800">How replacement and tiers are calculated</summary>
          <div className="mt-2 space-y-2 leading-5">
            <p>{methodology?.flex_allocation}</p>
            <p>{methodology?.tier_method}</p>
            <p>{methodology?.fallback}</p>
            {positions.map(([position]) => (
              <div key={position} className="flex justify-between border-t border-slate-200 pt-1">
                <span>{position} replacement</span>
                <strong>{position}{methodology?.replacement_ranks?.[position] ?? '—'}</strong>
              </div>
            ))}
          </div>
        </details>
      </div>
    </section>
  )
}
