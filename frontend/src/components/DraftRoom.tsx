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
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  
  // Yahoo OAuth state
  const [yahooAccessToken, setYahooAccessToken] = useState<string | null>(null)
  const [yahooRefreshToken, setYahooRefreshToken] = useState<string | null>(null)
  const [selectedLeague, setSelectedLeague] = useState<any>(null)
  
  // Roster configuration
  const rosterSlots = [
    { position: 'QB', required: 1, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
    { position: 'RB', required: 2, filled: 0, byeWeeks: [], scarcity: 'high' as const },
    { position: 'WR', required: 2, filled: 0, byeWeeks: [], scarcity: 'high' as const },
    { position: 'TE', required: 1, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
    { position: 'FLEX', required: 1, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
    { position: 'K', required: 1, filled: 0, byeWeeks: [], scarcity: 'low' as const },
    { position: 'DEF', required: 1, filled: 0, byeWeeks: [], scarcity: 'low' as const },
    { position: 'BN', required: 6, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
  ]

  // Real data from backend API
  const currentSeason = 2025
  const currentWeek = 1
  
  // Fetch scoring profiles
  const { data: scoringProfiles, isLoading: profilesLoading } = useScoringProfiles()
  
  // Get the selected scoring profile ID
  const selectedProfile = useMemo(() => {
    if (!scoringProfiles) return null
    return scoringProfiles.find(profile => profile.name === scoringProfile)
  }, [scoringProfiles, scoringProfile])
  
  // Fetch players with filters
  const { data: players, isLoading: playersLoading, error: playersError } = usePlayers({
    q: searchQuery,
    position: selectedPosition === 'ALL' ? undefined : selectedPosition,
    limit: 100
  })
  
  // Calculate fantasy points for players
  const { data: playersWithPoints, isLoading: pointsLoading, error: pointsError } = usePlayersWithPoints(
    players?.map(p => p.player_id) || [],
    currentSeason,
    currentWeek,
    selectedProfile?.profile_id || ''
  )
  
  // Combine player data with calculated points
  const enrichedPlayers: Player[] = useMemo(() => {
    if (!players || !playersWithPoints) return []
    
    return players.map((player: BackendPlayer) => {
      const pointsData = playersWithPoints[player.player_id]
      const fantasyPoints = pointsData?.points || 0
      const yahooPoints = 0 // TODO: Implement Yahoo points calculation
      
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
        adp: 0, // TODO: Get ADP data
        newsCount: 0, // TODO: Get news count
        byeWeek: 0, // TODO: Get bye week
      }
    })
  }, [players, playersWithPoints])
  
  // Set default scoring profile when data loads
  useEffect(() => {
    if (scoringProfiles && scoringProfiles.length > 0 && !scoringProfile) {
      setScoringProfile(scoringProfiles[0].name)
    }
  }, [scoringProfiles, scoringProfile])

  // Loading and error states
  const isLoading = profilesLoading || playersLoading || pointsLoading
  const hasError = !profilesLoading && !playersLoading && !pointsLoading && (!players || !scoringProfiles) || playersError || pointsError

  const handlePlayerSelect = (player: Player) => {
    console.log('Player selected:', player)
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
    const player = enrichedPlayers.find(p => p.id === playerId)
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
    addToast({
      type: 'success',
      title: 'League Imported!',
      message: `Successfully imported ${leagueData.teams_imported} teams`,
      duration: 5000
    })
    // Here you would update the local state with imported data
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
            <div className="text-3xl font-bold text-yellow-400 mb-1">{enrichedPlayers.length}</div>
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
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
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
                  watchlist={enrichedPlayers.filter(p => watchlist.includes(p.id))}
                  onRemoveFromWatchlist={handleRemoveFromWatchlist}
                  onPlayerSelect={handlePlayerSelect}
                />
              </div>
            </div>

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
                  players={enrichedPlayers}
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
                  players={enrichedPlayers}
                  onVorpChange={handleVorpChange}
                />
              </div>
            </div>

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
                  selectedPlayers={enrichedPlayers.filter(p => watchlist.includes(p.id))}
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
                  players={enrichedPlayers}
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
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
