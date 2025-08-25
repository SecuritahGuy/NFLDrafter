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
import { CheatSheetExport } from './CheatSheetExport'
import { LoadingState } from './LoadingState'
import { ErrorDisplay } from './ErrorDisplay'
import type { Player } from '../types'

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
  onADPImport?: (adpData: any[]) => void
  weeklyStats?: Record<string, any[]>
  news?: Record<string, any[]>
  depthChart?: Record<string, any[]>
  playerNotes?: Record<string, string>
  onPlayerNotesChange?: (playerId: string, notes: string) => void
  loading?: boolean
  error?: Error | null
  onRetry?: () => void
}

type SortField = 'name' | 'position' | 'team' | 'fantasyPoints' | 'yahooPoints' | 'delta' | 'vorp' | 'tier' | 'adp' | 'valueVsADP'
type SortDirection = 'asc' | 'desc'

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
  loading = false,
  error = null,
  onRetry,
}) => {
  const [sortField, setSortField] = useState<SortField>('fantasyPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(0)
  const [scrollTop, setScrollTop] = useState<number>(0)
  const [showADPImport, setShowADPImport] = useState<boolean>(false)
  
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

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Handle row selection
  const handleRowClick = (player: Player, index: number) => {
    setSelectedRowIndex(index)
    onPlayerSelect(player)
  }

  // Handle row expansion
  const handleRowExpand = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId)
  }

  // Handle scroll
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop)
  }

  // Enhanced keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedRowIndex(prev => 
            prev < filteredAndSortedPlayers.length - 1 ? prev + 1 : prev
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedRowIndex(prev => prev > 0 ? prev - 1 : prev)
          break
        case 'Enter':
          e.preventDefault()
          if (selectedRowIndex >= 0 && selectedRowIndex < filteredAndSortedPlayers.length) {
            const player = filteredAndSortedPlayers[selectedRowIndex]
            onPlayerSelect(player)
          }
          break
        case 'a':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (selectedRowIndex >= 0 && selectedRowIndex < filteredAndSortedPlayers.length) {
              const player = filteredAndSortedPlayers[selectedRowIndex]
              onAddToWatchlist(player)
            }
          }
          break
        case 'r':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault()
            if (selectedRowIndex >= 0 && selectedRowIndex < filteredAndSortedPlayers.length) {
              const player = filteredAndSortedPlayers[selectedRowIndex]
              onRemoveFromWatchlist(player.id)
            }
          }
          break
        case '/':
          e.preventDefault()
          // Focus search input
          const searchInput = document.querySelector('input[placeholder="Search players..."]') as HTMLInputElement
          if (searchInput) {
            searchInput.focus()
            searchInput.select()
          }
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            // Quick position filtering
            const positions = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K']
            const positionIndex = parseInt(e.key) - 1
            if (positionIndex < positions.length) {
              const newPosition = positions[positionIndex]
              // This would need to be handled by the parent component
              console.log('Quick position filter:', newPosition)
            }
          }
          break
        case 'n':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            // Toggle news display
            console.log('Toggle news display')
          }
          break
        case 'p':
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault()
            // Pin MyPts column
            console.log('Pin MyPts column')
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

  // Handle loading and error states
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-6 h-6 text-primary-600" />
            <h3 className="text-xl font-bold text-gray-900">Player Board</h3>
          </div>
        </div>
        <div className="p-6">
          <LoadingState 
            loading={true} 
            type="skeleton" 
            message="Loading players..."
            skeletonRows={10}
            skeletonColumns={8}
          >
            <div>Loading...</div>
          </LoadingState>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
          <div className="flex items-center gap-2">
            <ChartBarIcon className="w-6 h-6 text-primary-600" />
            <h3 className="text-xl font-bold text-gray-900">Player Board</h3>
          </div>
        </div>
        <div className="p-6">
          <ErrorDisplay 
            error={{
              title: 'Failed to load players',
              message: error.message,
              severity: 'high',
              timestamp: new Date(),
              details: 'Unable to fetch player data from the server',
              suggestions: ['Check your internet connection', 'Try refreshing the page'],
              retryable: !!onRetry,
              onRetry: onRetry ? async () => onRetry() : undefined
            }}
            showRetry={!!onRetry}
          />
        </div>
      </div>
    )
  }

  if (!players.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <UserIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <div className="text-xl font-medium">No players available</div>
        <div className="text-sm">Please add players to see the draft board</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-50 to-gray-50">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-lg">
                <ChartBarIcon className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Player Board</h3>
                <p className="text-sm text-gray-600">Comprehensive player analysis and rankings</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 bg-primary-100 text-primary-800 rounded-full font-semibold text-sm">
                {filteredAndSortedPlayers.length} players
              </div>
              {scoringProfile && (
                <div className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full font-medium text-sm">
                  {scoringProfile}
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Position Filter */}
            <div className="relative">
              <FunnelIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <select
                className="pl-10 pr-8 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white font-medium min-w-[140px]"
                value={selectedPosition}
                onChange={(e) => {
                  // This would need to be handled by the parent component
                  // For now, we'll just log the position change
                  console.log('Position filter:', e.target.value)
                }}
              >
                <option value="ALL">All Positions</option>
                <option value="QB">Quarterbacks</option>
                <option value="RB">Running Backs</option>
                <option value="WR">Wide Receivers</option>
                <option value="TE">Tight Ends</option>
                <option value="K">Kickers</option>
                <option value="DEF">Defenses</option>
              </select>
            </div>
            
            {/* Search */}
            <div className="relative">
              <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search players..."
                className="pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 w-72 bg-white font-medium"
                value={searchQuery}
                onChange={(e) => {
                  // This would need to be handled by the parent component
                  // For now, we'll just log the search query
                  console.log('Search query:', e.target.value)
                }}
              />
            </div>

            {/* Keyboard Shortcuts Help */}
            <div className="relative group">
              <button
                className="p-2.5 text-gray-400 hover:text-gray-600 transition-colors bg-gray-100 hover:bg-gray-200 rounded-lg"
                title="Keyboard Shortcuts"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </button>
              
              {/* Enhanced Tooltip */}
              <div className="absolute right-0 top-full mt-2 w-80 bg-gray-900 text-white text-sm rounded-xl p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 border border-gray-700">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <span className="font-semibold text-primary-400">Keyboard Shortcuts</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-gray-700">
                    <span className="text-gray-300">↑↓</span>
                    <span>Navigate rows</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-700">
                    <span className="text-gray-300">Enter</span>
                    <span>Select player</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-700">
                    <span className="text-gray-300">Ctrl+A</span>
                    <span>Add to watchlist</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-700">
                    <span className="text-gray-300">Ctrl+R</span>
                    <span>Remove from watchlist</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-700">
                    <span className="text-gray-300">/</span>
                    <span>Focus search</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-700">
                    <span className="text-gray-300">1-6</span>
                    <span>Quick position filter</span>
                  </div>
                  <div className="flex justify-between items-center py-1 border-b border-gray-700">
                    <span className="text-gray-300">N</span>
                    <span>Toggle news</span>
                  </div>
                  <div className="flex justify-between items-center py-1">
                    <span className="text-gray-300">P</span>
                    <span>Pin MyPts column</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cheat Sheet Export */}
            <CheatSheetExport
              players={filteredAndSortedPlayers}
              scoringProfile={scoringProfile}
              filters={{
                position: selectedPosition !== 'ALL' ? selectedPosition : undefined,
                search: searchQuery || undefined,
                tier: undefined // We can add tier filtering later
              }}
              onExport={(format) => {
                console.log(`Exporting ${filteredAndSortedPlayers.length} players to ${format}`)
                // The actual export logic is handled inside the CheatSheetExport component
              }}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-gray-50 to-slate-50 border-b-2 border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left">
                  <SortHeader field="name">
                    <div className="flex items-center gap-2">
                      <UserIcon className="w-4 h-4 text-gray-500" />
                      <span>Player</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="position">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-primary-500 rounded-full"></div>
                      <span>Pos</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="team">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                      <span>Team</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="fantasyPoints">
                    <div className="flex items-center justify-center gap-2">
                      <ChartBarIcon className="w-4 h-4 text-primary-500" />
                      <span>My Pts</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="yahooPoints">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                      <span>Yahoo Pts</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="delta">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                      <span>Δ</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="vorp">
                    <div className="flex items-center justify-center gap-2">
                      <FireIcon className="w-4 h-4 text-orange-500" />
                      <span>VORP</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="tier">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 bg-purple-500 rounded-lg"></div>
                      <span>Tier</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="adp">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <span>ADP</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <SortHeader field="valueVsADP">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 bg-indigo-500 rounded-full"></div>
                      <span>Value vs ADP</span>
                    </div>
                  </SortHeader>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 bg-red-500 rounded"></div>
                    <span className="font-semibold text-gray-700 uppercase tracking-wider text-sm">News</span>
                  </div>
                </th>
                <th className="px-4 py-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 bg-gray-500 rounded"></div>
                    <span className="font-semibold text-gray-700 uppercase tracking-wider text-sm">Actions</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredAndSortedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-16 text-center">
                    <div className="max-w-md mx-auto">
                      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MagnifyingGlassIcon className="w-8 h-8 text-gray-400" />
                      </div>
                      <div className="text-xl font-semibold text-gray-900 mb-2">No players found</div>
                      <div className="text-gray-500 mb-4">Try adjusting your filters or search query to find more players</div>
                      <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                        <FunnelIcon className="w-4 h-4" />
                        <span>Use the position filter above</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredAndSortedPlayers.map((player, index) => {
                  const isSelected = index === selectedRowIndex
                  const isExpanded = expandedPlayer === player.id
                  const isInWatchlist = watchlist.includes(player.id)
                  
                  return (
                    <React.Fragment key={player.id}>
                      <tr
                        ref={isSelected ? selectedRowRef : null}
                        className={`group hover:bg-gradient-to-r hover:from-gray-50 hover:to-slate-50 transition-all duration-200 cursor-pointer ${
                          isSelected ? 'bg-gradient-to-r from-primary-50 to-blue-50 ring-2 ring-primary-500 shadow-sm' : ''
                        }`}
                        onClick={() => handleRowClick(player, index)}
                      >
                        {/* Player Name */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold border-2 shadow-sm ${getPositionColor(player.position)}`}>
                              {player.position}
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors text-base">
                                {player.name}
                              </div>
                              <div className="text-sm text-gray-500 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                  Week {player.byeWeek}
                                </span>
                                <span className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                  {player.newsCount} news
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Position */}
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold border-2 shadow-sm ${getPositionColor(player.position)}`}>
                            {player.position}
                          </span>
                        </td>

                        {/* Team */}
                        <td className="px-4 py-4 text-center">
                          <span className="font-semibold text-gray-900 text-base">{player.team}</span>
                        </td>

                        {/* My Points */}
                        <td className="px-4 py-4 text-center">
                          <div className="font-bold text-gray-900 text-lg">{player.fantasyPoints.toFixed(1)}</div>
                          <div className="text-xs text-gray-500 font-medium">points</div>
                        </td>

                        {/* Yahoo Points */}
                        <td className="px-4 py-4 text-center">
                          <div className="font-semibold text-gray-700 text-base">{player.yahooPoints.toFixed(1)}</div>
                          <div className="text-xs text-gray-500 font-medium">points</div>
                        </td>

                        {/* Delta */}
                        <td className="px-4 py-4 text-center">
                          <div className={`font-semibold ${getDeltaColor(player.delta)}`}>
                            {player.delta > 0 ? '+' : ''}{player.delta.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">diff</div>
                        </td>

                        {/* VORP */}
                        <td className="px-4 py-4 text-center">
                          <div className={`font-semibold ${getVorpColor(player.vorp)}`}>
                            {player.vorp.toFixed(1)}
                          </div>
                          <div className="text-xs text-gray-500">vorp</div>
                        </td>

                        {/* Tier */}
                        <td className="px-4 py-4 text-center">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTierColor(player.tier)}`}>
                            T{player.tier}
                          </span>
                        </td>

                        {/* ADP */}
                        <td className="px-4 py-4 text-center">
                          <div className="font-medium text-gray-700">{player.effectiveADP}</div>
                          <div className="text-xs text-gray-500">adp</div>
                        </td>

                        {/* Value vs ADP */}
                        <td className="px-4 py-4 text-center">
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
                        <td className="px-4 py-4 text-center">
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
                        <td className="px-4 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                if (isInWatchlist) {
                                  onRemoveFromWatchlist(player.id)
                                } else {
                                  onAddToWatchlist(player)
                                }
                              }}
                              className={`p-2 rounded-lg transition-colors ${
                                isInWatchlist
                                  ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                  : 'bg-green-100 text-green-600 hover:bg-green-200'
                              }`}
                              title={isInWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}
                            >
                              {isInWatchlist ? (
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
                                    onChange={(e) => onPlayerNotesChange && onPlayerNotesChange(player.id, e.target.value)}
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

      {/* Empty State */}
      {filteredAndSortedPlayers.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <MagnifyingGlassIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <div className="text-xl font-medium">No players found</div>
          <div className="text-sm">Try adjusting your search or position filters</div>
        </div>
      )}

      {/* Footer */}
      <div className="px-6 py-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center gap-4">
            <span>Showing {filteredAndSortedPlayers.length} of {players.length} players</span>
            <span>•</span>
            <span>Press ↑↓ to navigate, Enter to select, A to add to watchlist</span>
          </div>
          <div className="flex items-center gap-2">
            <span>Sort by: {sortField}</span>
            <span className="text-primary-600 font-medium">{sortDirection.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
