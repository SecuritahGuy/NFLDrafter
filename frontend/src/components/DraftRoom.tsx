import React, { useState, useMemo, useEffect, useRef } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { PlayerBoard } from './PlayerBoard'
import { Watchlist } from './Watchlist'
import { ProjectionAnalyticsPanel } from './ProjectionAnalyticsPanel'
import { RosterBar } from './RosterBar'
import { YahooOAuth } from './YahooOAuth'
import { YahooLeagueImport } from './YahooLeagueImport'
import { ToastProvider, useToast } from './Toast'
import { LoadingState } from './LoadingState'
import { ErrorDisplay } from './ErrorDisplay'
import type { Player } from '../types'
import { useInjuries, usePlayers } from '../hooks/usePlayers'
import { useScoringProfiles } from '../hooks/useScoringProfiles'
import { api, rankingsAPI, type BackendPlayer, type SourceRefreshResponse } from '../api'
import { ManualDraftConsole } from './ManualDraftConsole'
import { useDraftSession } from '../hooks/useDraftSession'
import { useProjectionAnalytics, useRankings, useRankingSources } from '../hooks/useRankings'
import { assignRosterSlots, teamForPick, type DraftNewsSignal, type DraftPick } from '../services/draftEngine'
import { buildCompositeRankings } from '../services/compositeRankings'
import { PlayerDetailDrawer } from './PlayerDetailDrawer'
import { NewsInsightsPanel } from './NewsInsightsPanel'
import {
  createDraftPackage,
  loadDraftPackage,
  saveDraftPackage,
  type DraftPackageV1,
} from '../services/draftPackage'

