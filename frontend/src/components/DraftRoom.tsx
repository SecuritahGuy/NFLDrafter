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
    <ToastProvider>
      <DraftRoomContent />
    </ToastProvider>
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
    <div className="container">
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar - Watchlist & Tools */}
        <div className="lg:col-span-1 space-y-6">
          {/* Watchlist */}
                       <div className="card">
               <div className="card-header">
                 <h3 className="text-lg font-semibold">📋 Watchlist</h3>
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
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">🏗️ Tiering</h3>
            </div>
            <div className="card-body">
              <Tiering
                players={mockPlayers}
              />
            </div>
          </div>

          {/* VORP Calculator */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">📊 VORP</h3>
            </div>
            <div className="card-body">
              <VORP
                players={mockPlayers}
                onVorpChange={handleVorpChange}
              />
            </div>
          </div>

          {/* Yahoo OAuth */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">🔗 Yahoo Integration</h3>
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
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">🏈 League Import</h3>
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
        <div className="lg:col-span-2">
          <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold">👥 Player Board</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {mockPlayers.length} players available • {scoringProfile}
                  </p>
                </div>
                <div className="flex items-center space-x-3">
                  <select
                    className="input"
                    value={selectedPosition}
                    onChange={(e) => setSelectedPosition(e.target.value)}
                    style={{ width: 'auto', minWidth: '100px' }}
                  >
                    <option value="ALL">All Positions</option>
                    <option value="QB">QB</option>
                    <option value="RB">RB</option>
                    <option value="WR">WR</option>
                    <option value="TE">TE</option>
                    <option value="K">K</option>
                    <option value="DEF">DEF</option>
                  </select>
                  
                  <input
                    type="text"
                    placeholder="Search players..."
                    className="input"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{ width: 'auto', minWidth: '200px' }}
                  />
                </div>
              </div>
            </div>
            <div className="card-body p-0">
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
                playerNotes={playerNotes}
                onPlayerNotesChange={handlePlayerNotesChange}
                loading={loading}
                error={error}
                onRetry={handleRetry}
              />
            </div>
          </div>
        </div>

        {/* Right Sidebar - Roster & ADP */}
        <div className="lg:col-span-1 space-y-6">
          {/* Roster Bar */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">🏃‍♂️ Roster</h3>
            </div>
            <div className="card-body">
              <RosterBar
                rosterSlots={rosterSlots}
                selectedPlayers={[]}
                onSlotClick={handleSlotClick}
                scoringProfile={scoringProfile}
              />
            </div>
          </div>

          {/* ADP Import */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">📈 ADP Import</h3>
            </div>
            <div className="card-body">
              <p className="text-sm text-gray-600">ADP Import functionality coming soon...</p>
            </div>
          </div>

          {/* Draft Stats */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">📊 Draft Stats</h3>
            </div>
            <div className="card-body">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Players Drafted</span>
                  <span className="font-semibold">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Rounds Completed</span>
                  <span className="font-semibold">0</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Time Elapsed</span>
                  <span className="font-semibold">00:00</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Next Pick</span>
                  <span className="font-semibold text-primary-600">1.01</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">⚡ Quick Actions</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <button className="btn btn-primary w-full">
                  📋 Export Cheat Sheet
                </button>
                <button className="btn btn-secondary w-full">
                  🔄 Reset Draft
                </button>
                <button className="btn btn-secondary w-full">
                  💾 Save Draft State
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
