import React, { useState, useCallback, useEffect } from 'react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'

// Types
export interface DraftPick {
  round: number
  pick: number
  team: string
  player?: {
    id: string
    name: string
    position: string
    team: string
  }
}

export interface RosterSlot {
  position: string
  required: number
  filled: number
}

export interface WatchlistPlayer {
  id: string
  name: string
  position: string
  team: string
  fantasyPoints?: number
  tier?: number
  addedAt: number
}

interface DraftRoomProps {
  totalTeams?: number
  totalRounds?: number
  userTeam?: number
}

// Sample data for development
const sampleRosterSlots: RosterSlot[] = [
  { position: 'QB', required: 1, filled: 0 },
  { position: 'RB', required: 2, filled: 0 },
  { position: 'WR', required: 2, filled: 0 },
  { position: 'TE', required: 1, filled: 0 },
  { position: 'FLEX', required: 1, filled: 0 },
  { position: 'K', required: 1, filled: 0 },
  { position: 'DEF', required: 1, filled: 0 },
  { position: 'BN', required: 6, filled: 0 },
]

export const DraftRoom: React.FC<DraftRoomProps> = ({
  totalTeams = 12,
  totalRounds = 16,
  userTeam = 1,
}) => {
  const [picks, setPicks] = useState<DraftPick[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistPlayer[]>([])
  const [rosterSlots, setRosterSlots] = useState<RosterSlot[]>(sampleRosterSlots)
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL')
  const [isLeftPanelCollapsed, setIsLeftPanelCollapsed] = useState(false)
  const [isRightPanelCollapsed, setIsRightPanelCollapsed] = useState(false)

  // Initialize draft picks grid
  useEffect(() => {
    const initialPicks: DraftPick[] = []
    for (let round = 1; round <= totalRounds; round++) {
      for (let pick = 1; pick <= totalTeams; pick++) {
        const isSnake = round % 2 === 0
        const actualPick = isSnake ? totalTeams - pick + 1 : pick
        const team = `Team ${actualPick}`
        
        initialPicks.push({
          round,
          pick: (round - 1) * totalTeams + pick,
          team,
        })
      }
    }
    setPicks(initialPicks)
  }, [totalTeams, totalRounds])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not typing in an input
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (event.key.toLowerCase()) {
        case 'a':
          event.preventDefault()
          // TODO: Add selected player to watchlist
          console.log('Add to watchlist shortcut triggered')
          break
        case 'r':
          event.preventDefault()
          // TODO: Remove selected player from watchlist
          console.log('Remove from watchlist shortcut triggered')
          break
        case '/':
          event.preventDefault()
          // TODO: Focus search input
          console.log('Focus search shortcut triggered')
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
          event.preventDefault()
          const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF']
          const positionIndex = parseInt(event.key) - 1
          if (positions[positionIndex]) {
            setSelectedPosition(positions[positionIndex])
          }
          break
      }
    }

    document.addEventListener('keydown', handleKeyPress)
    return () => document.removeEventListener('keydown', handleKeyPress)
  }, [])

  const addToWatchlist = useCallback((player: WatchlistPlayer) => {
    setWatchlist(prev => {
      if (prev.some(p => p.id === player.id)) {
        return prev // Already in watchlist
      }
      return [...prev, { ...player, addedAt: Date.now() }]
    })
  }, [])

  const removeFromWatchlist = useCallback((playerId: string) => {
    setWatchlist(prev => prev.filter(p => p.id !== playerId))
  }, [])

  const isUserPick = useCallback((pick: DraftPick) => {
    return pick.team === `Team ${userTeam}`
  }, [userTeam])

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Left Panel - Pick Grid */}
      <div className={`transition-all duration-300 ${isLeftPanelCollapsed ? 'w-8' : 'w-80'} bg-white border-r border-gray-200 flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          {!isLeftPanelCollapsed && (
            <h2 className="text-lg font-semibold text-gray-900">Draft Board</h2>
          )}
          <button
            onClick={() => setIsLeftPanelCollapsed(!isLeftPanelCollapsed)}
            className="p-1 rounded hover:bg-gray-100"
            aria-label={isLeftPanelCollapsed ? 'Expand draft board' : 'Collapse draft board'}
          >
            {isLeftPanelCollapsed ? (
              <ChevronRightIcon className="h-5 w-5" />
            ) : (
              <ChevronLeftIcon className="h-5 w-5" />
            )}
          </button>
        </div>
        
        {!isLeftPanelCollapsed && (
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
              {Array.from({ length: totalRounds }, (_, roundIndex) => (
                <div key={roundIndex + 1} className="flex space-x-1">
                  <div className="w-8 text-xs font-medium text-gray-500 flex items-center justify-center">
                    {roundIndex + 1}
                  </div>
                  {Array.from({ length: totalTeams }, (_, teamIndex) => {
                    const isSnake = (roundIndex + 1) % 2 === 0
                    const actualTeam = isSnake ? totalTeams - teamIndex : teamIndex + 1
                    const pickNumber = roundIndex * totalTeams + teamIndex + 1
                    const pick = picks.find(p => p.pick === pickNumber)
                    const isUser = actualTeam === userTeam
                    
                    return (
                      <div
                        key={teamIndex}
                        className={`
                          flex-1 min-w-0 h-8 text-xs border rounded px-1 flex items-center justify-center
                          ${isUser ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}
                          ${pick?.player ? 'bg-green-50 border-green-200' : ''}
                        `}
                        title={`Round ${roundIndex + 1}, Pick ${pickNumber} - Team ${actualTeam}`}
                      >
                        {pick?.player ? (
                          <span className="truncate font-medium">
                            {pick.player.name}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Center Panel - Player Board */}
      <div className="flex-1 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Player Board</h2>
            <div className="flex items-center space-x-4">
              {/* Position Filter */}
              <div className="flex space-x-1">
                {['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map((position, index) => (
                  <button
                    key={position}
                    onClick={() => setSelectedPosition(position)}
                    className={`
                      px-3 py-1 text-sm rounded
                      ${selectedPosition === position
                        ? 'bg-blue-100 text-blue-700 border border-blue-200'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }
                    `}
                    title={`Filter by ${position} (${index + 1})`}
                  >
                    {position}
                  </button>
                ))}
              </div>
              
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search players... (/)"
                  className="px-3 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex-1 overflow-auto">
          <div className="p-4">
            <div className="text-center text-gray-500 py-8">
              Player board will be implemented next with virtualized table
              <br />
              <span className="text-sm">
                Filtered by: {selectedPosition}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Roster & Watchlist */}
      <div className={`transition-all duration-300 ${isRightPanelCollapsed ? 'w-8' : 'w-80'} bg-white border-l border-gray-200 flex flex-col`}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <button
            onClick={() => setIsRightPanelCollapsed(!isRightPanelCollapsed)}
            className="p-1 rounded hover:bg-gray-100"
            aria-label={isRightPanelCollapsed ? 'Expand roster panel' : 'Collapse roster panel'}
          >
            {isRightPanelCollapsed ? (
              <ChevronLeftIcon className="h-5 w-5" />
            ) : (
              <ChevronRightIcon className="h-5 w-5" />
            )}
          </button>
          {!isRightPanelCollapsed && (
            <h2 className="text-lg font-semibold text-gray-900">My Team</h2>
          )}
        </div>
        
        {!isRightPanelCollapsed && (
          <div className="flex-1 overflow-auto">
            {/* Roster Bar */}
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Roster</h3>
              <div className="space-y-2">
                {rosterSlots.map((slot) => (
                  <div key={slot.position} className="flex items-center justify-between text-sm">
                    <span className="font-medium">{slot.position}</span>
                    <span className={`
                      px-2 py-1 rounded text-xs
                      ${slot.filled >= slot.required
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                      }
                    `}>
                      {slot.filled}/{slot.required}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Watchlist */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-gray-700">Watchlist</h3>
                <span className="text-xs text-gray-500">A/R</span>
              </div>
              
              {watchlist.length === 0 ? (
                <div className="text-center text-gray-500 text-sm py-4">
                  No players in watchlist
                  <br />
                  <span className="text-xs">Press 'A' to add players</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {watchlist.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                    >
                      <div>
                        <div className="font-medium">{player.name}</div>
                        <div className="text-gray-500 text-xs">
                          {player.position} - {player.team}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromWatchlist(player.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                        title="Remove from watchlist (R)"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
