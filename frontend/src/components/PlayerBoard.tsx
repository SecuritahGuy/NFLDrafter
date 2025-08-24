import React, { useState, useMemo, useRef, useEffect } from 'react'
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  EyeIcon,
  PlusIcon,
  MinusIcon,
  ChartBarIcon,
  UserIcon,
  FireIcon
} from '@heroicons/react/24/outline'
import type { ADPData } from './ADPImport'
import type { PlayerNews, WeeklyStats, DepthChartPosition } from './PlayerDrawer'

// Types
export interface Player {
  id: string
  name: string
  position: string
  team: string
  fantasyPoints: number
  yahooPoints: number
  delta: number
  vorp: number
  tier: number
  adp: number
  newsCount: number
  byeWeek: number
}

export interface PlayerBoardProps {
  players: Player[]
  selectedPosition: string
  searchQuery: string
  onPlayerSelect: (player: Player) => void
  onAddToWatchlist: (player: Player) => void
  onRemoveFromWatchlist: (playerId: string) => void
  watchlist: string[]
  scoringProfile?: string
  importedADP?: Record<string, number>
  onADPImport?: (adpData: ADPData[]) => void
  weeklyStats?: Record<string, WeeklyStats[]>
  news?: Record<string, PlayerNews[]>
  depthChart?: Record<string, DepthChartPosition[]>
  playerNotes?: Record<string, string>
  onPlayerNotesChange?: (playerId: string, notes: string) => void
}

