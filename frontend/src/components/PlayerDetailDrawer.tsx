import { useEffect, useMemo } from 'react'
import {
  CalendarDaysIcon,
  ChartBarIcon,
  HeartIcon,
  NewspaperIcon,
  ShieldCheckIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { usePlayerContext, usePlayerSummary } from '../hooks/usePlayers'
import type { Player } from '../types'
import { DraftConfidenceBadge } from './DraftConfidenceBadge'

interface PlayerDetailDrawerProps {
  player: Player | null
  season: number
  profileId?: string
  onClose: () => void
}

type StatValue = { total: number; avg: number; high: number; games: number }

const statSets: Record<string, Array<[string, string, 'total' | 'avg' | 'high' | 'percent']>> = {
  QB: [
    ['passing_yards', 'Pass yards', 'total'], ['passing_touchdowns', 'Pass TD', 'total'],
    ['interceptions', 'INT', 'total'], ['passing_completions', 'Completions', 'total'],
    ['rushing_yards', 'Rush yards', 'total'], ['rushing_touchdowns', 'Rush TD', 'total'],
    ['passing_cpoe', 'CPOE / game', 'avg'], ['passing_epa', 'Pass EPA', 'total'],
  ],
  RB: [
    ['carries', 'Carries', 'total'], ['rushing_yards', 'Rush yards', 'total'],
    ['rushing_touchdowns', 'Rush TD', 'total'], ['targets', 'Targets', 'total'],
    ['receptions', 'Receptions', 'total'], ['receiving_yards', 'Rec yards', 'total'],
    ['target_share', 'Target share', 'percent'], ['receiving_yards_after_catch', 'YAC', 'total'],
  ],
  WR: [
    ['targets', 'Targets', 'total'], ['receptions', 'Receptions', 'total'],
    ['receiving_yards', 'Rec yards', 'total'], ['receiving_touchdowns', 'Rec TD', 'total'],
    ['target_share', 'Target share', 'percent'], ['air_yards_share', 'Air-yard share', 'percent'],
    ['receiving_yards_after_catch', 'YAC', 'total'], ['wopr', 'WOPR / game', 'avg'],
  ],
  TE: [
    ['targets', 'Targets', 'total'], ['receptions', 'Receptions', 'total'],
    ['receiving_yards', 'Rec yards', 'total'], ['receiving_touchdowns', 'Rec TD', 'total'],
    ['target_share', 'Target share', 'percent'], ['air_yards_share', 'Air-yard share', 'percent'],
    ['receiving_yards_after_catch', 'YAC', 'total'], ['wopr', 'WOPR / game', 'avg'],
  ],
  K: [
    ['field_goals_made', 'FG made', 'total'], ['field_goals_attempted', 'FG attempts', 'total'],
    ['field_goal_long', 'Long FG', 'high'], ['extra_points_made', 'PAT made', 'total'],
  ],
}

const projectionStatSets: Record<string, Array<[string, string]>> = {
  QB: [
    ['passing_yards', 'Pass yards'], ['passing_touchdowns', 'Pass TD'],
    ['interceptions', 'INT'], ['passing_completions', 'Completions'],
    ['rushing_yards', 'Rush yards'], ['rushing_touchdowns', 'Rush TD'],
  ],
  RB: [
    ['carries', 'Carries'], ['rushing_yards', 'Rush yards'], ['rushing_touchdowns', 'Rush TD'],
    ['targets', 'Targets'], ['receptions', 'Receptions'], ['receiving_yards', 'Rec yards'],
  ],
  WR: [
    ['targets', 'Targets'], ['receptions', 'Receptions'], ['receiving_yards', 'Rec yards'],
    ['receiving_touchdowns', 'Rec TD'], ['carries', 'Carries'], ['rushing_yards', 'Rush yards'],
  ],
  TE: [
    ['targets', 'Targets'], ['receptions', 'Receptions'], ['receiving_yards', 'Rec yards'],
    ['receiving_touchdowns', 'Rec TD'],
  ],
  K: [
    ['field_goals_made', 'FG made'], ['field_goals_attempted', 'FG attempts'],
    ['extra_points_made', 'PAT made'], ['extra_points_attempted', 'PAT attempts'],
  ],
}

const formatStat = (stat: StatValue, format: string) => {
  const value = format === 'total' ? stat.total : format === 'high' ? stat.high : stat.avg
  if (format === 'percent') return `${(stat.avg * 100).toFixed(1)}%`
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })
}

