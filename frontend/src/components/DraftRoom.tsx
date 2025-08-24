import React, { useState, useMemo } from 'react'
import { PlayerBoard } from './PlayerBoard'
import { Watchlist } from './Watchlist'
import { RosterBar } from './RosterBar'
import { Tiering } from './Tiering'
import { VORP } from './VORP'
import { ADPImport } from './ADPImport'
import type { Player } from './PlayerBoard'

export const DraftRoom: React.FC = () => {
  const [watchlist, setWatchlist] = useState<string[]>([])
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [scoringProfile, setScoringProfile] = useState<string>('Standard PPR')
  const [importedADP, setImportedADP] = useState<Record<string, number>>({})
  const [playerNotes, setPlayerNotes] = useState<Record<string, string>>({})
  
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
    setWatchlist(prev => [...prev, player.id])
  }

  const handleRemoveFromWatchlist = (playerId: string) => {
    setWatchlist(prev => prev.filter(id => id !== playerId))
  }

  const handleADPImport = (adpData: any[]) => {
    const adpMap: Record<string, number> = {}
    adpData.forEach(item => {
      adpMap[item.playerName] = item.adp
    })
    setImportedADP(adpMap)
  }

  const handlePlayerNotesChange = (playerId: string, notes: string) => {
    setPlayerNotes(prev => ({
      ...prev,
      [playerId]: notes
    }))
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
                scoringProfile={scoringProfile}
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
                scoringProfile={scoringProfile}
              />
            </div>
          </div>
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
              <ADPImport
                onADPImport={handleADPImport}
                currentADP={importedADP}
              />
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
