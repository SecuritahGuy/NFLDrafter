import React, { useState, useMemo, useEffect } from 'react'
import { PlayerBoard } from './PlayerBoard'
import { Watchlist } from './Watchlist'
import { Tiering } from './Tiering'
import { VORP } from './VORP'
import { RosterBar } from './RosterBar'
import { YahooOAuth } from './YahooOAuth'
import { YahooLeagueImport } from './YahooLeagueImport'
import { ToastProvider, useToast } from './Toast'
import { LoadingState } from './LoadingState'
import { ErrorDisplay } from './ErrorDisplay'
import type { Player } from '../types'
import { usePlayers } from '../hooks/usePlayers'
import { useScoringProfiles } from '../hooks/useScoringProfiles'
import { usePlayersWithPoints } from '../hooks/useFantasyPoints'
import type { BackendPlayer } from '../api'
import { ManualDraftConsole } from './ManualDraftConsole'
import { useDraftSession } from '../hooks/useDraftSession'
import { useRankings, useRankingSources } from '../hooks/useRankings'
import { assignRosterSlots } from '../services/draftEngine'
import { buildCompositeRankings } from '../services/compositeRankings'
import { PlayerDetailDrawer } from './PlayerDetailDrawer'
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
  const [rosterDefinitions, setRosterDefinitions] = useState(() =>
    draftPackage?.rosterSlots.map((slot) => ({
      ...slot, filled: 0, byeWeeks: [] as number[], scarcity: rosterScarcity(slot.position),
    })) ?? BASE_ROSTER_SLOTS
  )
  const { session, draftPlayer, undo, removePick, configure, reset } = useDraftSession()
  const { data: fantasyProsRankings } = useRankings('fantasypros-ecr')
  const { data: espnRankings } = useRankings('espn-draft-rank')
  const { data: ffcRankings } = useRankings('ffc-adp')
  const { data: rankingSources } = useRankingSources()
  
  // Yahoo OAuth state
  const [yahooAccessToken, setYahooAccessToken] = useState<string | null>(null)
  const [yahooRefreshToken, setYahooRefreshToken] = useState<string | null>(null)
  const [selectedLeague, setSelectedLeague] = useState<any>(null)
  
  // Real data from backend API
  const currentSeason = 2026
  const currentWeek = 1
  
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

  const compositeRankings = useMemo(() => {
    return buildCompositeRankings(
      players ?? [],
      fantasyProsRankings?.rankings ?? [],
      espnRankings?.rankings ?? [],
      ffcRankings?.rankings ?? [],
    )
  }, [espnRankings, fantasyProsRankings, ffcRankings, players])

  const rankedPlayerIds = useMemo(
    () => (players ?? []).filter((player) => compositeRankings.has(player.player_id)).map((player) => player.player_id),
    [compositeRankings, players],
  )
  const { data: playersWithPoints, isLoading: pointsLoading, error: pointsError } = usePlayersWithPoints(
    rankedPlayerIds,
    currentSeason,
    currentWeek,
    selectedProfile?.profile_id || ''
  )
  
  // Combine player data with calculated points
  const enrichedPlayers: Player[] = useMemo(() => {
    if (!players) return []
    
    return players.map((player: BackendPlayer) => {
      const pointsData = playersWithPoints?.[player.player_id]
      const fantasyPoints = pointsData?.points || 0
      const yahooPoints = 0 // TODO: Implement Yahoo points calculation
      const composite = compositeRankings.get(player.player_id)
      const fantasyPros = composite?.fantasyPros
      const espn = composite?.espn
      const ffc = composite?.ffc
      
      return {
        id: player.player_id,
        name: player.full_name, // Backend returns full_name
        position: player.position,
        team: player.team,
        fantasyPoints,
        yahooPoints,
        delta: fantasyPoints - yahooPoints,
        vorp: 0, // TODO: Calculate VORP
        tier: 0, // TODO: Calculate tiers
        adp: ffc?.ecr ?? 0,
        newsCount: 0, // TODO: Get news count
        byeWeek: ffc?.bye ?? fantasyPros?.bye ?? 0,
        rank: composite?.rank,
        ecr: fantasyPros?.ecr ?? undefined,
        espnRank: espn?.rank ?? undefined,
        rankingSourceCount: composite?.sourceCount ?? 0,
        projectedPoints: espn?.projected_points ?? undefined,
        projectedPointsPerGame: espn?.projected_points_per_game ?? undefined,
        status: player.status,
        lastSeason: player.last_season,
        headshot: player.headshot,
      }
    })
  }, [compositeRankings, players, playersWithPoints])

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
  const isLoading = (profilesLoading || playersLoading || pointsLoading) && !effectivePlayers.length
  const hasError = !effectivePlayers.length && Boolean(
    (!profilesLoading && !playersLoading && !pointsLoading && (!players || !scoringProfiles))
    || playersError
    || pointsError
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

  const handleLeagueSelect = (league: any) => {
    setSelectedLeague(league)
    addToast({
      type: 'info',
      title: 'League Selected',
      message: `Selected ${league.name} for import`,
      duration: 3000
    })
  }

  const handleLeagueImport = (leagueData: any) => {
    const preparedLeague = leagueData.prepared_league
    const importedConfig = preparedLeague?.draft_config
      ? {
          leagueSize: preparedLeague.draft_config.league_size || session.config.leagueSize,
          draftSlot: Math.min(
            session.config.draftSlot,
            preparedLeague.draft_config.league_size || session.config.leagueSize,
          ),
          rounds: preparedLeague.draft_config.rounds || session.config.rounds,
        }
      : session.config
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
        : `Imported ${leagueData.teams_imported} teams; ${leagueData.player_mapping?.matched ?? 0} Yahoo player IDs matched`,
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

  const handleVorpChange = (playerId: string, vorp: number) => {
    console.log(`VORP changed for player ${playerId}: ${vorp}`)
    // TODO: Implement VORP update logic
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
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-purple-600/10">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.02%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-20"></div>
        </div>
        
        {/* Header Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-6">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-md mb-3">
              <span className="text-sm" style={{ fontSize: '0.875rem' }}>🏆</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">
              Draft Room
            </h1>
            <p className="text-lg text-blue-100 mb-6 max-w-2xl mx-auto">
              Professional fantasy football drafting experience with advanced analytics, 
              real-time insights, and expert tools to dominate your league
            </p>
            


            {/* Scoring Profile Selector */}
            <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-sm rounded-xl px-4 py-2 border border-white/20">
              <label className="text-blue-100 text-sm font-medium">Scoring Profile:</label>
              <select
                value={scoringProfile}
                onChange={(e) => setScoringProfile(e.target.value)}
                className="px-3 py-1.5 bg-white/20 border border-white/30 rounded-lg text-white text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-sm"
                disabled={profilesLoading}
                title="Select scoring profile"
              >
                {profilesLoading ? (
                  <option className="bg-slate-800 text-white">Loading profiles...</option>
                ) : (
                  scoringProfiles?.map(profile => (
                    <option key={profile.profile_id} className="bg-slate-800 text-white" value={profile.name}>
                      {profile.name}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <h2 className="text-xl font-bold text-white text-center mb-4">Draft Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
            <div className="text-3xl font-bold text-yellow-400 mb-1">{availablePlayers.length}</div>
            <div className="text-blue-200 text-sm font-medium">Players Available</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
            <div className="text-3xl font-bold text-green-400 mb-1">{watchlist.length}</div>
            <div className="text-blue-200 text-sm font-medium">Watchlist</div>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 text-center">
            <div className="text-3xl font-bold text-purple-400 mb-1">{rosterSlots.length}</div>
            <div className="text-blue-200 text-sm font-medium">Roster Slots</div>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2" aria-label="Ranking data sources">
          {rankingSources?.map((source) => (
            <a
              key={source.source}
              href={source.attribution_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:bg-white/10"
              title={`${source.purpose}. ${Math.round(source.match_rate * 100)}% canonical player match coverage.`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${source.available ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span className="font-semibold">{source.label}</span>
              <span className="text-slate-400">{source.snapshot_date ?? 'not loaded'}</span>
            </a>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <ManualDraftConsole
          session={session}
          players={effectivePlayers}
          availablePlayers={availablePlayers}
          onConfigure={configure}
          onUndo={undo}
          onRemovePick={removePick}
          onReset={reset}
          draftPackage={draftPackage}
          onImportPackage={handlePackageImport}
          onPackageError={(message) => addToast({
            type: 'error', title: 'Package Import Failed', message, duration: 5000,
          })}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Left Column - Tools & Analytics */}
          <div className="md:col-span-2 lg:col-span-1 border border-red-500/20 rounded-lg p-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-4">
            {/* Watchlist */}
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/20 rounded-md flex items-center justify-center">
                    <span className="text-white text-xs">📋</span>
                  </div>
                  Watchlist
                </h3>
              </div>
              <div className="p-4">
                <Watchlist
                  watchlist={effectivePlayers.filter(p => watchlist.includes(p.id))}
                  onRemoveFromWatchlist={handleRemoveFromWatchlist}
                  onPlayerSelect={handlePlayerSelect}
                />
              </div>
            </div>

            {hasProjectionData ? <>
            {/* Tiering Tool */}
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/20 rounded-md flex items-center justify-center">
                    <span className="text-white text-xs">🏗️</span>
                  </div>
                  Tiering Analysis
                </h3>
              </div>
              <div className="p-4">
                <Tiering
                  players={effectivePlayers}
                />
              </div>
            </div>

            {/* VORP Calculator */}
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-red-600 px-4 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/20 rounded-md flex items-center justify-center">
                    <span className="text-white text-xs">🔥</span>
                  </div>
                  VORP Analysis
                </h3>
              </div>
              <div className="p-4">
                <VORP
                  players={effectivePlayers}
                  onVorpChange={handleVorpChange}
                />
              </div>
            </div>
            </> : (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm md:col-span-2 lg:col-span-1">
                <div className="text-xs font-bold uppercase tracking-wider text-blue-700">Projection analytics</div>
                <h3 className="mt-1 text-lg font-black text-slate-950">Tiers and VORP are pending</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">The 2026 player pool and draft ranks are live. Tier and value-over-replacement analysis will appear after projection or weekly scoring data is loaded.</p>
              </div>
            )}

            {/* Roster Bar */}
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-4 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/20 rounded-md flex items-center justify-center">
                    <span className="text-white text-xs">👥</span>
                  </div>
                  Roster Overview
                </h3>
              </div>
              <div className="p-4">
                <RosterBar
                  rosterSlots={rosterSlots}
                  selectedPlayers={myPlayers}
                  onSlotClick={handleSlotClick}
                  scoringProfile={scoringProfile}
                />
              </div>
            </div>

            {/* Yahoo Integration */}
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-4 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-4 h-4 bg-white/20 rounded-md flex items-center justify-center">
                    <span className="text-white text-xs">🔗</span>
                  </div>
                  Yahoo Fantasy
                </h3>
              </div>
              <div className="p-4 space-y-3">
                <YahooOAuth
                  onAuthSuccess={handleAuthSuccess}
                  onAuthError={handleAuthError}
                />
                
                {yahooAccessToken && (
                  <YahooLeagueImport
                    accessToken={yahooAccessToken}
                    onLeagueSelect={handleLeagueSelect}
                    onImportComplete={handleLeagueImport}
                  />
                )}
              </div>
            </div>
            </div>
          </div>

          {/* Right Column - Player Board */}
          <div className="md:col-span-2 lg:col-span-2 border border-blue-500/20 rounded-lg p-2">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-4 py-3">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded-md flex items-center justify-center">
                    <span className="text-white text-xs">📊</span>
                  </div>
                  Player Board
                </h3>
                <p className="text-blue-100 text-xs mt-1">
                  Comprehensive player analysis, rankings, and drafting tools
                </p>
              </div>
              <div className="p-4">
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
                  onDraftOther={(player) => draftPlayer(player.id, false)}
                  onDraftMine={(player) => draftPlayer(player.id, true)}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      <PlayerDetailDrawer
        player={selectedDetailPlayer}
        season={currentSeason}
        profileId={selectedProfile?.profile_id}
        onClose={() => setSelectedDetailPlayer(null)}
      />
    </div>
  )
}