type SortField = 'name' | 'position' | 'team' | 'fantasyPoints' | 'yahooPoints' | 'delta' | 'vorp' | 'tier' | 'adp' | 'valueVsADP'
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
  importedADP = {},
  onADPImport,
  weeklyStats = {},
  news = {},
  depthChart = {},
  playerNotes = {},
  onPlayerNotesChange,
}) => {
  const [sortField, setSortField] = useState<SortField>('fantasyPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0)
  const [scrollTop, setScrollTop] = useState<number>(0)
  const [showADPImport, setShowADPImport] = useState<boolean>(false)
  const [selectedPlayerForDrawer, setSelectedPlayerForDrawer] = useState<Player | null>(null)
  
  const tableRef = useRef<HTMLDivElement>(null)
  const selectedRowRef = useRef<HTMLTableRowElement>(null)

  // Calculate Value vs ADP for each player
  const playersWithValueVsADP = useMemo(() => {
    return players.map(player => {
      const importedADPValue = importedADP[player.name]
      let valueVsADP = null
      
      if (importedADPValue && player.adp) {
        const difference = importedADPValue - player.adp
        valueVsADP = {
          value: difference,
          isValue: difference > 0,
          percentage: ((difference / player.adp) * 100).toFixed(1)
        }
      }
      
      return {
        ...player,
        valueVsADP,
        effectiveADP: importedADPValue || player.adp
      }
    })
  }, [players, importedADP])

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    let filtered = playersWithValueVsADP.filter(player => {
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
      
      // Handle Value vs ADP sorting
      if (sortField === 'valueVsADP') {
        aValue = a.valueVsADP?.value || 0
        bValue = b.valueVsADP?.value || 0
      }
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return filtered
  }, [playersWithValueVsADP, selectedPosition, searchQuery, sortField, sortDirection])

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
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Toggle player expansion
  const handleRowExpand = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId)
  }

  // Handle scroll events
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!filteredAndSortedPlayers.length) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedRowIndex(prev => Math.min(prev + 1, filteredAndSortedPlayers.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedRowIndex(prev => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (selectedRowIndex >= 0 && selectedRowIndex < filteredAndSortedPlayers.length) {
            onPlayerSelect(filteredAndSortedPlayers[selectedRowIndex])
          }
          break
        case 'a':
        case 'A':
          e.preventDefault()
          if (selectedRowIndex >= 0 && selectedRowIndex < filteredAndSortedPlayers.length) {
            const player = filteredAndSortedPlayers[selectedRowIndex]
            if (!watchlist.includes(player.id)) {
              onAddToWatchlist(player)
            }
          }
          break
        case 'r':
        case 'R':
          e.preventDefault()
          if (selectedRowIndex >= 0 && selectedRowIndex < filteredAndSortedPlayers.length) {
            const player = filteredAndSortedPlayers[selectedRowIndex]
            if (watchlist.includes(player.id)) {
              onRemoveFromWatchlist(player.id)
            }
          }
          break
        case 'Escape':
          setSelectedRowIndex(-1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [filteredAndSortedPlayers, selectedRowIndex, watchlist, onAddToWatchlist, onRemoveFromWatchlist, onPlayerSelect])

  // Scroll to selected row
  useEffect(() => {
    if (selectedRowRef.current && selectedRowIndex >= 0) {
      selectedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

  // Get position color
  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      QB: 'bg-blue-100 text-blue-800 border-blue-200',
      RB: 'bg-green-100 text-green-800 border-green-200',
      WR: 'bg-purple-100 text-purple-800 border-purple-200',
      TE: 'bg-orange-100 text-orange-800 border-orange-200',
      K: 'bg-gray-100 text-gray-800 border-gray-200',
      DEF: 'bg-red-100 text-red-800 border-red-200',
    }
    return colors[position] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Get tier color
  const getTierColor = (tier: number) => {
    const colors = [
      'bg-red-100 text-red-800 border-red-200',
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-yellow-100 text-yellow-800 border-yellow-200',
      'bg-green-100 text-green-800 border-green-200',
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-purple-100 text-purple-800 border-purple-200',
    ]
    return colors[Math.min(tier - 1, colors.length - 1)] || 'bg-gray-100 text-gray-800 border-gray-200'
  }

  // Get VORP color
  const getVorpColor = (vorp: number) => {
    if (vorp >= 50) return 'text-green-600 font-bold'
    if (vorp >= 25) return 'text-green-500 font-semibold'
    if (vorp >= 10) return 'text-blue-600 font-medium'
    if (vorp <= -25) return 'text-red-600 font-semibold'
    if (vorp <= -10) return 'text-red-500 font-medium'
    return 'text-gray-600'
  }

  // Get delta color
  const getDeltaColor = (delta: number) => {
    if (delta > 0) return 'text-green-600'
    if (delta < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  // Get value vs ADP color
  const getValueVsADPColor = (valueVsADP: any) => {
    if (!valueVsADP) return 'text-gray-500'
    if (valueVsADP.isValue) return 'text-green-600 font-semibold'
    return 'text-red-600 font-semibold'
  }

  // Sort header component
  const SortHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center justify-between w-full px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded transition-colors"
    >
      {children}
      <div className="flex flex-col">
        <ChevronUpIcon 
          className={`w-3 h-3 ${sortField === field && sortDirection === 'asc' ? 'text-primary-600' : 'text-gray-400'}`} 
        />
        <ChevronDownIcon 
          className={`w-3 h-3 ${sortField === field && sortDirection === 'desc' ? 'text-primary-600' : 'text-gray-400'}`} 
        />
      </div>
    </button>
  )

           // Handle ADP import
         const handleADPImport = (adpData: ADPData[]) => {
           if (onADPImport) {
             onADPImport(adpData)
           }
           setShowADPImport(false)
         }

         // Handle player drawer
         const handlePlayerDrawerOpen = (player: Player) => {
           setSelectedPlayerForDrawer(player)
         }

         const handlePlayerDrawerClose = () => {
           setSelectedPlayerForDrawer(null)
         }

         const handlePlayerNotesChange = (notes: string) => {
           if (selectedPlayerForDrawer && onPlayerNotesChange) {
             onPlayerNotesChange(selectedPlayerForDrawer.id, notes)
           }
         }

    return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ChartBarIcon className="w-6 h-6 text-primary-600" />
              <h3 className="text-xl font-bold text-gray-900">Player Board</h3>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded-full font-medium">
                {filteredAndSortedPlayers.length} players
              </span>
              {scoringProfile && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full">
                  {scoringProfile}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Position Filter */}
            <div className="relative">
              <FunnelIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
                value={selectedPosition}
                onChange={(e) => onPlayerSelect({} as Player)} // Reset selection
              >
                <option value="ALL">All Positions</option>
                <option value="QB">QB</option>
                <option value="RB">RB</option>
                <option value="WR">WR</option>
                <option value="TE">TE</option>
                <option value="K">K</option>
                <option value="DEF">DEF</option>
              </select>
            </div>
            
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search players..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-64"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ADP Import Modal */}
      {showADPImport && onADPImport && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Import ADP Data</h3>
              <button
                onClick={() => setShowADPImport(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <span className="sr-only">Close</span>
                <ChevronUpIcon className="h-6 w-6" />
              </button>
            </div>
            <ADPImport
              onADPImport={handleADPImport}
              currentADP={importedADP}
            />
          </div>
        </div>
      )}

                     {/* Virtualized Table */}
               <div
                 ref={tableRef}
                 className="overflow-hidden"
                 onScroll={handleScroll}
               >
                 <div style={{ height: totalHeight, position: 'relative' }}>
                   <table className="w-full">
                     <thead className="bg-gray-50 border-b border-gray-200">
                       <tr>
                         <th className="px-4 py-3 text-left">
                           <SortHeader field="name">Player</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-left">
                           <SortHeader field="position">Pos</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-left">
                           <SortHeader field="team">Team</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <SortHeader field="fantasyPoints">My Pts</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <SortHeader field="yahooPoints">Yahoo Pts</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <SortHeader field="delta">Δ</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <SortHeader field="vorp">VORP</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <SortHeader field="tier">Tier</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <SortHeader field="adp">ADP</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <SortHeader field="valueVsADP">Value vs ADP</SortHeader>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <span className="px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">News</span>
                         </th>
                         <th className="px-4 py-3 text-center">
                           <span className="px-3 py-2 text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</span>
                         </th>
                       </tr>
                     </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
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
                                 className={`group hover:bg-gray-50 transition-colors cursor-pointer ${
                                   isSelected ? 'bg-primary-50 ring-2 ring-primary-500' : ''
                                 }`}
                                 onClick={() => onPlayerSelect(player)}
                                 onDoubleClick={() => handlePlayerDrawerOpen(player)}
                                 data-testid={`player-row-${player.id}`}
                                 style={{
                                   position: 'absolute',
                                   top: globalIndex * ROW_HEIGHT,
                                   width: '100%',
                                   height: ROW_HEIGHT,
                                 }}
                               >
                        {/* Player Name */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${getPositionColor(player.position)}`}>
                              {player.position}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 group-hover:text-primary-600 transition-colors">
                                {player.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                Week {player.byeWeek} • {player.newsCount} news
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPositionColor(player.position)}`}>
                            {player.position}
                          </span>
                        </td>

                        {/* Team */}
                        <td className="px-4 py-3">
                          <span className="font-medium text-gray-900">{player.team}</span>
                        </td>

                        {/* My Points */}
                        <td className="px-4 py-3 text-center">
                          <div className="font-bold text-gray-900">{player.fantasyPoints.toFixed(1)}</div>
                          <div className="text-xs text-gray-500">pts</div>
                        </td>

                        {/* Yahoo Points */}
                        <td className="px-4 py-3 text-center">
                          <div className="font-medium text-gray-700">{player.yahooPoints.toFixed(1)}</div>
                          <div className="text-xs text-gray-500">pts</div>
                        </td>

                        {/* Delta */}
                        <td className="px-4 py-3 text-center">
                          <div className={`font-semibold ${getDeltaColor(player.delta)}`}>
                            {player.delta > 0 ? '+' : ''}{player.delta.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">diff</div>
                        </td>

                        {/* VORP */}
                        <td className="px-4 py-3 text-center">
                          <div className={`font-semibold ${getVorpColor(player.vorp)}`}>
                            {player.vorp.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">vorp</div>
                        </td>

                        {/* Tier */}
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTierColor(player.tier)}`}>
                            T{player.tier}
                          </span>
                        </td>

                        {/* ADP */}
                        <td className="px-4 py-3 text-center">
                          <div className="font-medium text-gray-700">{player.effectiveADP}</div>
                          <div className="text-xs text-gray-500">adp</div>
                        </td>

                        {/* Value vs ADP */}
                        <td className="px-4 py-3 text-center">
                          {player.valueVsADP ? (
                            <div>
                              <div className={`font-semibold ${getValueVsADPColor(player.valueVsADP)}`}>
                                {player.valueVsADP.isValue ? '+' : ''}{player.valueVsADP.value}
                              </div>
                              <div className="text-xs text-gray-500">
                                {player.valueVsADP.percentage}%
                              </div>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-xs">N/A</div>
                          )}
                        </td>

                        {/* News */}
                        <td className="px-4 py-3 text-center">
                          {player.newsCount > 0 ? (
                            <div className="flex items-center justify-center">
                              <FireIcon className="w-4 h-4 text-orange-500" />
                              <span className="ml-1 text-xs font-medium text-orange-600">{player.newsCount}</span>
                            </div>
                          ) : (
                            <div className="text-gray-400 text-xs">-</div>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (watchlist.includes(player.id)) {
                                  onRemoveFromWatchlist(player.id)
                                } else {
                                  onAddToWatchlist(player)
                                }
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                watchlist.includes(player.id)
                                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                  : 'bg-green-100 text-green-600 hover:bg-green-200'
                              }`}
                              title={watchlist.includes(player.id) ? 'Remove from watchlist' : 'Add to watchlist'}
                            >
                              {watchlist.includes(player.id) ? (
                                <MinusIcon className="w-4 h-4" />
                              ) : (
                                <PlusIcon className="w-4 h-4" />
                              )}
                            </button>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleRowExpand(player.id)
                              }}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                              title="View details"
                            >
                              <EyeIcon className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Row */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={12} className="px-4 py-4 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              {/* Player Stats */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <ChartBarIcon className="w-4 h-4 text-primary-600" />
                                  Season Stats
                                </h4>
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                  <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                      <div className="text-gray-600">Fantasy Points</div>
                                      <div className="font-bold text-lg text-gray-900">{player.fantasyPoints.toFixed(1)}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-600">VORP</div>
                                      <div className="font-bold text-lg text-gray-900">{player.vorp.toFixed(1)}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-600">Tier</div>
                                      <div className="font-bold text-lg text-gray-900">T{player.tier}</div>
                                    </div>
                                    <div>
                                      <div className="text-gray-600">ADP</div>
                                      <div className="font-bold text-lg text-gray-900">{player.effectiveADP}</div>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* News */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <FireIcon className="w-4 h-4 text-orange-600" />
                                  Recent News
                                </h4>
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                  {player.newsCount > 0 ? (
                                    <div className="text-sm text-gray-600">
                                      {player.newsCount} recent news items available
                                    </div>
                                  ) : (
                                    <div className="text-sm text-gray-500">No recent news</div>
                                  )}
                                </div>
                              </div>

                              {/* Notes */}
                              <div className="space-y-3">
                                <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                                  <UserIcon className="w-4 h-4 text-primary-600" />
                                  Notes
                                </h4>
                                <div className="bg-white rounded-lg p-4 border border-gray-200">
                                  <textarea
                                    placeholder="Add your notes about this player..."
                                    className="w-full h-20 p-2 border border-gray-300 rounded text-sm resize-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    value={playerNotes[player.id] || ''}
                                    onChange={(e) => onPlayerNotesChange(player.id, e.target.value)}
                                    onClick={(e) => e.stopPropagation()}
                                  />
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

      {/* Player Drawer */}
      <PlayerDrawer
        player={selectedPlayerForDrawer}
        isOpen={!!selectedPlayerForDrawer}
        onClose={handlePlayerDrawerClose}
        weeklyStats={selectedPlayerForDrawer ? weeklyStats[selectedPlayerForDrawer.id] || [] : []}
        news={selectedPlayerForDrawer ? news[selectedPlayerForDrawer.id] || [] : []}
        depthChart={selectedPlayerForDrawer ? depthChart[selectedPlayerForDrawer.id] || [] : []}
        notes={selectedPlayerForDrawer ? playerNotes[selectedPlayerForDrawer.id] || '' : ''}
        onNotesChange={onPlayerNotesChange ? handlePlayerNotesChange : undefined}
      />
    </div>
  )
}
