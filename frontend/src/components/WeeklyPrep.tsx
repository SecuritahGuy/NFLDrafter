import React, { useEffect, useMemo, useState } from 'react'
import { ArrowPathIcon, ChartBarIcon, ExclamationTriangleIcon, UserGroupIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useInjuries, usePlayers } from '../hooks/usePlayers'
import { useRankings } from '../hooks/useRankings'

type YahooTeam = {
  id: string
  name: string
  owner?: string
  is_current_user?: boolean
  rank?: number
  wins?: number
  losses?: number
  ties?: number
  points_for?: number
  points_against?: number
}

type RosterPlayer = { id: string; canonical_player_id?: string; name: string; position: string; team: string; selected_position?: string; recent_weeks?: Array<{ season: number; week: number; stats: Record<string, number> }> }

type YahooRoster = { team_id: string; players: RosterPlayer[] }

type TeamDetail = {
  team: YahooTeam
  players: RosterPlayer[]
  stats_source: string
  stats_seasons: number[]
}

type YahooSnapshot = {
  fetched_at: number
  metadata?: { name?: string; season?: number }
  coverage?: { rosters?: number; rostered_players?: number }
  mapping_coverage?: { season: number; mapped_roster_players: number; rostered_players: number; mapped_available_players: number; available_players: number }
  players?: Array<{ id: string; canonical_player_id?: string; name: string; position: string; team: string; percent_owned?: number }>
  teams: YahooTeam[]
  rosters: YahooRoster[]
  transactions: Array<{ id: string; type: string; timestamp: number; players: Array<{ name: string; action: string }> }>
  scoreboard: {
    week: number
    matchups: Array<{
      week: number
      status?: string
      is_playoffs?: boolean
      teams: Array<{ id: string; name: string; points?: number; projected_points?: number }>
    }>
  }
}

const BENCH_SLOTS = new Set(['BN', 'IR', 'IR+', 'NA'])
const number = (value: number | undefined) => typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'
const yahooPlayerKey = (id: string | undefined) => id?.match(/(?:^|\.p\.)(\d+)$/)?.[1] || id || ''

const formatRecent = (player: RosterPlayer) => {
  const latest = player.recent_weeks?.[0]
  if (!latest) return 'No recent stats'
  const stats = latest.stats
  const fantasyPoints = stats.fantasy_points_ppr ?? stats.fantasy_points
  if (fantasyPoints !== undefined) return `${latest.season} W${latest.week} · ${fantasyPoints.toFixed(1)} PPR pts`
  const position = player.position === 'DEF' ? 'DST' : player.position
  if (position === 'QB' && stats.passing_yards !== undefined) return `${latest.season} W${latest.week} · ${stats.passing_yards.toFixed(0)} pass yds`
  if (position === 'RB' && stats.rushing_yards !== undefined) return `${latest.season} W${latest.week} · ${stats.rushing_yards.toFixed(0)} rush yds`
  if (['WR', 'TE'].includes(position) && stats.receiving_yards !== undefined) return `${latest.season} W${latest.week} · ${stats.receiving_yards.toFixed(0)} rec yds`
  return `${latest.season} W${latest.week} · stats available`
}

type DrawerRow = {
  player: RosterPlayer
  projection?: { projected_points: number | null; projected_points_per_game: number | null }
  injury?: { report_status: string | null; practice_status: string | null; report_primary_injury: string | null }
  headshot?: string
  recent: string
}

