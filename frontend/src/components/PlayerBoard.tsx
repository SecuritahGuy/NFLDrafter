import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

// Types
export interface Player {
  id: string
  name: string
  position: string
  team: string
  fantasyPoints?: number
  yahooPoints?: number
  delta?: number
  vorp?: number
  tier?: number
  adp?: number
  newsCount?: number
  byeWeek?: number
}

export interface PlayerBoardProps {
  players: Player[]
  selectedPosition: string
  searchQuery: string
  onPlayerSelect: (player: Player) => void
  onAddToWatchlist: (player: Player) => void
  onRemoveFromWatchlist: (player: Player) => void
  watchlist: string[] // Array of player IDs
  scoringProfile?: string
}

type SortField = 'name' | 'position' | 'team' | 'fantasyPoints' | 'yahooPoints' | 'delta' | 'vorp' | 'tier' | 'adp'
type SortDirection = 'asc' | 'desc'

// Virtualization constants
const ROW_HEIGHT = 60 // Height of each row in pixels
const EXPANDED_ROW_HEIGHT = 120 // Height of expanded row
const VISIBLE_ROWS = 15 // Number of rows to render at once

export const PlayerBoard: React.FC<PlayerBoardProps> = ({
  players,
  selectedPosition,
  searchQuery,
  onPlayerSelect,
  onAddToWatchlist,
  onRemoveFromWatchlist,
  watchlist,
  scoringProfile,
}) => {
  const [sortField, setSortField] = useState<SortField>('fantasyPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0)
  const [scrollTop, setScrollTop] = useState<number>(0)
  
  const tableRef = useRef<HTMLDivElement>(null)
  const selectedRowRef = useRef<HTMLTableRowElement>(null)

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = players.filter(player => {
      // Position filter
      if (selectedPosition !== 'ALL' && player.position !== selectedPosition) {
        return false
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          player.name.toLowerCase().includes(query) ||
          player.team.toLowerCase().includes(query) ||
          player.position.toLowerCase().includes(query)
        )
      }
      
      return true
    })

    // Sort players
    filtered.sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]
      
      // Handle undefined values
      if (aValue === undefined) aValue = sortDirection === 'asc' ? Infinity : -Infinity
      if (bValue === undefined) bValue = sortDirection === 'asc' ? Infinity : -Infinity
      
      // Handle string values
      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    return filtered
  }, [players, selectedPosition, searchQuery, sortField, sortDirection])

  // Virtualization calculations
  const totalHeight = useMemo(() => {
    return filteredAndSortedPlayers.reduce((height, player) => {
      return height + (expandedPlayer === player.id ? EXPANDED_ROW_HEIGHT : ROW_HEIGHT)
    }, 0)
  }, [filteredAndSortedPlayers, expandedPlayer])

  const startIndex = Math.floor(scrollTop / ROW_HEIGHT)
  const endIndex = Math.min(startIndex + VISIBLE_ROWS, filteredAndSortedPlayers.length)
  const visiblePlayers = filteredAndSortedPlayers.slice(startIndex, endIndex)

  // Handle sorting
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField, sortDirection])

  // Toggle player expansion
  const togglePlayerExpansion = useCallback((playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId)
  }, [expandedPlayer])

  // Handle scroll events
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!filteredAndSortedPlayers.length) return

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          setSelectedRowIndex(prev => 
            Math.min(prev + 1, filteredAndSortedPlayers.length - 1)
          )
          break
        case 'ArrowUp':
          event.preventDefault()
          setSelectedRowIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
          event.preventDefault()
          if (filteredAndSortedPlayers[selectedRowIndex]) {
            onPlayerSelect(filteredAndSortedPlayers[selectedRowIndex])
          }
          break
        case 'a':
        case 'A':
          event.preventDefault()
          if (filteredAndSortedPlayers[selectedRowIndex]) {
            const player = filteredAndSortedPlayers[selectedRowIndex]
            if (!watchlist.includes(player.id)) {
              onAddToWatchlist(player)
            }
          }
          break
        case 'r':
        case 'R':
          event.preventDefault()
          if (filteredAndSortedPlayers[selectedRowIndex]) {
            const player = filteredAndSortedPlayers[selectedRowIndex]
            if (watchlist.includes(player.id)) {
              onRemoveFromWatchlist(player.id)
            }
          }
          break
        case 'Escape':
          setExpandedPlayer(null)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filteredAndSortedPlayers, selectedRowIndex, watchlist, onPlayerSelect, onAddToWatchlist, onRemoveFromWatchlist])

  // Scroll to selected row
  useEffect(() => {
    if (selectedRowRef.current && tableRef.current) {
      const rowTop = selectedRowIndex * ROW_HEIGHT
      const containerHeight = tableRef.current.clientHeight
      const scrollTop = tableRef.current.scrollTop
      
      if (rowTop < scrollTop || rowTop > scrollTop + containerHeight) {
        tableRef.current.scrollTop = rowTop - containerHeight / 2
      }
    }
  }, [selectedRowIndex])

  // Format fantasy points
  const formatPoints = (points?: number) => {
    if (points === undefined) return '-'
    return points.toFixed(1)
  }

  // Format delta
  const formatDelta = (delta?: number) => {
    if (delta === undefined) return '-'
    const sign = delta >= 0 ? '+' : ''
    return `${sign}${delta.toFixed(1)}`
  }

  // Get tier color
  const getTierColor = (tier?: number) => {
    if (!tier) return 'text-gray-500'
    if (tier <= 2) return 'text-red-600 font-bold'
    if (tier <= 4) return 'text-orange-600 font-semibold'
    if (tier <= 6) return 'text-yellow-600 font-medium'
    return 'text-gray-600'
  }

  // Get VORP color
  const getVorpColor = (vorp?: number) => {
    if (!vorp) return 'text-gray-500'
    if (vorp >= 50) return 'text-green-600 font-bold'
    if (vorp >= 25) return 'text-green-500 font-semibold'
    if (vorp >= 10) return 'text-blue-600 font-medium'
    if (vorp <= -25) return 'text-red-600 font-semibold'
    if (vorp <= -10) return 'text-red-500 font-medium'
    return 'text-gray-600'
  }

  // Get delta color
  const getDeltaColor = (delta?: number) => {
    if (!delta) return 'text-gray-500'
    if (delta >= 5) return 'text-green-600 font-semibold'
    if (delta >= 2) return 'text-green-500 font-medium'
    if (delta <= -5) return 'text-red-600 font-semibold'
    if (delta <= -2) return 'text-red-500 font-medium'
    return 'text-gray-600'
  }

  // Sort header component with improved indicators
  const SortHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
    >
      <span>{children}</span>
      {sortField === field && (
        <div className="flex flex-col">
          {sortDirection === 'asc' ? (
            <ChevronUpIcon className="h-3 w-3 text-blue-600" />
          ) : (
            <ChevronDownIcon className="h-3 w-3 text-blue-600" />
          )}
        </div>
      )}
    </button>
  )

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Player Board</h2>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-500">
              {filteredAndSortedPlayers.length} players
              {scoringProfile && ` • ${scoringProfile}`}
            </div>
            <div className="text-xs text-gray-400">
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">↑↓</kbd> Navigate • 
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">Enter</kbd> Select • 
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">A</kbd> Add • 
              <kbd className="px-1 py-0.5 bg-gray-100 rounded">R</kbd> Remove
            </div>
          </div>
        </div>
      </div>

      {/* Virtualized Table */}
      <div 
        ref={tableRef}
        className="flex-1 overflow-auto"
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader field="position">Pos</SortHeader>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader field="team">Team</SortHeader>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader field="fantasyPoints">MyPts</SortHeader>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader field="yahooPoints">YahooPts</SortHeader>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader field="delta">Δ</SortHeader>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader field="vorp">VORP</SortHeader>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader field="tier">Tier</SortHeader>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <SortHeader field="adp">ADP</SortHeader>
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  News
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bye
                </th>
                <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredAndSortedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                    <div className="text-lg font-medium">No players found</div>
                    <div className="text-sm">Try adjusting your filters or search query</div>
                  </td>
                </tr>
              ) : (
                visiblePlayers.map((player, index) => {
                  const globalIndex = startIndex + index
                  const isSelected = globalIndex === selectedRowIndex
                  const isExpanded = expandedPlayer === player.id
                  
                  return (
                    <React.Fragment key={player.id}>
                      <tr 
                        ref={isSelected ? selectedRowRef : null}
                        className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                          isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : ''
                        } ${isExpanded ? 'bg-blue-50' : ''}`}
                        onClick={() => onPlayerSelect(player)}
                        data-testid={`player-row-${player.id}`}
                        style={{
                          position: 'absolute',
                          top: globalIndex * ROW_HEIGHT,
                          width: '100%',
                          height: ROW_HEIGHT,
                        }}
                      >
                        {/* Player Name */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  togglePlayerExpansion(player.id)
                                }}
                                className="h-6 w-6 text-gray-400 hover:text-gray-600 transition-colors"
                                data-testid={`expand-button-${player.id}`}
                              >
                                {isExpanded ? (
                                  <ChevronDownIcon className="h-4 w-4" />
                                ) : (
                                  <ChevronUpIcon className="h-4 w-4" />
                                )}
                              </button>
                            </div>
                            <div className="ml-2">
                              <div className="text-sm font-medium text-gray-900">{player.name}</div>
                            </div>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {player.position}
                          </span>
                        </td>

                        {/* Team */}
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {player.team}
                        </td>

                        {/* My Points */}
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                          {formatPoints(player.fantasyPoints)}
                        </td>

                        {/* Yahoo Points */}
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {formatPoints(player.yahooPoints)}
                        </td>

                        {/* Delta */}
                        <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${getDeltaColor(player.delta)}`}>
                          {formatDelta(player.delta)}
                        </td>

                        {/* VORP */}
                        <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${getVorpColor(player.vorp)}`}>
                          {player.vorp ? player.vorp.toFixed(1) : '-'}
                        </td>

                        {/* Tier */}
                        <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${getTierColor(player.tier)}`}>
                          {player.tier || '-'}
                        </td>

                        {/* ADP */}
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {player.adp ? `#${player.adp}` : '-'}
                        </td>

                        {/* News */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          {player.newsCount ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              {player.newsCount}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>

                        {/* Bye Week */}
                        <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900">
                          {player.byeWeek ? `W${player.byeWeek}` : '-'}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                          <div className="flex space-x-2">
                            {watchlist.includes(player.id) ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onRemoveFromWatchlist(player.id)
                                }}
                                className="text-red-600 hover:text-red-900 transition-colors"
                                title="Remove from watchlist (R)"
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onAddToWatchlist(player)
                                }}
                                className="text-blue-600 hover:text-blue-900 transition-colors"
                                title="Add to watchlist (A)"
                              >
                                Add
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Player Details */}
                      {isExpanded && (
                        <tr
                          style={{
                            position: 'absolute',
                            top: globalIndex * ROW_HEIGHT + ROW_HEIGHT,
                            width: '100%',
                            height: EXPANDED_ROW_HEIGHT,
                          }}
                        >
                          <td colSpan={12} className="px-6 py-4 bg-blue-50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              {/* Player Stats */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Season Stats</h4>
                                <div className="space-y-1 text-sm text-gray-600">
                                  <div>Fantasy Points: {formatPoints(player.fantasyPoints)}</div>
                                  <div>Yahoo Points: {formatPoints(player.yahooPoints)}</div>
                                  <div>VORP: {player.vorp ? player.vorp.toFixed(1) : 'N/A'}</div>
                                  <div>Tier: {player.tier || 'N/A'}</div>
                                  <div>ADP: {player.adp ? `#${player.adp}` : 'N/A'}</div>
                                </div>
                              </div>

                              {/* Recent News */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Recent News</h4>
                                <div className="text-sm text-gray-600">
                                  {player.newsCount ? (
                                    <div>{player.newsCount} news items available</div>
                                  ) : (
                                    <div>No recent news</div>
                                  )}
                                </div>
                              </div>

                              {/* Quick Actions */}
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Quick Actions</h4>
                                <div className="space-y-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onPlayerSelect(player)
                                    }}
                                    className="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                  >
                                    View Full Profile
                                  </button>
                                  {!watchlist.includes(player.id) && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onAddToWatchlist(player)
                                      }}
                                      className="w-full px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                    >
                                      Add to Watchlist
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
