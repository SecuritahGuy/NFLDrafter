import { useMemo, useState } from 'react'
import { MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline'
import { useScoringProfiles } from '../hooks/useScoringProfiles'
import { usePlayers } from '../hooks/usePlayers'
import { useProjectionAnalytics, useRankings } from '../hooks/useRankings'
import { buildCompositeRankings } from '../services/compositeRankings'
import { PlayerDetailDrawer } from './PlayerDetailDrawer'
import type { Player } from '../types'

const seasons = [2026, 2025, 2024, 2023, 2022]
const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']

export function PlayerExplorer() {
  const [selectedSeason, setSelectedSeason] = useState(2026)
  const [selectedProfile, setSelectedProfile] = useState('')
  const [selectedPosition, setSelectedPosition] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [visibleCount, setVisibleCount] = useState(100)

  const { data: profilesData } = useScoringProfiles()
  const { data: backendPlayers, isLoading } = usePlayers({
    limit: 1200,
    current_only: selectedSeason === 2026,
    season: selectedSeason,
  })
  const { data: fantasyPros } = useRankings('fantasypros-ecr')
  const { data: espn } = useRankings('espn-draft-rank')
  const { data: ffc } = useRankings('ffc-adp')
  const { data: projectionAnalytics } = useProjectionAnalytics(selectedProfile, selectedSeason)

  const players = useMemo(() => {
    const rows = backendPlayers ?? []
    const analytics = new Map(
      (projectionAnalytics?.players ?? []).map((row) => [row.player_id, row]),
    )
    const composite = buildCompositeRankings(
      rows,
      fantasyPros?.rankings ?? [],
      espn?.rankings ?? [],
      ffc?.rankings ?? [],
    )
    return rows.map((player): Player => {
      const ranking = composite.get(player.player_id)
      const projection = analytics.get(player.player_id)
      return {
        id: player.player_id,
        name: player.full_name,
        position: player.position === 'PK' ? 'K' : player.position,
        team: player.team,
        fantasyPoints: projection?.analytics_points ?? 0,
        yahooPoints: 0,
        delta: projection?.profile_points != null && projection.espn_points != null
          ? projection.profile_points - projection.espn_points : 0,
        vorp: projection?.vorp ?? 0,
        tier: projection?.tier ?? 0,
        adp: ranking?.ffc?.ecr ?? 0,
        newsCount: 0,
        byeWeek: ranking?.ffc?.bye ?? ranking?.fantasyPros?.bye ?? 0,
        rank: ranking?.rank,
        ecr: ranking?.fantasyPros?.ecr ?? undefined,
        espnRank: ranking?.espn?.rank ?? undefined,
        rankingSourceCount: ranking?.sourceCount ?? 0,
        projectedPoints: ranking?.espn?.projected_points ?? undefined,
        projectedPointsPerGame: ranking?.espn?.projected_points_per_game ?? undefined,
        projectionScoringBasis: projection?.scoring_basis,
        replacementRank: projection?.replacement_rank,
        replacementPoints: projection?.replacement_points,
        positionProjectionRank: projection?.position_rank,
        status: player.status,
        lastSeason: player.last_season,
        headshot: player.headshot,
      }
    })
  }, [backendPlayers, espn, fantasyPros, ffc, projectionAnalytics])

  const filteredPlayers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return players
      .filter((player) => selectedPosition === 'ALL' || player.position === selectedPosition)
      .filter((player) => !query || `${player.name} ${player.team} ${player.position}`.toLowerCase().includes(query))
      .sort((a, b) => (a.rank ?? Number.MAX_SAFE_INTEGER) - (b.rank ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name))
  }, [players, searchQuery, selectedPosition])

  const profileId = profilesData?.find((profile) => profile.profile_id === selectedProfile)?.profile_id

  return (
    <div className="container space-y-5">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <header className="flex flex-col gap-3 border-b border-slate-200 bg-gradient-to-r from-slate-950 to-blue-950 px-6 py-6 text-white md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.22em] text-blue-300">Current player universe</div>
            <h2 className="mt-1 text-3xl font-black">Player Explorer</h2>
            <p className="mt-1 text-sm text-slate-300">Search every active fantasy-relevant player and inspect source-level draft intelligence.</p>
          </div>
          <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-right">
            <div className="text-2xl font-black">{players.length}</div>
            <div className="text-xs text-slate-300">players loaded</div>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 border-b border-slate-200 bg-slate-50 p-5 md:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">Season
            <select value={selectedSeason} onChange={(event) => setSelectedSeason(Number(event.target.value))} className="input mt-2">
              {seasons.map((season) => <option key={season}>{season}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Position
            <select value={selectedPosition} onChange={(event) => { setSelectedPosition(event.target.value); setVisibleCount(100) }} className="input mt-2">
              {positions.map((position) => <option key={position} value={position}>{position === 'ALL' ? 'All positions' : position}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Scoring profile
            <select value={selectedProfile} onChange={(event) => setSelectedProfile(event.target.value)} className="input mt-2">
              <option value="">Draft ranks only</option>
              {profilesData?.map((profile) => <option key={profile.profile_id} value={profile.profile_id}>{profile.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">Search
            <div className="relative mt-2">
              <MagnifyingGlassIcon className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input value={searchQuery} onChange={(event) => { setSearchQuery(event.target.value); setVisibleCount(100) }} placeholder="Name, team, position…" className="input pl-9" />
            </div>
          </label>
        </div>

        <div className="max-h-[68vh] overflow-auto">
          <table className="w-full min-w-[980px]">
            <thead className="sticky top-0 z-10 bg-white text-left text-xs font-bold uppercase tracking-wider text-slate-500 shadow-sm">
              <tr><th className="px-5 py-3">Player</th><th>Pos</th><th>Team</th><th>Consensus</th><th>Profile proj.</th><th>Tier</th><th>VORP</th><th>FantasyPros</th><th>ESPN</th><th>ADP</th><th className="pr-5 text-right">Details</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr><td colSpan={11} className="p-10 text-center text-slate-500">Loading the current player universe…</td></tr>
              ) : filteredPlayers.slice(0, visibleCount).map((player) => (
                <tr key={player.id} className="cursor-pointer hover:bg-blue-50" onClick={() => setSelectedPlayer(player)}>
                  <td className="px-5 py-3"><div className="flex items-center gap-3">
                    {player.headshot ? <img src={player.headshot} alt="" className="h-10 w-10 rounded-xl bg-slate-100 object-cover object-top" /> : <UserCircleIcon className="h-10 w-10 text-slate-300" />}
                    <div><div className="font-bold text-slate-950">{player.name}</div><div className="text-xs text-slate-500">{player.status ?? 'Roster status unknown'}</div></div>
                  </div></td>
                  <td className="font-semibold text-slate-700">{player.position}</td><td className="text-slate-700">{player.team}</td>
                  <td className="font-black text-blue-800">{player.rank ? `#${player.rank}` : '—'}</td>
                  <td className="font-bold text-violet-800">{player.fantasyPoints ? player.fantasyPoints.toFixed(1) : '—'}</td>
                  <td>{player.tier ? `T${player.tier}` : '—'}</td>
                  <td className={player.vorp > 0 ? 'font-bold text-emerald-700' : 'text-slate-500'}>{player.tier ? player.vorp.toFixed(1) : '—'}</td>
                  <td>{player.ecr ? `#${Math.round(player.ecr)}` : '—'}</td><td>{player.espnRank ? `#${player.espnRank}` : '—'}</td><td>{player.adp ? player.adp.toFixed(1) : '—'}</td>
                  <td className="pr-5 text-right"><button className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800" onClick={(event) => { event.stopPropagation(); setSelectedPlayer(player) }}>View profile</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm text-slate-600">
          <span>Showing {Math.min(visibleCount, filteredPlayers.length)} of {filteredPlayers.length}</span>
          {visibleCount < filteredPlayers.length && <button className="font-bold text-blue-700" onClick={() => setVisibleCount((count) => count + 100)}>Show 100 more</button>}
        </footer>
      </section>
      <PlayerDetailDrawer player={selectedPlayer} season={selectedSeason} profileId={profileId} onClose={() => setSelectedPlayer(null)} />
    </div>
  )
}