const matchupTone = (rank: number | null) => {
  if (!rank) return 'bg-slate-100 text-slate-600'
  if (rank <= 10) return 'bg-emerald-100 text-emerald-800'
  if (rank >= 23) return 'bg-rose-100 text-rose-800'
  return 'bg-amber-100 text-amber-800'
}

export function PlayerDetailDrawer({ player, season, profileId, onClose }: PlayerDetailDrawerProps) {
  const lastSeason = season - 1
  const { data: currentSummary } = usePlayerSummary(player?.id ?? '', season, profileId)
  const { data: lastSummary, isLoading: isLoadingStats } = usePlayerSummary(player?.id ?? '', lastSeason, profileId)
  const { data: context, isLoading: isLoadingContext } = usePlayerContext(player?.id ?? '', season, profileId)

  useEffect(() => {
    if (!player) return
    const handleKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, player])

  const displayStats = useMemo(() => {
    if (!player) return []
    const desired = statSets[player.position] ?? []
    return desired.flatMap(([key, label, format]) => {
      const stat = lastSummary?.season_stats[key]
      return stat ? [{ key, label, value: formatStat(stat, format), games: stat.games }] : []
    })
  }, [lastSummary, player])

  if (!player) return null

  const projection = context?.projection
  const espnProjectedPoints = projection?.points ?? player.projectedPoints
  const profileProjectedPoints = projection?.profile_points
    ?? (player.projectionScoringBasis === 'profile' ? player.fantasyPoints : null)
  const projectedPoints = (profileProjectedPoints ?? player.fantasyPoints) || espnProjectedPoints
  const projectedPpg = projection?.profile_points_per_game
    ?? (projectedPoints ? projectedPoints / 17 : projection?.points_per_game ?? player.projectedPointsPerGame)
  const projectionSource = projection?.source ?? 'ESPN'
  const projectionLabel = projection?.profile_name
    ?? (player.projectionScoringBasis === 'profile' ? 'Selected profile' : `${projectionSource} PPR fallback`)
  const pprPoints = lastSummary?.season_stats.fantasy_points_ppr?.total
  const weeklyPoints = (lastSummary?.weekly_sparkline ?? []).map((week) => ({
    week: week.week,
    points: week.fantasy_points ?? week.stats.fantasy_points_ppr ?? 0,
  })).filter((week) => week.points > 0)
  const maxWeeklyPoints = Math.max(...weeklyPoints.map((week) => week.points), 1)
  const injuries = (context?.injuries ?? []).filter((row) => row.primary_injury || row.report_status || row.practice_status)
  const schedule = context?.schedule_strength
  const projectedStatRows = (projectionStatSets[player.position] ?? []).flatMap(([key, label]) => {
    const value = projection?.stats[key]
    return value == null ? [] : [{ key, label, value }]
  })
  const projectedWeeks = (projection?.weekly ?? [])
    .map((week) => ({ ...week, displayPoints: week.profile_points ?? week.points }))
    .filter((week) => week.displayPoints != null)
  const maxProjectedWeek = Math.max(...projectedWeeks.map((week) => week.displayPoints ?? 0), 1)
  const ownership = projection?.ownership
  const opportunity = projection?.opportunity
  const exactOpportunityLabels: Record<string, string> = {
    carry_share: 'Projected carries',
    target_share: 'Projected targets',
    reception_share: 'Projected catches',
    rushing_yard_share: 'Projected rush yards',
    receiving_yard_share: 'Projected rec. yards',
  }
  const exactOpportunityRows = Object.entries(opportunity?.exact_shares ?? {})

  return (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true" aria-label={`${player.name} details`}>
      <button className="absolute inset-0 bg-slate-950/65 backdrop-blur-sm" aria-label="Close player details" onClick={onClose} />
      <aside className="relative h-full w-full max-w-3xl overflow-y-auto bg-slate-50 shadow-2xl">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start gap-4">
            {player.headshot ? <img src={player.headshot} alt="" className="h-20 w-20 rounded-2xl bg-slate-100 object-cover object-top" /> : <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-100 text-xl font-black text-blue-800">{player.position}</div>}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                <span>{player.position}</span><span>•</span><span>{player.team || 'Free agent'}</span>
                {player.status && <span className="rounded-full bg-emerald-100 px-2 py-1 text-emerald-800">{player.status}</span>}
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950">{player.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{season} outlook · {lastSeason} production · live context</p>
            </div>
            <button className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose} aria-label="Close player details"><XMarkIcon className="h-6 w-6" /></button>
          </div>
        </header>

        <div className="space-y-6 p-6">
          <section>
            <div className="mb-3 flex items-center gap-2"><ShieldCheckIcon className="h-5 w-5 text-blue-700" /><h3 className="font-bold text-slate-900">Draft outlook</h3></div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ['Consensus', player.rank ? `#${player.rank}` : '—', 'Blended rank'],
                [projectionLabel, projectedPoints ? projectedPoints.toFixed(1) : '—', projectedPpg ? `${projectedPpg.toFixed(1)} PPG` : 'Points unavailable'],
                ['Tier / VORP', player.tier ? `T${player.tier}` : '—', player.tier ? `${player.vorp.toFixed(1)} over ${player.position}${player.replacementRank ?? ''}` : 'Analytics unavailable'],
                [`${lastSeason} PPR`, pprPoints ? pprPoints.toFixed(1) : '—', `${lastSummary?.total_games ?? 0} games`],
                ['Market ADP', player.adp ? player.adp.toFixed(1) : '—', `FP ${player.ecr ? `#${Math.round(player.ecr)}` : '—'} · ESPN ${player.espnRank ? `#${player.espnRank}` : '—'}`],
              ].map(([label, value, note]) => (
                <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                  <div className="mt-1 text-2xl font-black text-slate-950">{value}</div>
                  <div className="mt-1 text-xs text-slate-500">{note}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-950">
              Rankings use {player.rankingSourceCount ?? 0} sources{player.byeWeek ? ` · Bye week ${player.byeWeek}` : ''}. {profileProjectedPoints != null ? `${projectionLabel} scoring is applied to ${projectionSource}' projected stat line` : `${projectionSource} ${projection?.scoring ?? 'PPR'} is the fallback because the profile has no matching projected-stat rules`} from {projection?.snapshot_date ?? 'the latest snapshot'}.
            </div>
            {player.draftConfidence && <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h4 className="font-bold text-slate-900">Draft confidence</h4><p className="mt-1 text-xs text-slate-500">Agreement and range—not a projection of player performance.</p></div>
                <DraftConfidenceBadge confidence={player.draftConfidence} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Sources</div><div className="mt-1 text-lg font-black text-slate-950">{player.draftConfidence.sourceCount}/3</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Disagreement</div><div className="mt-1 text-lg font-black text-slate-950">{player.draftConfidence.sourceSpread != null ? `${Math.round(player.draftConfidence.sourceSpread)} picks` : '—'}</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Expert range</div><div className="mt-1 text-lg font-black text-slate-950">{player.draftConfidence.expertRange ? `${Math.round(player.draftConfidence.expertRange.best)}–${Math.round(player.draftConfidence.expertRange.worst)}` : '—'}</div></div>
                <div className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">ADP variation</div><div className="mt-1 text-lg font-black text-slate-950">{player.draftConfidence.marketAdpDeviation != null ? `±${player.draftConfidence.marketAdpDeviation.toFixed(1)}` : '—'}</div></div>
              </div>
              <p className="mt-3 text-xs text-slate-500">{player.draftConfidence.evidence}. Confidence falls when feeds are missing or disagree; it does not mean a player is safer from injury or role changes.</p>
            </div>}
            {projectedStatRows.length > 0 && <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h4 className="font-bold text-slate-900">{projectionSource} projected stat line</h4><p className="text-xs text-slate-500">Season-long forecast · {projection?.scoring ?? 'PPR'} scoring</p></div>
                {ownership && <div className="flex gap-4 text-right text-xs"><div><div className="text-slate-500">Rostered</div><div className="font-black text-slate-900">{ownership.percent_owned != null ? `${ownership.percent_owned.toFixed(1)}%` : '—'}</div></div><div><div className="text-slate-500">Started</div><div className="font-black text-slate-900">{ownership.percent_started != null ? `${ownership.percent_started.toFixed(1)}%` : '—'}</div></div><div><div className="text-slate-500">Auction avg.</div><div className="font-black text-slate-900">{ownership.auction_value_average != null ? `$${ownership.auction_value_average.toFixed(0)}` : '—'}</div></div></div>}
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{projectedStatRows.map((stat) => <div key={stat.key} className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{stat.label}</div><div className="mt-1 text-lg font-black text-slate-950">{stat.value.toLocaleString(undefined, { maximumFractionDigits: stat.value < 100 ? 1 : 0 })}</div></div>)}</div>
              {projectedWeeks.length > 0 && <div className="mt-4 border-t border-slate-100 pt-4"><div className="mb-2 flex items-center justify-between"><span className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Weekly projected · {projectionLabel}</span><span className="text-[10px] text-slate-400">Scored from {projectionSource} projected stats</span></div><div className="flex h-16 items-end gap-1">{projectedWeeks.map((week) => <div key={week.week} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`Week ${week.week}: ${week.displayPoints?.toFixed(1)} projected ${projectionLabel} points`}><div className="w-full rounded-t bg-violet-500 transition-colors group-hover:bg-violet-700" style={{ height: `${Math.max(((week.displayPoints ?? 0) / maxProjectedWeek) * 42, 3)}px` }} /><span className="text-[8px] text-slate-400">{week.week}</span></div>)}</div></div>}
              {projection?.season_outlook && <details className="mt-4 border-t border-slate-100 pt-3"><summary className="cursor-pointer text-sm font-bold text-blue-800">Read ESPN season outlook excerpt</summary><p className="mt-2 text-sm leading-6 text-slate-600">{projection.season_outlook.slice(0, 600)}{projection.season_outlook.length > 600 ? '…' : ''}</p></details>}
            </div>}
            {opportunity?.role_share_estimate != null && <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h4 className="font-bold text-slate-900">Projected team role</h4><p className="text-xs text-slate-500">Compared with {opportunity.teammates_ranked - 1} ranked {player.team} RB/WR/TE teammates</p></div>
                <div className="rounded-xl bg-violet-100 px-4 py-2 text-right text-violet-950"><div className="text-[10px] font-bold uppercase tracking-wide">Role estimate</div><div className="text-2xl font-black">{(opportunity.role_share_estimate * 100).toFixed(1)}%</div></div>
              </div>
              <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-600" style={{ width: `${Math.min(opportunity.role_share_estimate * 100, 100)}%` }} /></div>
              {exactOpportunityRows.length > 0 && <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">{exactOpportunityRows.map(([key, value]) => <div key={key} className="rounded-xl bg-slate-50 p-3"><div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{exactOpportunityLabels[key] ?? key}</div><div className="mt-1 text-lg font-black text-slate-950">{(value.share * 100).toFixed(1)}%</div><div className="text-[10px] text-slate-500">{value.player_value.toLocaleString()} of {value.team_total.toLocaleString()} · {value.players_covered} players</div></div>)}</div>}
              <p className="mt-3 text-xs leading-5 text-slate-500">{opportunity.method} This is not a projected snap or possession share.{exactOpportunityRows.length > 0 ? ` ${opportunity.exact_share_method}` : ''}</p>
            </div>}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><ChartBarIcon className="h-5 w-5 text-blue-700" /><h3 className="font-bold text-slate-900">{lastSeason} production and advanced usage</h3></div>
            {isLoadingStats ? <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading last-season statistics…</div> : displayStats.length ? (
              <>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {displayStats.map((stat) => <div key={stat.key} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="text-xs font-semibold text-slate-500">{stat.label}</div><div className="mt-1 text-xl font-black text-slate-950">{stat.value}</div><div className="text-xs text-slate-500">{lastSummary?.total_games ?? stat.games} games</div></div>)}
                </div>
                {weeklyPoints.length > 0 && <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-slate-500">Weekly PPR output</span><span className="text-xs text-slate-500">nflverse</span></div><div className="flex h-24 items-end gap-1">{weeklyPoints.map((week) => <div key={week.week} className="group flex min-w-0 flex-1 flex-col items-center justify-end gap-1" title={`Week ${week.week}: ${week.points.toFixed(1)} PPR points`}><div className="w-full rounded-t bg-blue-500 transition-colors group-hover:bg-blue-700" style={{ height: `${Math.max((week.points / maxWeeklyPoints) * 72, 3)}px` }} /><span className="text-[9px] text-slate-400">{week.week}</span></div>)}</div></div>}
              </>
            ) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm text-slate-600">No {lastSeason} statistics are available for this player.</div>}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2"><CalendarDaysIcon className="h-5 w-5 text-blue-700" /><h3 className="font-bold text-slate-900">{season} strength of schedule</h3></div>
            {isLoadingContext ? <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">Calculating schedule context…</div> : schedule?.available ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="text-2xl font-black text-slate-950">{schedule.label}</div><div className="text-sm text-slate-500">Schedule rank #{schedule.schedule_rank} of 32</div></div><div className="rounded-xl bg-slate-950 px-4 py-2 text-right text-white"><div className="text-xs text-slate-300">Average matchup</div><div className="text-lg font-black">#{schedule.average_opponent_ease_rank}</div></div></div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">{schedule.matchups?.slice(0, 6).map((matchup) => <div key={matchup.week} className="rounded-xl border border-slate-200 p-3 text-center"><div className="text-[10px] font-bold uppercase text-slate-400">Week {matchup.week}</div><div className="mt-1 font-black text-slate-900">{matchup.location === 'home' ? '' : '@'}{matchup.opponent}</div><div className={`mt-2 rounded-full px-2 py-1 text-xs font-bold ${matchupTone(matchup.ease_rank)}`}>#{matchup.ease_rank ?? '—'}</div></div>)}</div>
                <p className="mt-3 text-xs leading-5 text-slate-500">{schedule.method}. Green is easier; red is harder. This is a descriptive baseline, not a point projection.</p>
              </div>
            ) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-600">{schedule?.reason ?? 'Schedule context is not available yet.'}</div>}
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center gap-2"><HeartIcon className="h-5 w-5 text-rose-600" /><h3 className="font-bold text-slate-900">Injury report</h3></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {injuries.length ? <div className="space-y-3">{injuries.slice(0, 3).map((injury, index) => <div key={`${injury.season}-${injury.week}-${index}`} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between gap-3"><span className="font-bold text-slate-900">{injury.primary_injury ?? 'Practice report'}</span><span className="text-xs font-bold text-rose-700">{injury.report_status ?? injury.practice_status ?? 'Listed'}</span></div><div className="text-xs text-slate-500">{injury.season} · Week {injury.week}</div></div>)}</div> : <p className="text-sm text-slate-600">No recent official injury-report entries.</p>}
              </div>
            </section>

            <section>
              <div className="mb-3 flex items-center gap-2"><NewspaperIcon className="h-5 w-5 text-blue-700" /><h3 className="font-bold text-slate-900">Recent news</h3></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {context?.news.length ? <div className="space-y-3">{context.news.slice(0, 4).map((item) => <a key={item.url} href={item.url} target="_blank" rel="noreferrer" className="block border-b border-slate-100 pb-3 last:border-0 last:pb-0 hover:text-blue-800"><div className="text-sm font-bold leading-5">{item.title}</div><div className="mt-1 text-xs text-slate-500">{item.source.toUpperCase()} · {new Date(item.published_at).toLocaleDateString()}</div></a>)}</div> : <p className="text-sm text-slate-600">No recent player-linked headlines.</p>}
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-bold text-slate-900">Data status</h3>
            <dl className="mt-3 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div><dt className="text-slate-500">Roster season</dt><dd className="font-bold text-slate-900">{player.lastSeason ?? 'Unknown'}</dd></div>
              <div><dt className="text-slate-500">Current games</dt><dd className="font-bold text-slate-900">{currentSummary?.total_games ?? 0}</dd></div>
              <div><dt className="text-slate-500">Last-season games</dt><dd className="font-bold text-slate-900">{lastSummary?.total_games ?? 0}</dd></div>
              <div><dt className="text-slate-500">Projection source</dt><dd className="font-bold text-slate-900">{projectedPoints ? projectionSource : 'Unavailable'}</dd></div>
            </dl>
          </section>
        </div>
      </aside>
    </div>
  )
}
