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

export const DraftRoom: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
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

  // Mock data for demonstration
  const mockPlayers: Player[] = useMemo(() => [
    {
      id: '1',
      name: 'Patrick Mahomes',
      position: 'QB',
      team: 'KC',
      fantasyPoints: 350.5,
      yahooPoints: 345.2,
      delta: 5.3,
      vorp: 45.2,
      tier: 1,
      adp: 12,
      newsCount: 3,
      byeWeek: 10,
    },
    {
      id: '2',
      name: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      fantasyPoints: 380.2,
      yahooPoints: 375.8,
      delta: 4.4,
      vorp: 52.1,
      tier: 1,
      adp: 2,
      newsCount: 2,
      byeWeek: 9,
    },
    {
      id: '3',
      name: 'Tyreek Hill',
      position: 'WR',
      team: 'MIA',
      fantasyPoints: 320.8,
      yahooPoints: 318.5,
      delta: 2.3,
      vorp: 38.7,
      tier: 1,
      adp: 8,
      newsCount: 4,
      byeWeek: 11,
    },
    {
      id: '4',
      name: 'Travis Kelce',
      position: 'TE',
      team: 'KC',
      fantasyPoints: 280.3,
      yahooPoints: 275.1,
      delta: 5.2,
      vorp: 42.8,
      tier: 1,
      adp: 15,
      newsCount: 1,
      byeWeek: 10,
    },
    {
      id: '5',
      name: 'Josh Allen',
      position: 'QB',
      team: 'BUF',
      fantasyPoints: 340.1,
      yahooPoints: 335.7,
      delta: 4.4,
      vorp: 43.9,
      tier: 2,
      adp: 18,
      newsCount: 2,
      byeWeek: 13,
    },
    {
      id: '6',
      name: 'Justin Jefferson',
      position: 'WR',
      team: 'MIN',
      fantasyPoints: 310.5,
      yahooPoints: 308.2,
      delta: 2.3,
      vorp: 35.8,
      tier: 1,
      adp: 5,
      newsCount: 2,
      byeWeek: 13,
    },
    {
      id: '7',
      name: 'Saquon Barkley',
      position: 'RB',
      team: 'PHI',
      fantasyPoints: 290.3,
      yahooPoints: 285.1,
      delta: 5.2,
      vorp: 38.9,
      tier: 2,
      adp: 20,
      newsCount: 1,
      byeWeek: 10,
    },
    {
      id: '8',
      name: 'Mark Andrews',
      position: 'TE',
      team: 'BAL',
      fantasyPoints: 220.8,
      yahooPoints: 218.5,
      delta: 2.3,
      vorp: 28.7,
      tier: 2,
      adp: 45,
      newsCount: 1,
      byeWeek: 13,
    },
  ], [])

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
    const player = mockPlayers.find(p => p.id === playerId)
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
    <div className="container py-8">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="p-3 bg-primary-100 rounded-xl">
            <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white text-xl font-bold">
              🏆
            </div>
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Draft Room</h1>
            <p className="text-lg text-gray-600">Professional fantasy football drafting experience</p>
          </div>
        </div>
        
        {/* Scoring Profile Selector */}
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">Scoring Profile:</label>
          <select
            value={scoringProfile}
            onChange={(e) => setScoringProfile(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-medium"
          >
            <option value="Standard PPR">Standard PPR</option>
            <option value="Half PPR">Half PPR</option>
            <option value="Standard">Standard</option>
            <option value="Superflex">Superflex</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
        {/* Left Sidebar - Watchlist & Tools */}
        <div className="xl:col-span-1 space-y-6">
          {/* Watchlist */}
          <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <div className="card-header bg-gradient-to-r from-primary-50 to-blue-50 border-b border-primary-100">
              <h3 className="text-lg font-semibold text-primary-800 flex items-center gap-2">
                <div className="w-5 h-5 bg-primary-600 rounded flex items-center justify-center text-white text-xs">📋</div>
                Watchlist
              </h3>
            </div>
            <div className="card-body">
              <Watchlist
                watchlist={mockPlayers.filter(p => watchlist.includes(p.id))}
                onRemoveFromWatchlist={handleRemoveFromWatchlist}
                onPlayerSelect={handlePlayerSelect}
              />
            </div>
          </div>

          {/* Tiering Tool */}
          <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <div className="card-header bg-gradient-to-r from-purple-50 to-indigo-50 border-b border-purple-100">
              <h3 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
                <div className="w-5 h-5 bg-purple-600 rounded flex items-center justify-center text-white text-xs">🏗️</div>
                Tiering
              </h3>
            </div>
            <div className="card-body">
              <Tiering
                players={mockPlayers}
              />
            </div>
          </div>

          {/* VORP Calculator */}
          <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <div className="card-header bg-gradient-to-r from-orange-50 to-red-50 border-b border-orange-100">
              <h3 className="text-lg font-semibold text-orange-800 flex items-center gap-2">
                <div className="w-5 h-5 bg-orange-600 rounded flex items-center justify-center text-white text-xs">🔥</div>
                VORP
              </h3>
            </div>
            <div className="card-body">
              <VORP
                players={mockPlayers}
                onVorpChange={handleVorpChange}
              />
            </div>
          </div>

          {/* Roster Bar */}
          <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <div className="card-header bg-gradient-to-r from-green-50 to-emerald-50 border-b border-green-100">
              <h3 className="text-lg font-semibold text-green-800 flex items-center gap-2">
                <div className="w-5 h-5 bg-green-600 rounded flex items-center justify-center text-white text-xs">👥</div>
                Roster
              </h3>
            </div>
            <div className="card-body">
              <RosterBar
                rosterSlots={rosterSlots}
                selectedPlayers={mockPlayers.filter(p => watchlist.includes(p.id))}
                onSlotClick={handleSlotClick}
                scoringProfile={scoringProfile}
              />
            </div>
          </div>

          {/* Yahoo OAuth */}
          <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm">
            <div className="card-header bg-gradient-to-r from-yellow-50 to-amber-50 border-b border-yellow-100">
              <h3 className="text-lg font-semibold text-yellow-800 flex items-center gap-2">
                <div className="w-5 h-5 bg-yellow-600 rounded flex items-center justify-center text-white text-xs">🔗</div>
                Yahoo Integration
              </h3>
            </div>
            <div className="card-body">
              <YahooOAuth
                onAuthSuccess={handleAuthSuccess}
                onAuthError={handleAuthError}
              />
            </div>
          </div>

          {/* Yahoo League Import */}
          {yahooAccessToken && (
            <div className="card shadow-lg border-0 bg-white/80 backdrop-blur-sm">
              <div className="card-header bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
                <h3 className="text-lg font-semibold text-blue-800 flex items-center gap-2">
                  <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center text-white text-xs">🏈</div>
                  League Import
                </h3>
              </div>
              <div className="card-body">
                <YahooLeagueImport
                  accessToken={yahooAccessToken}
                  onLeagueSelect={handleLeagueSelect}
                  onImportComplete={handleLeagueImport}
                />
              </div>
            </div>
          )}
        </div>

        {/* Main Content - Player Board */}
        <div className="xl:col-span-4">
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
  )
}
