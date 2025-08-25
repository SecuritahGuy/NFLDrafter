import React, { useState, useMemo, useCallback } from 'react'
import { 
  StarIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ChartBarIcon,
  FireIcon,
  EyeIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import type { Player } from '../types'

export interface WatchlistProps {
  watchlist: Player[]
  onRemoveFromWatchlist: (playerId: string) => void
  onPlayerSelect: (player: Player) => void
}

type SortField = 'name' | 'position' | 'fantasyPoints' | 'vorp' | 'tier' | 'adp'
type SortDirection = 'asc' | 'desc'

export const Watchlist: React.FC<WatchlistProps> = ({
  watchlist,
  onRemoveFromWatchlist,
  onPlayerSelect,
}) => {
  const [sortField, setSortField] = useState<SortField>('fantasyPoints')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)

  // Sort watchlist
  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
      let aValue: any = a[sortField]
      let bValue: any = b[sortField]
      
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }, [watchlist, sortField, sortDirection])

  // Handle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  // Toggle player expansion
  const togglePlayerExpansion = (playerId: string) => {
    setExpandedPlayer(expandedPlayer === playerId ? null : playerId)
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

  // Sort header component
  const SortHeader: React.FC<{ field: SortField; children: React.ReactNode }> = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center justify-between w-full px-2 py-1 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-primary-500 rounded transition-colors"
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

  if (watchlist.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <StarIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <div className="text-lg font-medium">Watchlist Empty</div>
        <div className="text-sm">Add players from the Player Board to start building your watchlist</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <StarIcon className="w-5 h-5 text-yellow-500" />
            Watchlist
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {watchlist.length} player{watchlist.length !== 1 ? 's' : ''} • Click to view details
          </p>
        </div>
      </div>

      {/* Player List */}
      <div className="space-y-3">
        {sortedWatchlist.map((player) => {
          const isExpanded = expandedPlayer === player.id
          
          return (
            <div key={player.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Player Header */}
              <div 
                className="p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => onPlayerSelect(player)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${getPositionColor(player.position)}`}>
                      {player.position}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{player.name}</div>
                      <div className="text-sm text-gray-600">{player.team} • Week {player.byeWeek}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTierColor(player.tier)}`}>
                      T{player.tier}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        togglePlayerExpansion(player.id)
                      }}
                      className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">
                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600 uppercase tracking-wider">Fantasy Pts</div>
                      <div className="text-lg font-bold text-gray-900">{player.fantasyPoints.toFixed(1)}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600 uppercase tracking-wider">VORP</div>
                      <div className={`text-lg font-bold ${getVorpColor(player.vorp)}`}>
                        {player.vorp.toFixed(1)}
                      </div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600 uppercase tracking-wider">ADP</div>
                      <div className="text-lg font-bold text-gray-900">#{player.adp}</div>
                    </div>
                    <div className="bg-white rounded-lg p-3 border border-gray-200">
                      <div className="text-xs text-gray-600 uppercase tracking-wider">Delta</div>
                      <div className={`text-lg font-bold ${getDeltaColor(player.delta)}`}>
                        {player.delta > 0 ? '+' : ''}{player.delta.toFixed(1)}
                      </div>
                    </div>
                  </div>

                  {/* News Indicator */}
                  {player.newsCount > 0 && (
                    <div className="flex items-center gap-2 text-sm text-orange-700 bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <FireIcon className="w-4 h-4" />
                      <span>{player.newsCount} recent news item{player.newsCount !== 1 ? 's' : ''}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onPlayerSelect(player)
                      }}
                      className="flex-1 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <EyeIcon className="w-4 h-4" />
                      View Details
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onRemoveFromWatchlist(player.id)
                      }}
                      className="bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-200 transition-colors flex items-center justify-center gap-2"
                    >
                      <TrashIcon className="w-4 h-4" />
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Summary Stats */}
      <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
          <ChartBarIcon className="w-4 h-4 text-primary-600" />
          Watchlist Summary
        </h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Total Players</div>
            <div className="font-bold text-gray-900">{watchlist.length}</div>
          </div>
          <div>
            <div className="text-gray-600">Avg VORP</div>
            <div className="font-bold text-gray-900">
              {(watchlist.reduce((sum, p) => sum + p.vorp, 0) / watchlist.length).toFixed(1)}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Top Position</div>
            <div className="font-bold text-gray-900">
              {Object.entries(
                watchlist.reduce((acc, p) => {
                  acc[p.position] = (acc[p.position] || 0) + 1
                  return acc
                }, {} as Record<string, number>)
              ).sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-gray-600">Avg Tier</div>
            <div className="font-bold text-gray-900">
              {(watchlist.reduce((sum, p) => sum + p.tier, 0) / watchlist.length).toFixed(1)}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