export const WeeklyPrep: React.FC = () => {
  const [snapshot, setSnapshot] = useState<YahooSnapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshingYahoo, setIsRefreshingYahoo] = useState(false)
  const [sortBy, setSortBy] = useState<'standing' | 'projection' | 'injuries'>('standing')
  const [inspectedTeamId, setInspectedTeamId] = useState<string | null>(null)
  const [drawerTeamId, setDrawerTeamId] = useState<string | null>(null)
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null)
  const [isLoadingTeam, setIsLoadingTeam] = useState(false)
  const [teamDetailError, setTeamDetailError] = useState<string | null>(null)
  const { data: players = [] } = usePlayers({ limit: 1200, current_only: true, season: 2026 })
  const { data: projections } = useRankings('fantasypros-projection')
  const { data: injuries = [] } = useInjuries(2026)
  const selectedLeague = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('yahoo_selected_league') || 'null') as { id: string; name?: string } | null
    } catch {
      return null
    }
  }, [])

  const loadSnapshot = async () => {
    if (!selectedLeague?.id) return
    setError(null)
    try {
      const response = await fetch(`/api/yahoo/leagues/${selectedLeague.id}/weekly-prep`)
      if (response.status === 404) {
        setError('This league has not been cached yet. Open Draft Room and run Refresh all sources to prepare weekly data.')
        return
      }
      if (!response.ok) throw new Error('Unable to load the cached Yahoo league snapshot.')
      const synced = await response.json()
      setSnapshot(synced)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load the cached Yahoo league snapshot.')
    }
  }

  const refreshYahooSnapshot = async () => {
    const accessToken = localStorage.getItem('yahoo_access_token')
    if (!selectedLeague?.id || !accessToken) {
      setError('Yahoo is not connected in this browser. Open Draft Room to reconnect, then refresh the league data.')
      return
    }
    setIsRefreshingYahoo(true)
    setError(null)
    try {
      const response = await fetch(`/api/yahoo/leagues/${selectedLeague.id}/sync`, {
        method: 'POST', headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!response.ok) {
        const body = await response.json().catch(() => null)
        throw new Error(typeof body?.detail === 'string' ? body.detail : 'Yahoo could not refresh this league.')
      }
      await response.json()
      await loadSnapshot()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Yahoo could not refresh this league.')
    } finally {
      setIsRefreshingYahoo(false)
    }
  }

  useEffect(() => { void loadSnapshot() }, [selectedLeague?.id])

  useEffect(() => {
    if (!drawerTeamId) return
    const priorOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setDrawerTeamId(null) }
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.body.style.overflow = priorOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [drawerTeamId])

  const openTeamDrawer = async (teamId: string) => {
    if (!selectedLeague?.id) return
    setDrawerTeamId(teamId)
    setInspectedTeamId(teamId)
    setTeamDetail(null)
    setTeamDetailError(null)
    setIsLoadingTeam(true)
    try {
      const response = await fetch(`/api/yahoo/leagues/${selectedLeague.id}/weekly-prep/teams/${encodeURIComponent(teamId)}`)
      if (!response.ok) throw new Error('Recent player statistics could not be loaded.')
      setTeamDetail(await response.json())
    } catch (cause) {
      setTeamDetailError(cause instanceof Error ? cause.message : 'Recent player statistics could not be loaded.')
    } finally {
      setIsLoadingTeam(false)
    }
  }

  const rosterByTeam = useMemo(() => new Map(snapshot?.rosters.map(roster => [roster.team_id, roster.players]) ?? []), [snapshot])
  const currentMatchup = useMemo(() => {
    if (!snapshot) return null
    const mine = snapshot.teams.find(team => team.is_current_user)
    return snapshot.scoreboard.matchups.find(matchup => matchup.teams.some(team => team.id === mine?.id)) ?? null
  }, [snapshot])
  const myMatchupTeams = currentMatchup?.teams ?? []
  const myScoreboardTeam = myMatchupTeams.find(team => snapshot?.teams.some(leagueTeam => leagueTeam.id === team.id && leagueTeam.is_current_user))
  const opponent = myMatchupTeams.find(team => team.id !== myScoreboardTeam?.id)
  const playerByYahooId = useMemo(() => new Map(players.filter(player => player.yahoo_id).map(player => [yahooPlayerKey(player.yahoo_id), player])), [players])
  const playerById = useMemo(() => new Map(players.map(player => [player.player_id, player])), [players])
  const projectionByPlayerId = useMemo(() => new Map((projections?.rankings || []).filter(row => row.player_id).map(row => [row.player_id as string, row])), [projections])
  const teamProjection = useMemo(() => new Map((snapshot?.rosters || []).map(roster => {
    const matched = roster.players.map(player => player.canonical_player_id ? playerById.get(player.canonical_player_id) : playerByYahooId.get(yahooPlayerKey(player.id))).filter(Boolean)
    const projected = matched.map(player => projectionByPlayerId.get(player!.player_id)?.projected_points).filter((value): value is number => value !== null && value !== undefined)
    return [roster.team_id, { total: projected.reduce((sum, value) => sum + value, 0), covered: projected.length, rostered: roster.players.length }]
  })), [snapshot, playerById, playerByYahooId, projectionByPlayerId])
  const injuryByPlayerId = useMemo(() => {
    // The endpoint returns newest reports first. Keep the first report per
    // player so an older status cannot overwrite the current one.
    const latest = new Map<string, typeof injuries[number]>()
    for (const injury of injuries) {
      if (injury.player_id && !latest.has(injury.player_id)) latest.set(injury.player_id, injury)
    }
    return latest
  }, [injuries])
  const teamDepth = useMemo(() => new Map((snapshot?.rosters || []).map(roster => {
    const counts = roster.players.reduce<Record<string, number>>((total, player) => {
      const position = player.position === 'D/ST' ? 'DST' : player.position
      if (['QB', 'RB', 'WR', 'TE'].includes(position)) total[position] = (total[position] || 0) + 1
      return total
    }, {})
    const injuryCount = roster.players.reduce((total, player) => {
      const canonical = player.canonical_player_id ? playerById.get(player.canonical_player_id) : playerByYahooId.get(yahooPlayerKey(player.id))
      return total + (canonical && injuryByPlayerId.has(canonical.player_id) ? 1 : 0)
    }, 0)
    return [roster.team_id, { counts, injuryCount }]
  })), [snapshot, playerById, playerByYahooId, injuryByPlayerId])
  const sortedTeams = useMemo(() => [...(snapshot?.teams ?? [])].sort((a, b) => {
    if (sortBy === 'projection') return (teamProjection.get(b.id)?.total || 0) - (teamProjection.get(a.id)?.total || 0)
    if (sortBy === 'injuries') return (teamDepth.get(a.id)?.injuryCount || 0) - (teamDepth.get(b.id)?.injuryCount || 0)
    return (a.rank || 999) - (b.rank || 999) || (b.points_for || 0) - (a.points_for || 0)
  }), [snapshot, sortBy, teamDepth, teamProjection])

  if (!selectedLeague) {
    return <EmptyState title="Choose a Yahoo league first" copy="Connect and select a league in Draft Room. Weekly Prep uses that saved, read-only league snapshot." />
  }

  if (error) {
    return <EmptyState title="Weekly Prep needs a cached league" copy={error} action={<button onClick={() => void loadSnapshot()} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-500"><ArrowPathIcon className="h-4 w-4" />Try again</button>} />
  }

  if (!snapshot) {
    return <div className="mx-auto max-w-6xl p-6 text-slate-300">Loading your local league snapshot…</div>
  }

  const fetchedAt = new Date(snapshot.fetched_at * 1000)
  const myTeam = snapshot.teams.find(team => team.is_current_user)
  const myRoster = rosterByTeam.get(myTeam?.id || '') || []
  const inspectedTeam = snapshot.teams.find(team => team.id === inspectedTeamId) || myTeam
  const inspectedRoster = rosterByTeam.get(inspectedTeam?.id || '') || []
  const myInjuries = myRoster.flatMap(player => {
    const canonical = player.canonical_player_id ? playerById.get(player.canonical_player_id) : playerByYahooId.get(yahooPlayerKey(player.id))
    const injury = canonical ? injuryByPlayerId.get(canonical.player_id) : undefined
    return injury ? [{ player, injury }] : []
  })
  const lineupSignals = myRoster.map(player => {
    const canonical = player.canonical_player_id ? playerById.get(player.canonical_player_id) : playerByYahooId.get(yahooPlayerKey(player.id))
    const projection = canonical ? projectionByPlayerId.get(canonical.player_id) : undefined
    return {
      player,
      starter: !BENCH_SLOTS.has(player.selected_position || ''),
      injury: canonical ? injuryByPlayerId.get(canonical.player_id) : undefined,
      projectedPpg: projection?.projected_points_per_game ?? null,
    }
  })
  const lineupAdvice = (() => {
    const startersByPosition = new Map(lineupSignals.filter(signal => signal.starter).map(signal => [signal.player.position, signal]))
    const injuredStarters = lineupSignals.filter(signal => signal.starter && signal.injury)
    const benchUpside = lineupSignals.filter(signal => {
      if (signal.starter || signal.injury || signal.projectedPpg === null) return false
      const starter = startersByPosition.get(signal.player.position)
      return Boolean(starter && starter.projectedPpg !== null && signal.projectedPpg > starter.projectedPpg + 0.3)
    }).map(signal => ({ signal, starter: startersByPosition.get(signal.player.position)! }))
    return { injuredStarters, benchUpside }
  })()
  const rosteredYahooIds = new Set((snapshot.rosters || []).flatMap(roster => roster.players.map(player => player.id)))
  const waiverTargets = (snapshot.players || []).flatMap(player => {
    if (rosteredYahooIds.has(player.id) || !player.canonical_player_id || !['QB', 'RB', 'WR', 'TE', 'K', 'DEF', 'DST'].includes(player.position)) return []
    const projection = projectionByPlayerId.get(player.canonical_player_id)
    if (projection?.projected_points_per_game === null || projection?.projected_points_per_game === undefined) return []
    return [{ player, projectedPpg: projection.projected_points_per_game }]
  }).sort((a, b) => b.projectedPpg - a.projectedPpg).slice(0, 6)
  const drawerTeam = snapshot.teams.find(team => team.id === drawerTeamId)
  const drawerRoster = teamDetail?.players || rosterByTeam.get(drawerTeamId || '') || []
  const drawerRows = drawerRoster.map(player => {
    const canonical = player.canonical_player_id ? playerById.get(player.canonical_player_id) : playerByYahooId.get(yahooPlayerKey(player.id))
    return {
      player,
      projection: canonical ? projectionByPlayerId.get(canonical.player_id) : undefined,
      injury: canonical ? injuryByPlayerId.get(canonical.player_id) : undefined,
      headshot: canonical?.headshot,
      recent: formatRecent(player),
    }
  })
  const drawerStarters = drawerRows.filter(row => !BENCH_SLOTS.has(row.player.selected_position || ''))
  const drawerBench = drawerRows.filter(row => BENCH_SLOTS.has(row.player.selected_position || ''))
  const startingCount = myRoster.filter(player => !BENCH_SLOTS.has(player.selected_position || '')).length
  const matchupProjection = myScoreboardTeam?.projected_points && opponent?.projected_points
    ? myScoreboardTeam.projected_points - opponent.projected_points : null

  return (
    <div className="min-h-[calc(100vh-3rem)] bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Weekly Prep</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{snapshot.metadata?.name || selectedLeague.name || 'Your league'} command center</h1>
            <p className="mt-2 text-sm text-slate-400">Cached {fetchedAt.toLocaleString()} · Database snapshot only · no Yahoo request on this page</p>
          </div>
          <div className="flex flex-wrap gap-2"><button onClick={() => void loadSnapshot()} className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900 px-4 py-2 text-sm font-bold hover:bg-slate-800"><ArrowPathIcon className="h-4 w-4" />Reload cache</button><button onClick={() => void refreshYahooSnapshot()} disabled={isRefreshingYahoo} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-500 disabled:cursor-wait disabled:opacity-60"><ArrowPathIcon className="h-4 w-4" />{isRefreshingYahoo ? 'Refreshing Yahoo…' : 'Refresh Yahoo data'}</button></div>
        </div>

        {(snapshot.coverage?.rosters || 0) > 0 && (snapshot.coverage?.rostered_players || 0) === 0 ? <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-100"><span><strong>Roster players are missing from this cached snapshot.</strong> Refresh Yahoo data to reload team rosters.</span><button onClick={() => void refreshYahooSnapshot()} disabled={isRefreshingYahoo} className="font-bold text-amber-200 underline underline-offset-4 disabled:opacity-60">{isRefreshingYahoo ? 'Refreshing…' : 'Refresh now'}</button></div> : null}

        <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Data source health">
          <SourceHealth label="Yahoo identity match" value={`${snapshot.mapping_coverage?.mapped_roster_players ?? 0}/${snapshot.mapping_coverage?.rostered_players ?? snapshot.coverage?.rostered_players ?? 0}`} detail="Verified roster identities" tone="good" />
          <SourceHealth label="FantasyPros projections" value={`${[...teamProjection.values()].reduce((total, item) => total + item.covered, 0)}/${snapshot.mapping_coverage?.mapped_roster_players ?? 0}`} detail={projections?.snapshot_date ? `Snapshot ${projections.snapshot_date}` : 'No cached snapshot'} tone={projections?.rankings?.length ? 'good' : 'warning'} />
          <SourceHealth label="Yahoo free agents" value={`${snapshot.mapping_coverage?.mapped_available_players ?? 0}/${snapshot.mapping_coverage?.available_players ?? 0}`} detail="Available players with verified identities" tone="neutral" />
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-blue-400/25 bg-gradient-to-br from-blue-950/80 to-slate-900 p-6 shadow-xl shadow-black/20">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-300">My week {snapshot.scoreboard.week || '—'}</p>
            {myTeam && currentMatchup && opponent ? <>
              <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div><p className="text-lg font-bold">{myTeam.name}</p><p className="mt-1 text-3xl font-black">{number(myScoreboardTeam?.projected_points)}</p><p className="text-xs text-slate-400">projected points</p></div>
                <span className="rounded-full border border-slate-600 px-3 py-1 text-xs font-bold text-slate-300">vs</span>
                <div className="text-right"><p className="text-lg font-bold">{opponent.name}</p><p className="mt-1 text-3xl font-black">{number(opponent.projected_points)}</p><p className="text-xs text-slate-400">projected points</p></div>
              </div>
              <div className="mt-5 flex flex-wrap gap-2 text-sm">
                <Metric label="Projection edge" value={matchupProjection === null ? 'Not available' : `${matchupProjection >= 0 ? '+' : ''}${matchupProjection.toFixed(1)} pts`} tone={matchupProjection !== null && matchupProjection >= 0 ? 'good' : 'neutral'} />
                <Metric label="Live score" value={`${number(myScoreboardTeam?.points)} – ${number(opponent.points)}`} />
                <Metric label="Lineup status" value={`${startingCount} active / ${myRoster.length} rostered`} />
              </div>
            </> : <p className="mt-4 text-sm leading-6 text-slate-300">A current Yahoo matchup is not available in this snapshot. Your roster and league comparison are still ready below.</p>}
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Roster check</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Metric label="Rostered" value={String(myRoster.length)} />
              <Metric label="Active lineup" value={String(startingCount)} />
              <Metric label="Bench / IR" value={String(myRoster.length - startingCount)} />
              <Metric label="Standing" value={myTeam?.rank ? `#${myTeam.rank}` : '—'} />
            </div>
            <p className="mt-5 text-xs leading-5 text-slate-400">Projected points and live score are Yahoo signals. Roster counts come from each team’s saved lineup slots.</p>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-emerald-400/20 bg-emerald-950/20 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">Lineup advisor</p><h2 className="mt-1 text-xl font-black">Review the decisions that need attention first</h2></div><span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">Read-only guidance</span></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">This flags saved starters with current official injury reports and bench players whose available season projection per game exceeds a same-position starter. It does not make lineup changes or treat a season projection as a weekly forecast.</p>
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {lineupAdvice.injuredStarters.map(({ player, injury }) => <AdviceCard key={`injury-${player.id}`} tone="warning" title={`Review ${player.name}`} detail={`${player.selected_position || player.position} starter · ${injury!.report_status || injury!.practice_status || 'Reported'}${injury!.report_primary_injury ? ` · ${injury!.report_primary_injury}` : ''}`} />)}
            {lineupAdvice.benchUpside.map(({ signal, starter }) => <AdviceCard key={`upside-${signal.player.id}`} tone="good" title={`Compare ${signal.player.name} with ${starter.player.name}`} detail={`${signal.player.position} bench · ${signal.projectedPpg?.toFixed(1)} projected PPG vs ${starter.projectedPpg?.toFixed(1)} for the current starter · season projection only`} />)}
            {!lineupAdvice.injuredStarters.length && !lineupAdvice.benchUpside.length ? <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">No high-priority review signal is available from the saved lineup and currently matched sources. Projection gaps stay neutral rather than generating a recommendation.</p> : null}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-violet-400/20 bg-violet-950/20 p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-300">Waiver watch</p><h2 className="mt-1 text-xl font-black">Available players worth a closer look</h2></div><span className="rounded-full border border-violet-400/30 bg-violet-400/10 px-3 py-1 text-xs font-bold text-violet-200">League availability verified</span></div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">This is a read-only shortlist from the available Yahoo player pool, excluding everyone on a cached league roster, ordered by the cached FantasyPros season projection per game. It is not an automatic add recommendation; compare fit, injury risk, and current-week context before making a move.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{waiverTargets.map(({ player, projectedPpg }) => <div key={player.id} className="rounded-xl border border-violet-400/20 bg-slate-950/40 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-violet-100">{player.name}</p><p className="mt-1 text-xs text-slate-400">{player.position} · {player.team || 'FA'}</p></div><span className="text-right text-sm font-black text-violet-200">{projectedPpg.toFixed(1)}<span className="ml-1 text-[10px] font-bold uppercase text-slate-400">PPG</span></span></div><p className="mt-3 text-xs text-slate-400">Yahoo rostered: {typeof player.percent_owned === 'number' ? `${player.percent_owned.toFixed(0)}%` : 'Not available'}</p></div>)}{!waiverTargets.length ? <p className="rounded-xl border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-300">No available players currently have both a verified identity and a cached projection. Refresh sources to expand the local coverage.</p> : null}</div>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><ChartBarIcon className="h-5 w-5 text-orange-300" /><h2 className="text-xl font-black">League comparison</h2></div><label className="flex items-center gap-2 text-sm text-slate-300">Sort by <select value={sortBy} onChange={event => setSortBy(event.target.value as typeof sortBy)} className="rounded-lg border border-slate-600 bg-slate-900 px-2 py-1.5 font-semibold text-slate-100"><option value="standing">Standing</option><option value="projection">Projected season</option><option value="injuries">Fewest injuries</option></select></label></div>
          <p className="mt-1 text-sm text-slate-400">Standings, roster depth, and cached FantasyPros season-projection coverage at a glance.</p>
          <div className="mt-4 overflow-hidden rounded-xl border border-slate-700 bg-slate-900/70">
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="border-b border-slate-700 bg-slate-800/80 text-xs uppercase tracking-wide text-slate-400"><tr><th className="px-4 py-3">Team</th><th className="px-4 py-3">Record</th><th className="px-4 py-3 text-right">PF</th><th className="px-4 py-3 text-right">PA</th><th className="px-4 py-3 text-right">Roster</th><th className="px-4 py-3 text-right">Core depth</th><th className="px-4 py-3 text-right">Injuries</th><th className="px-4 py-3 text-right">Proj. season</th></tr></thead><tbody>{sortedTeams.map(team => {
              const roster = rosterByTeam.get(team.id) || []
              const depth = teamDepth.get(team.id)
              const projection = teamProjection.get(team.id)
              return <tr key={team.id} className={`border-b border-slate-800 last:border-0 ${team.is_current_user ? 'bg-blue-500/10' : ''}`}><td className="px-4 py-3 font-semibold"><button onClick={() => void openTeamDrawer(team.id)} className="text-left hover:text-blue-300 hover:underline">{team.rank ? <span className="mr-2 text-slate-500">#{team.rank}</span> : null}{team.name}</button>{team.is_current_user ? <span className="ml-2 rounded bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold text-white">YOU</span> : null}<span className="ml-2 text-xs font-normal text-slate-500">{team.owner || ''}</span></td><td className="px-4 py-3 text-slate-300">{team.wins ?? 0}-{team.losses ?? 0}{team.ties ? `-${team.ties}` : ''}</td><td className="px-4 py-3 text-right">{number(team.points_for)}</td><td className="px-4 py-3 text-right">{number(team.points_against)}</td><td className="px-4 py-3 text-right">{roster.length || '—'}</td><td className="px-4 py-3 text-right text-xs text-slate-300">{depth ? `QB ${depth.counts.QB || 0} · RB ${depth.counts.RB || 0} · WR ${depth.counts.WR || 0} · TE ${depth.counts.TE || 0}` : '—'}</td><td className={`px-4 py-3 text-right font-semibold ${depth?.injuryCount ? 'text-amber-300' : 'text-slate-300'}`}>{depth ? depth.injuryCount : '—'}</td><td className="px-4 py-3 text-right font-semibold">{projection?.covered ? <>{number(projection.total)} <span className="text-xs font-normal text-slate-500">({projection.covered}/{projection.rostered})</span></> : '—'}</td></tr>
            })}</tbody></table></div>
            <p className="border-t border-slate-800 px-4 py-3 text-xs leading-5 text-slate-400">Projected season totals use only rostered players matched to cached FantasyPros projections. Injury counts use current official reports matched to each roster. Coverage gaps are omitted, not estimated; these are roster-strength signals, not weekly matchup projections.</p>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><UserGroupIcon className="h-5 w-5 text-emerald-300" /><h2 className="font-black">Roster inspector</h2></div><select aria-label="Inspect team roster" value={inspectedTeam?.id || ''} onChange={event => void openTeamDrawer(event.target.value)} className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm font-semibold text-slate-100">{snapshot.teams.map(team => <option key={team.id} value={team.id}>{team.name}{team.is_current_user ? ' (You)' : ''}</option>)}</select></div><p className="mt-1 text-sm text-slate-400">{inspectedTeam?.is_current_user ? 'Your roster and assigned lineup slots.' : `${inspectedTeam?.name || 'Selected team'} roster.`} Select a team for projections and recent production.</p><div className="mt-4 flex flex-wrap gap-2">{inspectedRoster.length ? inspectedRoster.map(player => <button type="button" onClick={() => inspectedTeam && void openTeamDrawer(inspectedTeam.id)} key={player.id} className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-left text-xs hover:border-emerald-400/50"><span className="font-bold">{player.name}</span> <span className="text-slate-400">{player.position} · {player.selected_position || '—'}</span></button>) : <p className="text-sm text-slate-400">No roster data was included in this snapshot.</p>}</div></div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-5"><div className="flex items-center gap-2"><ExclamationTriangleIcon className="h-5 w-5 text-amber-300" /><h2 className="font-black">Recent league activity</h2></div><div className="mt-3 space-y-2">{snapshot.transactions.slice(0, 6).map(item => <div key={item.id} className="rounded-lg bg-slate-800/80 p-3 text-sm"><span className="font-bold capitalize">{item.type}</span><span className="text-slate-400"> · {item.players.map(player => `${player.action} ${player.name}`).filter(Boolean).join(' / ') || 'No player details'}</span></div>)}{snapshot.transactions.length === 0 && <p className="text-sm text-slate-400">No transactions were stored in this snapshot.</p>}</div></div>
        </section>
        <section className="mt-4 rounded-xl border border-slate-700 bg-slate-900/70 p-5"><div className="flex items-center gap-2"><ExclamationTriangleIcon className="h-5 w-5 text-amber-300" /><h2 className="font-black">Roster availability</h2></div><p className="mt-1 text-sm text-slate-400">Current official injury reports matched to your cached Yahoo roster.</p><div className="mt-4 flex flex-wrap gap-2">{myInjuries.length ? myInjuries.map(({ player, injury }) => <div key={player.id} className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm"><span className="font-bold text-amber-100">{player.name}</span><span className="ml-2 text-amber-300">{injury.report_status || injury.practice_status || 'Reported'}</span><span className="ml-2 text-xs text-slate-400">{injury.report_primary_injury || ''}</span></div>) : <p className="text-sm text-slate-400">No current official injury reports were matched to your roster.</p>}</div></section>
      </div>
      {drawerTeamId && drawerTeam ? <TeamRosterDrawer team={drawerTeam} starters={drawerStarters} bench={drawerBench} projectionSummary={teamProjection.get(drawerTeamId)} isLoading={isLoadingTeam} error={teamDetailError} projectionDate={projections?.snapshot_date || null} statsSeasons={teamDetail?.stats_seasons || []} onClose={() => setDrawerTeamId(null)} /> : null}
    </div>
  )
}

const Metric: React.FC<{ label: string; value: string; tone?: 'good' | 'neutral' }> = ({ label, value, tone = 'neutral' }) => <div className="rounded-lg border border-slate-700 bg-slate-950/40 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</p><p className={`mt-1 font-bold ${tone === 'good' ? 'text-emerald-300' : 'text-slate-100'}`}>{value}</p></div>

const SourceHealth: React.FC<{ label: string; value: string; detail: string; tone: 'good' | 'neutral' | 'warning' }> = ({ label, value, detail, tone }) => <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4"><div className="flex items-center justify-between gap-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p><span className={`h-2 w-2 rounded-full ${tone === 'good' ? 'bg-emerald-400' : tone === 'warning' ? 'bg-amber-400' : 'bg-slate-400'}`} /></div><p className="mt-2 text-xl font-black">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>

const AdviceCard: React.FC<{ title: string; detail: string; tone: 'good' | 'warning' }> = ({ title, detail, tone }) => <div className={`rounded-xl border p-4 ${tone === 'warning' ? 'border-amber-400/30 bg-amber-400/10' : 'border-emerald-400/30 bg-emerald-400/10'}`}><p className={`font-bold ${tone === 'warning' ? 'text-amber-100' : 'text-emerald-100'}`}>{title}</p><p className="mt-1 text-sm leading-5 text-slate-300">{detail}</p></div>

const TeamRosterDrawer: React.FC<{
  team: YahooTeam
  starters: DrawerRow[]
  bench: DrawerRow[]
  projectionSummary?: { total: number; covered: number; rostered: number }
  isLoading: boolean
  error: string | null
  projectionDate: string | null
  statsSeasons: number[]
  onClose: () => void
}> = ({ team, starters, bench, projectionSummary, isLoading, error, projectionDate, statsSeasons, onClose }) => {
  const injuries = [...starters, ...bench].filter(row => row.injury).length
  return <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="team-roster-title">
    <button type="button" aria-label="Close team roster" onClick={onClose} className="absolute inset-0 bg-slate-950/75 backdrop-blur-sm" />
    <aside className="relative flex h-full w-full max-w-3xl flex-col border-l border-slate-700 bg-slate-950 shadow-2xl shadow-black">
      <header className="sticky top-0 z-10 border-b border-slate-700 bg-slate-950/95 px-5 py-5 backdrop-blur sm:px-7">
        <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">Team roster</p><h2 id="team-roster-title" className="mt-1 text-2xl font-black">{team.name}</h2><p className="mt-1 text-sm text-slate-400">{team.owner || 'Manager'} · {team.wins ?? 0}-{team.losses ?? 0}{team.ties ? `-${team.ties}` : ''}{team.rank ? ` · #${team.rank}` : ''}</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 hover:text-white"><XMarkIcon className="h-5 w-5" /></button></div>
        <div className="mt-4 grid grid-cols-3 gap-2"><Metric label="Projected season" value={projectionSummary?.covered ? number(projectionSummary.total) : 'No data'} /><Metric label="Projection coverage" value={`${projectionSummary?.covered || 0}/${projectionSummary?.rostered || starters.length + bench.length}`} /><Metric label="Injury reports" value={String(injuries)} /></div>
        <div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide"><span className="rounded bg-blue-400/10 px-2 py-1 text-blue-200">Yahoo lineup</span><span className="rounded bg-violet-400/10 px-2 py-1 text-violet-200">FantasyPros projection {projectionDate || 'unavailable'}</span><span className="rounded bg-emerald-400/10 px-2 py-1 text-emerald-200">nflverse recent stats {statsSeasons.filter(Boolean).join('/') || 'unavailable'}</span></div>
      </header>
      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
        {isLoading ? <div className="space-y-3" aria-label="Loading team statistics">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-slate-800" />)}</div> : error ? <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">{error} The saved Yahoo lineup is still shown below.</div> : null}
        <RosterGroup title="Starting lineup" rows={starters} />
        <RosterGroup title="Bench and reserve" rows={bench} />
      </div>
    </aside>
  </div>
}

const RosterGroup: React.FC<{ title: string; rows: DrawerRow[] }> = ({ title, rows }) => <section className="mb-7"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-black uppercase tracking-wider text-slate-300">{title}</h3><span className="text-xs text-slate-500">{rows.length} players</span></div><div className="space-y-2">{rows.map(({ player, projection, injury, headshot, recent }) => <article key={player.id} className="grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(120px,0.6fr)_minmax(110px,0.45fr)] sm:items-center"><div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-xs font-black text-slate-400">{headshot ? <img src={headshot} alt="" className="h-full w-full object-cover" /> : player.position}</div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-bold text-slate-100">{player.name}</p>{injury ? <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-amber-300">{injury.report_status || injury.practice_status || 'Injury'}</span> : null}</div><p className="mt-0.5 text-xs text-slate-400">{player.selected_position || player.position} · {player.position} · {player.team || 'FA'}{injury?.report_primary_injury ? ` · ${injury.report_primary_injury}` : ''}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Recent</p><p className="mt-1 text-xs font-semibold text-slate-300">{recent}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">Projection</p><p className="mt-1 text-sm font-black text-violet-200">{projection?.projected_points_per_game != null ? `${projection.projected_points_per_game.toFixed(1)} PPG` : 'No data'}</p><p className="text-[10px] text-slate-500">{projection?.projected_points != null ? `${projection.projected_points.toFixed(1)} season` : 'Coverage missing'}</p></div></article>)}{!rows.length ? <p className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">No players in this group.</p> : null}</div></section>

const EmptyState: React.FC<{ title: string; copy: string; action?: React.ReactNode }> = ({ title, copy, action }) => <div className="min-h-[calc(100vh-3rem)] bg-slate-950 px-6 py-20 text-slate-100"><div className="mx-auto max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-8"><h1 className="text-2xl font-black">{title}</h1><p className="mt-3 leading-6 text-slate-400">{copy}</p>{action ? <div className="mt-6">{action}</div> : null}</div></div>
