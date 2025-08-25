import React, { useState, useMemo } from 'react'
import { PlayerBoard } from './PlayerBoard'
import { Watchlist } from './Watchlist'
import { Tiering } from './Tiering'
import { VORP } from './VORP'
import { RosterBar } from './RosterBar'
import { YahooOAuth } from './YahooOAuth'
import { YahooLeagueImport } from './YahooLeagueImport'
import { ToastProvider, useToast } from './Toast'
import type { Player } from '../types'
import { usePlayers } from '../hooks/usePlayers'
import { useScoringProfiles } from '../hooks/useScoringProfiles'
import { usePlayersWithPoints } from '../hooks/useFantasyPoints'

export const DraftRoom: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
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
  const [scoringProfile, setScoringProfile] = useState<string>('Standard PPR')
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
  const currentSeason = 2024
  const currentWeek = 1
  
  // Fetch scoring profiles
  const { data: scoringProfiles, isLoading: profilesLoading } = useScoringProfiles()
  
  // Get the selected scoring profile ID
  const selectedProfile = useMemo(() => {
    if (!scoringProfiles) return null
    return scoringProfiles.find(profile => profile.name === scoringProfile)
  }, [scoringProfiles, scoringProfile])
  
  // Fetch players with filters
  const { data: players, isLoading: playersLoading } = usePlayers({
    q: searchQuery,
    position: selectedPosition === 'ALL' ? undefined : selectedPosition,
    limit: 100
  })
  
  // Calculate fantasy points for players
  const { data: playersWithPoints, isLoading: pointsLoading } = usePlayersWithPoints(
    players?.map(p => p.player_id) || [],
    currentSeason,
    currentWeek,
    selectedProfile?.profile_id || ''
  )
  
  // Combine player data with calculated points
  const enrichedPlayers: Player[] = useMemo(() => {
    if (!players || !playersWithPoints) return []
    
    return players.map(player => {
      const pointsData = playersWithPoints[player.player_id]
      const fantasyPoints = pointsData?.points || 0
      const yahooPoints = 0 // TODO: Implement Yahoo points calculation
      
      return {
        id: player.player_id,
        name: player.name,
        position: player.position,
        team: player.team,
        fantasyPoints,
        yahooPoints,
        delta: fantasyPoints - yahooPoints,
        vorp: 0, // TODO: Calculate VORP
        tier: 0, // TODO: Calculate tiers
        adp: player.adp || 0,
        newsCount: player.news_count || 0,
        byeWeek: player.bye_week || 0,
      }
    })
  }, [players, playersWithPoints])
  
  // Loading and error states
  const isLoading = profilesLoading || playersLoading || pointsLoading
  const hasError = !profilesLoading && !playersLoading && !pointsLoading && (!players || !scoringProfiles)

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
      {/* Hero Header */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23ffffff%22%20fill-opacity%3D%220.03%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-30"></div>
        </div>
        
        {/* Header Content */}
        <div className="relative z-10 container mx-auto px-6 py-12">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full shadow-2xl mb-6">
              <span className="text-3xl">🏆</span>
            </div>
            <h1 className="text-5xl font-bold text-white mb-4 tracking-tight">
              Draft Room
            </h1>
            <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
              Professional fantasy football drafting experience with advanced analytics, 
              real-time insights, and expert tools to dominate your league
            </p>
            
            {/* Quick Stats */}
            <div className="flex justify-center gap-8 mb-8">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-400">{enrichedPlayers.length}</div>
                <div className="text-blue-200 text-sm">Players Available</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-400">{watchlist.length}</div>
                <div className="text-blue-200 text-sm">Watchlist</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-purple-400">{rosterSlots.length}</div>
                <div className="text-blue-200 text-sm">Roster Slots</div>
              </div>
            </div>

            {/* Scoring Profile Selector */}
            <div className="inline-flex items-center gap-4 bg-white/10 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/20">
              <label className="text-blue-100 font-medium">Scoring Profile:</label>
              <select
                value={scoringProfile}
                onChange={(e) => setScoringProfile(e.target.value)}
                className="px-4 py-2 bg-white/20 border border-white/30 rounded-lg text-white font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 backdrop-blur-sm"
              >
                <option value="Standard PPR" className="bg-slate-800 text-white">Standard PPR</option>
                <option value="Half PPR" className="bg-slate-800 text-white">Half PPR</option>
                <option value="Standard" className="bg-slate-800 text-white">Standard</option>
                <option value="Superflex" className="bg-slate-800 text-white">Superflex</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Left Sidebar - Tools & Analytics */}
          <div className="xl:col-span-1 space-y-6">
            {/* Watchlist */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">📋</span>
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
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🏗️</span>
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
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-orange-600 to-red-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🔥</span>
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
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">👥</span>
                  </div>
                  Roster Overview
                </h3>
              </div>
              <div className="p-4">
                <RosterBar
                  rosterSlots={rosterSlots}
                  selectedPlayers={mockPlayers.filter(p => watchlist.includes(p.id))}
                  onSlotClick={handleSlotClick}
                  scoringProfile={scoringProfile}
                />
              </div>
            </div>

            {/* Yahoo Integration */}
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-yellow-600 to-orange-600 px-6 py-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-3">
                  <div className="w-6 h-6 bg-white/20 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">🔗</span>
                  </div>
                  Yahoo Fantasy
                </h3>
              </div>
              <div className="p-4 space-y-4">
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

          {/* Main Content - Player Board */}
          <div className="xl:col-span-4">
            <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-6 py-4">
                <h3 className="text-xl font-bold text-white flex items-center gap-3">
                  <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">📊</span>
                  </div>
                  Player Board
                </h3>
                <p className="text-blue-100 text-sm mt-1">
                  Comprehensive player analysis, rankings, and drafting tools
                </p>
              </div>
              <div className="p-6">
                <PlayerBoard
                  players={mockPlayers}
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