const BASE_ROSTER_SLOTS = [
  { position: 'QB', required: 1, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
  { position: 'RB', required: 2, filled: 0, byeWeeks: [], scarcity: 'high' as const },
  { position: 'WR', required: 2, filled: 0, byeWeeks: [], scarcity: 'high' as const },
  { position: 'TE', required: 1, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
  { position: 'FLEX', required: 1, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
  { position: 'K', required: 1, filled: 0, byeWeeks: [], scarcity: 'low' as const },
  { position: 'DEF', required: 1, filled: 0, byeWeeks: [], scarcity: 'low' as const },
  { position: 'BN', required: 6, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
]

const rosterScarcity = (position: string): 'low' | 'medium' | 'high' => {
  if (position === 'RB' || position === 'WR') return 'high'
  if (position === 'K' || position === 'DEF' || position === 'DST') return 'low'
  return 'medium'
}

type WorkspacePanel = 'tracker' | 'yahoo' | 'roster' | 'insights' | null

interface YahooSnapshotPlayer {
  id: string
  name: string
  position: string
  team: string
  average_pick?: number
  average_round?: number
  percent_owned?: number
  percent_drafted?: number
  named_stats?: Record<string, number>
}

interface YahooLiveDraftResult {
  pick: number
  team_id: string
  player_id: string
}

interface YahooLiveDraftTeam {
  id: string
  name: string
  draft_position: number
  is_current_user: boolean
}

interface YahooLiveDraftResponse {
  fetched_at: number
  draft_status: string
  draft_started: boolean
  my_team_id: string | null
  teams: YahooLiveDraftTeam[]
  draft_results: YahooLiveDraftResult[]
}

const yahooNumericId = (value: string | undefined | null) => String(value || '').split('.').pop() || ''

const WorkspaceModal: React.FC<{
  title: string
  eyebrow: string
  onClose: () => void
  children: React.ReactNode
}> = ({ title, eyebrow, onClose, children }) => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/80 p-3 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="fixed inset-0 cursor-default" aria-label={`Close ${title}`} onClick={onClose} />
      <section className="relative z-10 my-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-white/15 bg-slate-100 shadow-2xl">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-700 bg-slate-950 px-5 py-4 text-white">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-300">{eyebrow}</div>
            <h2 className="mt-1 text-xl font-black">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/20">Close</button>
        </header>
        <div className="max-h-[calc(100vh-7rem)] overflow-y-auto p-4 sm:p-6">{children}</div>
      </section>
    </div>
  )
}

export const DraftRoom: React.FC = () => {
  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
      <ToastProvider>
        <DraftRoomContent />
      </ToastProvider>
    </div>
  )
}

const DraftRoomContent: React.FC = () => {
  const { addToast } = useToast()
  const queryClient = useQueryClient()
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [scoringProfile, setScoringProfile] = useState<string>('')
  const [importedADP, setImportedADP] = useState<Record<string, number>>({})
  const [playerNotes, setPlayerNotes] = useState<Record<string, string>>({})
  const [selectedDetailPlayer, setSelectedDetailPlayer] = useState<Player | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [draftPackage, setDraftPackage] = useState<DraftPackageV1 | null>(loadDraftPackage)
  const [activePanel, setActivePanel] = useState<WorkspacePanel>(null)
  const [isRefreshingSources, setIsRefreshingSources] = useState(false)
  const [sourceRefreshResult, setSourceRefreshResult] = useState<SourceRefreshResponse | null>(null)
  const [rosterDefinitions, setRosterDefinitions] = useState(() =>
    draftPackage?.rosterSlots.map((slot) => ({
      ...slot, filled: 0, byeWeeks: [] as number[], scarcity: rosterScarcity(slot.position),
    })) ?? BASE_ROSTER_SLOTS
  )
  const { session, draftPlayer, undo, removePick, syncDraftPicks, configure, reset } = useDraftSession()
  const { data: fantasyProsRankings } = useRankings('fantasypros-ecr')
  const { data: espnRankings } = useRankings('espn-draft-rank')
  const { data: ffcRankings } = useRankings('ffc-adp')
  const { data: rankingSources } = useRankingSources()
  const { data: newsDraftSignals = {} } = useQuery({
    queryKey: ['news-draft-signals'],
    queryFn: async () => {
      const response = await api.get<{ signals: Array<{ player_id: string } & DraftNewsSignal> }>('/news/insights/draft-signals', { params: { days: 30 } })
      return Object.fromEntries(response.data.signals.map(({ player_id, ...signal }) => [player_id, signal])) as Record<string, DraftNewsSignal>
    },
    staleTime: 10 * 60 * 1000,
  })
  
  // Yahoo OAuth state
  const [yahooAccessToken, setYahooAccessToken] = useState<string | null>(() => localStorage.getItem('yahoo_access_token'))
  const [yahooRefreshToken, setYahooRefreshToken] = useState<string | null>(() => localStorage.getItem('yahoo_refresh_token'))
  const [selectedLeague, setSelectedLeague] = useState<any>(() => {
    try {
      return JSON.parse(localStorage.getItem('yahoo_selected_league') || 'null')
    } catch {
      return null
    }
  })
  const [yahooSnapshot, setYahooSnapshot] = useState<any>(null)
  const [yahooLiveStatus, setYahooLiveStatus] = useState<'waiting' | 'live' | 'error' | null>(null)
  const [yahooLiveTeams, setYahooLiveTeams] = useState<YahooLiveDraftTeam[]>([])
  const yahooPickSignature = useRef('')
  
  // Real data from backend API
  const currentSeason = 2026

  useEffect(() => {
    if (!selectedLeague?.id) return
    fetch(`/api/yahoo/leagues/${selectedLeague.id}/snapshot`)
      .then((response) => response.ok ? response.json() : null)
      .then(setYahooSnapshot)
      .catch(() => setYahooSnapshot(null))
  }, [selectedLeague?.id, sourceRefreshResult?.completed_at])
  
  // Fetch scoring profiles
  const { data: scoringProfiles, isLoading: profilesLoading } = useScoringProfiles()
  
  // Get the selected scoring profile ID
  const selectedProfile = useMemo(() => {
    if (!scoringProfiles) return null
    return scoringProfiles.find(profile => profile.name === scoringProfile)
  }, [scoringProfiles, scoringProfile])
  
  // Fetch the complete player board once; position and search filters run locally.
  const { data: players, isLoading: playersLoading, error: playersError } = usePlayers({
    limit: 1200,
    current_only: true,
    season: currentSeason,
  })
  const playerIdByYahooId = useMemo(() => new Map(
    (players ?? [])
      .filter((player) => Boolean(player.yahoo_id))
      .map((player) => [yahooNumericId(player.yahoo_id), player.player_id]),
  ), [players])

  useEffect(() => {
    if (!yahooAccessToken || !selectedLeague?.id || !players?.length) {
      setYahooLiveStatus(null)
      return
    }

    let cancelled = false
    const pollLiveDraft = async () => {
      try {
        const response = await api.post<YahooLiveDraftResponse>(
          `/yahoo/leagues/${selectedLeague.id}/draft-results`,
          undefined,
          { headers: { Authorization: `Bearer ${yahooAccessToken}` } },
        )
        if (cancelled) return
        const data = response.data
        setYahooLiveStatus(data.draft_started ? 'live' : 'waiting')
        setYahooLiveTeams(data.teams)
        setYahooSnapshot((current: any) => current ? {
          ...current,
          draft_results: data.draft_results,
          metadata: { ...current.metadata, draft_status: data.draft_status },
        } : current)
        if (!data.draft_started) return

        const syncedPicks: DraftPick[] = data.draft_results
          .filter((result) => Number.isInteger(result.pick) && result.pick > 0)
          .sort((left, right) => left.pick - right.pick)
          .map((result) => {
            const playerId = playerIdByYahooId.get(yahooNumericId(result.player_id))
              ?? `yahoo-unmatched:${result.player_id}`
            return {
              pick: result.pick,
              playerId,
              team: data.teams.find((team) => team.id === result.team_id)?.draft_position
                || teamForPick(result.pick, session.config.leagueSize),
              isMine: data.my_team_id
                ? result.team_id === data.my_team_id
                : teamForPick(result.pick, session.config.leagueSize) === session.config.draftSlot,
              madeAt: new Date(data.fetched_at * 1000).toISOString(),
            }
          })
        const signature = syncedPicks.map((pick) => `${pick.pick}:${pick.playerId}:${pick.team}:${pick.isMine}`).join('|')
        if (signature !== yahooPickSignature.current) {
          yahooPickSignature.current = signature
          syncDraftPicks(syncedPicks)
        }
      } catch {
        if (!cancelled) setYahooLiveStatus('error')
      }
    }

    void pollLiveDraft()
    const interval = window.setInterval(() => void pollLiveDraft(), 10_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [playerIdByYahooId, players?.length, selectedLeague?.id, session.config.draftSlot, session.config.leagueSize, syncDraftPicks, yahooAccessToken])
  const { data: injuries } = useInjuries(currentSeason)
  const injuriesByPlayer = useMemo(() => {
    const grouped = new Map<string, import('../api').InjuryReportEntry[]>()
    for (const injury of injuries ?? []) {
      if (!injury.player_id) continue
      const entries = grouped.get(injury.player_id) ?? []
      entries.push(injury)
      grouped.set(injury.player_id, entries)
    }
    return grouped
  }, [injuries])

  const compositeRankings = useMemo(() => {
    return buildCompositeRankings(
      players ?? [],
      fantasyProsRankings?.rankings ?? [],
      espnRankings?.rankings ?? [],
      ffcRankings?.rankings ?? [],
    )
  }, [espnRankings, fantasyProsRankings, ffcRankings, players])

  const projectionConfig = useMemo(() => {
    const count = (position: string) => rosterDefinitions
      .filter((slot) => slot.position === position)
      .reduce((sum, slot) => sum + slot.required, 0)
    return {
      league_size: session.config.leagueSize,
      qb: count('QB'), rb: count('RB'), wr: count('WR'), te: count('TE'),
      flex: count('FLEX'), superflex: count('SUPERFLEX') + count('SF'),
      k: count('K'), defense: count('DEF') + count('DST'),
    }
  }, [rosterDefinitions, session.config.leagueSize])
  const {
    data: projectionAnalytics,
    isLoading: projectionsLoading,
    error: projectionsError,
  } = useProjectionAnalytics(selectedProfile?.profile_id || '', currentSeason, projectionConfig)
  
  // Combine player data with calculated points
  const enrichedPlayers: Player[] = useMemo(() => {
    if (!players) return []
    
    const analyticsByPlayer = new Map(
      (projectionAnalytics?.players ?? []).map((row) => [row.player_id, row]),
    )
    const yahooRows = (yahooSnapshot?.players ?? []) as YahooSnapshotPlayer[]
    const yahooById = new Map<string, YahooSnapshotPlayer>(
      yahooRows.map((row) => [String(row.id).split('.').pop() ?? row.id, row]),
    )
    const yahooByIdentity = new Map<string, YahooSnapshotPlayer>(
      yahooRows.map((row) => [`${row.name}|${row.position}|${row.team}`, row]),
    )
    return players.map((player: BackendPlayer) => {
      const projection = analyticsByPlayer.get(player.player_id)
      const fantasyPoints = projection?.analytics_points ?? 0
      const yahooPoints = projection?.espn_points ?? 0
      const composite = compositeRankings.get(player.player_id)
      const fantasyPros = composite?.fantasyPros
      const espn = composite?.espn
      const ffc = composite?.ffc
      const yahoo = yahooById.get(String(player.yahoo_id || ''))
        ?? yahooByIdentity.get(`${player.full_name}|${player.position}|${player.team}`)
      
      return {
        id: player.player_id,
        name: player.full_name, // Backend returns full_name
        position: player.position,
        team: player.team,
        fantasyPoints,
        yahooPoints,
        delta: projection?.profile_points != null && projection.espn_points != null
          ? projection.profile_points - projection.espn_points : 0,
        vorp: projection?.vorp ?? 0,
        tier: projection?.tier ?? 0,
        adp: ffc?.ecr ?? 0,
        newsCount: 0, // TODO: Get news count
        byeWeek: ffc?.bye ?? fantasyPros?.bye ?? 0,
        rank: composite?.rank,
        ecr: fantasyPros?.ecr ?? undefined,
        espnRank: espn?.rank ?? undefined,
        rankingSourceCount: composite?.sourceCount ?? 0,
        draftConfidence: composite?.confidence,
        projectedPoints: espn?.projected_points ?? undefined,
        projectedPointsPerGame: espn?.projected_points_per_game ?? undefined,
        projectionScoringBasis: projection?.scoring_basis,
        replacementRank: projection?.replacement_rank,
        replacementPoints: projection?.replacement_points,
        positionProjectionRank: projection?.position_rank,
        status: player.status,
        lastSeason: player.last_season,
        headshot: player.headshot,
        yahooAveragePick: yahoo?.average_pick || undefined,
        yahooAverageRound: yahoo?.average_round || undefined,
        yahooPercentOwned: yahoo?.percent_owned || undefined,
        yahooPercentDrafted: yahoo?.percent_drafted || undefined,
        yahooSeasonStats: yahoo?.named_stats || undefined,
      }
    })
  }, [compositeRankings, players, projectionAnalytics, yahooSnapshot])

  const effectivePlayers = enrichedPlayers.length
    ? enrichedPlayers
    : draftPackage?.players ?? []
  const hasProjectionData = effectivePlayers.some((player) => (player.fantasyPoints ?? 0) !== 0)

  const draftedPlayerIds = useMemo(
    () => new Set(session.picks.map((pick) => pick.playerId)),
    [session.picks],
  )
  const availablePlayers = useMemo(
    () => effectivePlayers.filter((player) => !draftedPlayerIds.has(player.id)),
    [draftedPlayerIds, effectivePlayers],
  )
  const liveDraftRosters = useMemo(() => {
    const playersById = new Map(effectivePlayers.map((player) => [player.id, player]))
    return yahooLiveTeams
      .filter((team) => team.draft_position > 0)
      .sort((left, right) => left.draft_position - right.draft_position)
      .map((team) => ({
        ...team,
        picks: session.picks
          .filter((pick) => pick.team === team.draft_position)
          .map((pick) => playersById.get(pick.playerId)?.name ?? 'Yahoo player'),
      }))
  }, [effectivePlayers, session.picks, yahooLiveTeams])
  const myPlayers = useMemo(() => {
    const ids = new Set(session.picks.filter((pick) => pick.isMine).map((pick) => pick.playerId))
    return effectivePlayers.filter((player) => ids.has(player.id))
  }, [effectivePlayers, session.picks])
  const rosterSlots = useMemo(() => {
    const assignments = assignRosterSlots(myPlayers, rosterDefinitions)
    return rosterDefinitions.map((slot) => ({
      ...slot,
      filled: assignments[slot.position]?.length ?? 0,
      byeWeeks: (assignments[slot.position] ?? []).map((player) => player.byeWeek),
    }))
  }, [myPlayers, rosterDefinitions])
  const currentPick = session.picks.length + 1
  const isMyTurn = teamForPick(currentPick, session.config.leagueSize) === session.config.draftSlot
  const currentRound = Math.min(session.config.rounds, Math.ceil(currentPick / session.config.leagueSize))
  const currentTeam = teamForPick(currentPick, session.config.leagueSize)
  const myPickCount = session.picks.filter((pick) => pick.isMine).length
  const filledRosterSlots = rosterSlots.reduce((sum, slot) => sum + slot.filled, 0)
  const totalRosterSlots = rosterSlots.reduce((sum, slot) => sum + slot.required, 0)
  
  // Set default scoring profile when data loads
  useEffect(() => {
    if (scoringProfiles && scoringProfiles.length > 0 && !scoringProfile) {
      setScoringProfile(scoringProfiles[0].name)
    } else if (!scoringProfile && draftPackage) {
      setScoringProfile(draftPackage.scoringProfile.name)
    }
  }, [draftPackage, scoringProfiles, scoringProfile])

  useEffect(() => {
    if (!enrichedPlayers.length || !selectedProfile) return
    const prepared = createDraftPackage({
      season: currentSeason,
      scoringProfile: {
        profileId: selectedProfile.profile_id,
        name: selectedProfile.name,
        rules: selectedProfile.rules.map((rule) => ({
          statKey: rule.stat_key,
          multiplier: rule.multiplier,
          per: rule.per,
        })),
      },
      league: session.config,
      rosterSlots: rosterDefinitions.map(({ position, required }) => ({ position, required })),
      players: enrichedPlayers,
    })
    setDraftPackage(prepared)
    saveDraftPackage(prepared)
  }, [enrichedPlayers, rosterDefinitions, selectedProfile, session.config])

  // Loading and error states
  const isLoading = (profilesLoading || playersLoading || projectionsLoading) && !effectivePlayers.length
  const hasError = !effectivePlayers.length && Boolean(
    (!profilesLoading && !playersLoading && !projectionsLoading && (!players || !scoringProfiles))
    || playersError
    || projectionsError
  )

  const handlePlayerSelect = (player: Player) => {
    setSelectedDetailPlayer(player)
  }



  const handleAddToWatchlist = (player: Player) => {
    if (!watchlist.includes(player.id)) {
      setWatchlist(prev => [...prev, player.id])
      addToast({
        type: 'success',
        title: 'Added to Watchlist',
        message: `${player.name} has been added to your watchlist`,
        duration: 3000
      })
    }
  }

  const handleRemoveFromWatchlist = (playerId: string) => {
    const player = effectivePlayers.find(p => p.id === playerId)
    setWatchlist(prev => prev.filter(id => id !== playerId))
    if (player) {
      addToast({
        type: 'info',
        title: 'Removed from Watchlist',
        message: `${player.name} has been removed from your watchlist`,
        duration: 3000
      })
    }
  }

  const handleADPImport = (adpData: any[]) => {
    const adpMap: Record<string, number> = {}
    adpData.forEach(item => {
      adpMap[item.playerName] = item.adp
    })
    setImportedADP(adpMap)
  }

  const handlePlayerNotesChange = (playerId: string, notes: string) => {
    setPlayerNotes(prev => ({ ...prev, [playerId]: notes }))
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    // Simulate retry - in real app this would refetch data
    setTimeout(() => {
      setLoading(false)
    }, 1000)
  }

  // Yahoo OAuth handlers
  const handleAuthSuccess = (accessToken: string, refreshToken: string) => {
    setYahooAccessToken(accessToken)
    setYahooRefreshToken(refreshToken)
    addToast({
      type: 'success',
      title: 'Connected to Yahoo!',
      message: 'Successfully connected to Yahoo Fantasy Football',
      duration: 5000
    })
  }

  const handleAuthError = (error: string) => {
    addToast({
      type: 'error',
      title: 'Yahoo Connection Failed',
      message: error,
      duration: 5000
    })
  }

  const handleRefreshSources = async () => {
    setIsRefreshingSources(true)
    try {
      const startedAt = new Date().toISOString()
      const yahooSync = yahooAccessToken && selectedLeague?.id
        ? api.post(
            `/yahoo/leagues/${selectedLeague.id}/sync`,
            undefined,
            { headers: { Authorization: `Bearer ${yahooAccessToken}` } },
          )
        : null
      const [publicOutcome, yahooOutcome] = await Promise.allSettled([
        rankingsAPI.refreshAll(),
        yahooSync,
      ])
      let result: SourceRefreshResponse = publicOutcome.status === 'fulfilled'
        ? publicOutcome.value
        : {
            started_at: startedAt,
            completed_at: new Date().toISOString(),
            succeeded: 0,
            failed: 1,
            results: {
              'public-sources': {
                error: publicOutcome.reason instanceof Error
                  ? publicOutcome.reason.message
                  : 'Public source refresh failed',
              },
            },
          }
      if (yahooSync && yahooOutcome.status === 'fulfilled' && yahooOutcome.value) {
        result = {
          ...result,
          completed_at: new Date().toISOString(),
          succeeded: result.succeeded + 1,
          results: {
            ...result.results,
            'yahoo-league': {
              loaded: yahooOutcome.value.data.coverage?.available_players ?? 0,
              ...yahooOutcome.value.data.coverage,
            },
          },
        }
      } else if (yahooSync && yahooOutcome.status === 'rejected') {
        const yahooMessage = yahooOutcome.reason instanceof Error
          ? yahooOutcome.reason.message
          : 'Yahoo sync failed'
        result = {
          ...result,
          completed_at: new Date().toISOString(),
          failed: result.failed + 1,
          results: { ...result.results, 'yahoo-league': { error: yahooMessage } },
        }
      }
      setSourceRefreshResult(result)
      await queryClient.invalidateQueries({ queryKey: ['rankings'] })
      await queryClient.invalidateQueries({ queryKey: ['news-draft-signals'] })
      addToast({
        type: result.failed ? 'warning' : 'success',
        title: result.failed ? 'Sources Refreshed with Warnings' : 'All Sources Refreshed',
        message: `${result.succeeded} updated${result.failed ? ` · ${result.failed} failed` : ''}`,
        duration: 5000,
      })
    } catch (refreshError) {
      const message = refreshError instanceof Error ? refreshError.message : 'Unable to refresh sources'
      addToast({ type: 'error', title: 'Source Refresh Failed', message, duration: 5000 })
    } finally {
      setIsRefreshingSources(false)
    }
  }

  const handleLeagueSelect = (league: any) => {
    setSelectedLeague(league)
    localStorage.setItem('yahoo_selected_league', JSON.stringify(league))
    addToast({
      type: 'info',
      title: 'League Selected',
      message: `Selected ${league.name} for import`,
      duration: 3000
    })
  }

  const handleLeagueImport = (leagueData: any) => {
    const preparedLeague = leagueData.prepared_league
    const yahooDraft = leagueData.draft
    const teamNames = yahooDraft?.available
      ? Object.fromEntries(yahooDraft.order.map((team: any) => [team.slot, team.name]))
      : undefined
    const importedConfig = preparedLeague?.draft_config
      ? {
          leagueSize: preparedLeague.draft_config.league_size || session.config.leagueSize,
          draftSlot: yahooDraft?.my_draft_slot || Math.min(
            session.config.draftSlot,
            preparedLeague.draft_config.league_size || session.config.leagueSize,
          ),
          rounds: preparedLeague.draft_config.rounds || session.config.rounds,
          teamNames,
        }
      : { ...session.config, teamNames: teamNames ?? session.config.teamNames }
    const importedSlots = (preparedLeague?.roster_slots ?? []).map((slot: any) => ({
      position: slot.normalized_position || slot.position,
      required: Number(slot.count) || 0,
      filled: 0,
      byeWeeks: [] as number[],
      scarcity: rosterScarcity(slot.normalized_position || slot.position),
    })).filter((slot: { required: number }) => slot.required > 0)
    if (importedSlots.length) setRosterDefinitions(importedSlots)
    configure(importedConfig)
    if (leagueData.scoring_profile?.name) setScoringProfile(leagueData.scoring_profile.name)

    if (effectivePlayers.length && leagueData.scoring_profile && preparedLeague?.rules?.length) {
      const prepared = createDraftPackage({
        season: leagueData.settings?.season || currentSeason,
        scoringProfile: {
          profileId: leagueData.scoring_profile.profile_id,
          name: leagueData.scoring_profile.name,
          rules: preparedLeague.rules.map((rule: any) => ({
            statKey: rule.stat_key,
            multiplier: rule.multiplier,
            per: rule.per,
          })),
        },
        league: importedConfig,
        rosterSlots: (importedSlots.length ? importedSlots : rosterDefinitions).map(
          ({ position, required }: { position: string, required: number }) => ({ position, required }),
        ),
        players: effectivePlayers,
      })
      setDraftPackage(prepared)
      saveDraftPackage(prepared)
    }
    const unmappedCount = preparedLeague?.unmapped_stat_modifiers?.length ?? 0
    addToast({
      type: unmappedCount ? 'warning' : 'success',
      title: unmappedCount ? 'League Imported — Review Scoring' : 'League Imported!',
      message: unmappedCount
        ? `${unmappedCount} Yahoo scoring categories need manual mapping; no values were guessed`
        : yahooDraft?.my_draft_slot
          ? `Imported ${leagueData.teams_imported} teams; your Yahoo pick #${yahooDraft.my_draft_slot} is ready in the draft tracker`
          : `Imported ${leagueData.teams_imported} teams; set your draft position in the draft tracker when Yahoo assigns it`,
      duration: 5000
    })
  }

  const handlePackageImport = (prepared: DraftPackageV1) => {
    setDraftPackage(prepared)
    saveDraftPackage(prepared)
    setScoringProfile(prepared.scoringProfile.name)
    configure(prepared.league)
    setRosterDefinitions(prepared.rosterSlots.map((slot) => ({
      ...slot, filled: 0, byeWeeks: [] as number[], scarcity: rosterScarcity(slot.position),
    })))
    addToast({
      type: 'success',
      title: 'Offline Package Loaded',
      message: `${prepared.players.length} players are ready without the backend`,
      duration: 5000,
    })
  }

  const handleSlotClick = (position: string) => {
    console.log(`Slot clicked: ${position}`)
    // TODO: Implement slot selection logic
  }

  // Show loading state while fetching data
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <LoadingState
          loading={true}
          type="spinner"
          message="Loading Draft Room..."
          subMessage="Fetching players and scoring profiles"
        >
          <div></div>
        </LoadingState>
      </div>
    )
  }

  // Show error state if data loading failed
  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <ErrorDisplay
          error={{
            title: "Failed to Load Draft Room",
            message: "Unable to fetch required data from the server",
            severity: "high",
            suggestions: [
              "Check your internet connection",
              "Verify the backend server is running",
              "Try refreshing the page"
            ],
            onRetry: () => window.location.reload()
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <header className="border-b border-white/10 bg-gradient-to-r from-slate-950 via-blue-950 to-slate-950">
        <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl font-black shadow-lg ${isMyTurn ? 'bg-emerald-400 text-emerald-950 shadow-emerald-500/20' : 'bg-blue-500 text-white shadow-blue-500/20'}`}>
                {currentPick}
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-blue-300">2026 draft command center</div>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">{isMyTurn ? 'You are on the clock' : `Team ${currentTeam} is on the clock`}</h1>
                <p className="mt-1 text-sm text-slate-300">Round {currentRound} · Pick {currentPick} · {availablePlayers.length} players available</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-slate-300">
                <span className="mr-2 uppercase tracking-wide">Scoring</span>
                <select value={scoringProfile} onChange={(event) => setScoringProfile(event.target.value)} className="rounded-lg border border-white/15 bg-slate-900 px-2 py-1 text-sm font-bold text-white" disabled={profilesLoading} aria-label="Scoring profile">
                  {profilesLoading ? <option>Loading…</option> : scoringProfiles?.map((profile) => <option key={profile.profile_id} value={profile.name}>{profile.name}</option>)}
                </select>
              </label>
              <button type="button" onClick={handleRefreshSources} disabled={isRefreshingSources} className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-400/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-400/20 disabled:cursor-wait disabled:opacity-60">
                <ArrowPathIcon className={`h-4 w-4 ${isRefreshingSources ? 'animate-spin' : ''}`} />
                {isRefreshingSources ? 'Refreshing sources…' : 'Refresh all sources'}
              </button>
              <button type="button" onClick={() => setActivePanel('tracker')} className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-black text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">Open draft tracker</button>
              <button type="button" onClick={() => setActivePanel('yahoo')} className={`rounded-xl border px-4 py-3 text-sm font-bold ${yahooAccessToken ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : 'border-white/15 bg-white/5 text-slate-200 hover:bg-white/10'}`}>
                {yahooAccessToken ? `Yahoo linked${selectedLeague?.name ? ` · ${selectedLeague.name}` : ''}` : 'Link Yahoo'}
              </button>
              {yahooLiveStatus && <span className={`rounded-xl border px-3 py-2 text-xs font-black ${yahooLiveStatus === 'live' ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200' : yahooLiveStatus === 'waiting' ? 'border-amber-300/40 bg-amber-300/10 text-amber-100' : 'border-rose-400/40 bg-rose-400/10 text-rose-100'}`}>Yahoo sync · {yahooLiveStatus === 'live' ? 'live · 10s' : yahooLiveStatus === 'waiting' ? 'waiting for draft' : 'unavailable'}</span>}
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:max-w-3xl">
            {[
              ['Drafted', session.picks.length],
              ['My roster', myPickCount],
              ['Roster filled', `${filledRosterSlots}/${totalRosterSlots}`],
              ['League', `${session.config.leagueSize} teams · slot ${session.config.draftSlot}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <div className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</div>
                <div className="mt-0.5 truncate text-sm font-black text-white">{value}</div>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label="Player board" className="min-w-0 overflow-hidden rounded-2xl border border-white/10 bg-white text-slate-950 shadow-2xl shadow-black/20">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-700">Primary workspace</div>
                  <h2 className="mt-1 text-xl font-black">Best available players</h2>
                </div>
                <div className={`rounded-full px-3 py-1.5 text-xs font-black ${isMyTurn ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}`}>{isMyTurn ? 'Draft action assigns to you' : `Draft action records Team ${currentTeam}`}</div>
              </div>
            </div>
            <div className="p-3 sm:p-4">
              <PlayerBoard
                players={availablePlayers}
                selectedPosition={selectedPosition}
                searchQuery={searchQuery}
                onPlayerSelect={handlePlayerSelect}
                onAddToWatchlist={handleAddToWatchlist}
                onRemoveFromWatchlist={handleRemoveFromWatchlist}
                watchlist={watchlist}
                scoringProfile={scoringProfile}
                importedADP={importedADP}
                onADPImport={handleADPImport}
                weeklyStats={{}}
                news={{}}
                depthChart={{}}
                playerNotes={playerNotes}
                onPlayerNotesChange={handlePlayerNotesChange}
                loading={loading}
                error={error}
                onRetry={handleRetry}
                onPositionChange={setSelectedPosition}
                onSearchChange={setSearchQuery}
                onDraftOther={!isMyTurn ? (player) => draftPlayer(player.id, false) : undefined}
                onDraftMine={isMyTurn ? (player) => draftPlayer(player.id, true) : undefined}
                leagueSize={session.config.leagueSize}
                injuriesByPlayer={injuriesByPlayer}
              />
            </div>
          </section>

          <aside className="space-y-4 xl:sticky xl:top-4">
            <section className="overflow-hidden rounded-2xl border border-emerald-400/20 bg-slate-900 shadow-xl">
              <header className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                <div><div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">Always visible</div><h2 className="mt-0.5 font-black">My roster</h2></div>
                <button type="button" onClick={() => setActivePanel('roster')} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold hover:bg-white/20">Full roster</button>
              </header>
              <div className="grid grid-cols-4 gap-2 p-4">
                {rosterSlots.map((slot) => (
                  <button key={slot.position} type="button" onClick={() => setActivePanel('roster')} className={`rounded-xl border px-2 py-3 text-center ${slot.filled >= slot.required ? 'border-emerald-400/30 bg-emerald-400/10' : 'border-white/10 bg-white/5'}`}>
                    <div className="text-xs font-black">{slot.position}</div>
                    <div className={`mt-1 text-lg font-black ${slot.filled >= slot.required ? 'text-emerald-300' : 'text-white'}`}>{slot.filled}/{slot.required}</div>
                  </button>
                ))}
              </div>
              {myPlayers.length > 0 && <div className="border-t border-white/10 px-4 py-3 text-xs text-slate-300"><span className="font-bold text-white">Latest:</span> {myPlayers.slice(-3).map((player) => player.name).join(' · ')}</div>}
            </section>

            {yahooLiveStatus && (
              <section className="max-h-[32rem] overflow-y-auto rounded-2xl border border-cyan-400/20 bg-slate-900 shadow-xl">
                <header className="border-b border-white/10 px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Yahoo live draft</div>
                  <h2 className="mt-0.5 font-black">League rosters</h2>
                  <p className="mt-1 text-xs text-slate-400">Next: {liveDraftRosters.find((team) => team.draft_position === currentTeam)?.name ?? `Team ${currentTeam}`}</p>
                </header>
                <div className="space-y-2 p-3">
                  {liveDraftRosters.map((team) => (
                    <div key={team.id} className={`rounded-xl border p-3 ${team.draft_position === currentTeam ? 'border-cyan-300/50 bg-cyan-400/10' : 'border-white/10 bg-white/5'}`}>
                      <div className="flex items-center justify-between gap-2 text-xs"><span className="truncate font-black text-white">{team.name}{team.is_current_user ? ' · You' : ''}</span><span className="shrink-0 text-slate-400">#{team.draft_position} · {team.picks.length}</span></div>
                      <p className="mt-1 text-xs leading-5 text-slate-300">{team.picks.length ? team.picks.join(' · ') : 'No picks yet'}</p>
                    </div>
                  ))}
                  {!liveDraftRosters.length && <p className="p-2 text-xs text-slate-400">Team rosters will appear when Yahoo publishes the draft order.</p>}
                </div>
              </section>
            )}

            <section className="max-h-[32rem] overflow-y-auto rounded-2xl border border-violet-400/20 bg-white p-4 text-slate-950 shadow-xl">
              <Watchlist watchlist={effectivePlayers.filter((player) => watchlist.includes(player.id))} onRemoveFromWatchlist={handleRemoveFromWatchlist} onPlayerSelect={handlePlayerSelect} />
            </section>

            <button type="button" onClick={() => setActivePanel('insights')} className="flex w-full items-center justify-between rounded-2xl border border-violet-400/20 bg-gradient-to-r from-violet-600/20 to-blue-600/20 px-4 py-4 text-left hover:border-violet-300/40">
              <span><span className="block text-[10px] font-bold uppercase tracking-wider text-violet-300">Decision support</span><span className="mt-1 block font-black">Tiers, sleepers &amp; methodology</span></span>
              <span className="text-xl">→</span>
            </button>
          </aside>
        </div>

        <details className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <summary className="cursor-pointer font-bold text-white">Data sources and workspace details</summary>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Ranking data sources">
            {rankingSources?.map((source) => (
              <a key={source.source} href={source.attribution_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900 px-3 py-1.5 text-xs hover:bg-slate-800" title={`${source.purpose}. ${Math.round(source.match_rate * 100)}% canonical player match coverage.`}>
                <span className={`h-1.5 w-1.5 rounded-full ${source.available ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                <span className="font-semibold">{source.label}</span>
                <span className="text-slate-500">{source.snapshot_date ?? 'not loaded'}</span>
              </a>
            ))}
          </div>
          {sourceRefreshResult && (
            <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/50 p-3" aria-label="Latest source refresh results">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-white">Latest refresh · {new Date(sourceRefreshResult.completed_at).toLocaleString()}</span>
                <span className={`text-xs font-bold ${sourceRefreshResult.failed ? 'text-amber-300' : 'text-emerald-300'}`}>{sourceRefreshResult.succeeded} succeeded · {sourceRefreshResult.failed} failed</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(sourceRefreshResult.results).map(([source, result]) => (
                  <span key={source} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${result.error ? 'border-red-400/30 bg-red-400/10 text-red-200' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'}`} title={result.error || `${String(result.loaded ?? result.matched ?? 'Updated')} records`}>
                    {source} · {result.error ? 'failed' : 'updated'}
                  </span>
                ))}
              </div>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">Offline package {draftPackage ? `ready with ${draftPackage.players.length} players` : 'pending'} · Yahoo {yahooAccessToken ? 'connected' : 'optional'}{yahooLiveStatus ? ` · live draft sync ${yahooLiveStatus === 'live' ? 'active (10s)' : yahooLiveStatus === 'waiting' ? 'waiting for draft start' : 'unavailable'}` : ''} · all picks persist locally.</p>
        </details>
      </main>

      {activePanel === 'tracker' && (
        <WorkspaceModal title="Draft tracker" eyebrow="Record picks, recommendations, and corrections" onClose={() => setActivePanel(null)}>
          <ManualDraftConsole session={session} players={effectivePlayers} availablePlayers={availablePlayers} onConfigure={configure} onUndo={undo} onRemovePick={removePick} onReset={reset} onDraftPlayer={draftPlayer} draftPackage={draftPackage} onImportPackage={handlePackageImport} onPackageError={(message) => addToast({ type: 'error', title: 'Package Import Failed', message, duration: 5000 })} newsSignals={newsDraftSignals} />
        </WorkspaceModal>
      )}

      {activePanel === 'yahoo' && (
        <WorkspaceModal title="Yahoo Fantasy" eyebrow="Connection and league import" onClose={() => setActivePanel(null)}>
          <div className="grid gap-5 lg:grid-cols-2">
            <YahooOAuth onAuthSuccess={handleAuthSuccess} onAuthError={handleAuthError} />
            {yahooAccessToken ? <YahooLeagueImport accessToken={yahooAccessToken} selectedLeagueId={selectedLeague?.id} onLeagueSelect={handleLeagueSelect} onImportComplete={handleLeagueImport} onRefreshAll={handleRefreshSources} isRefreshingAll={isRefreshingSources} refreshVersion={sourceRefreshResult?.completed_at} /> : <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">Connect Yahoo to choose and import a league.</div>}
          </div>
        </WorkspaceModal>
      )}

      {activePanel === 'roster' && (
        <WorkspaceModal title="Roster construction" eyebrow={`${filledRosterSlots} of ${totalRosterSlots} slots filled`} onClose={() => setActivePanel(null)}>
          <RosterBar rosterSlots={rosterSlots} selectedPlayers={myPlayers} onSlotClick={handleSlotClick} scoringProfile={scoringProfile} />
        </WorkspaceModal>
      )}

      {activePanel === 'insights' && (
        <WorkspaceModal title="Projection insights" eyebrow="Tiers, value over replacement, and assumptions" onClose={() => setActivePanel(null)}>
          <div className="space-y-5">
            <NewsInsightsPanel season={currentSeason} leagueSize={session.config.leagueSize} />
            {hasProjectionData ? <ProjectionAnalyticsPanel players={effectivePlayers} profileName={projectionAnalytics?.profile.name ?? scoringProfile} snapshotDate={projectionAnalytics?.snapshot_date} methodology={projectionAnalytics?.methodology} /> : <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-slate-700"><h3 className="text-lg font-black text-slate-950">Tiers and VORP are pending</h3><p className="mt-2 text-sm">Draft ranks are live. Projection analytics will appear when projected or weekly scoring data is loaded.</p></div>}
          </div>
        </WorkspaceModal>
      )}

      <PlayerDetailDrawer
        player={selectedDetailPlayer}
        season={currentSeason}
        profileId={selectedProfile?.profile_id}
        onClose={() => setSelectedDetailPlayer(null)}
      />
    </div>
  )
}
