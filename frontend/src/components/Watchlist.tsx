import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { XMarkIcon, StarIcon } from '@heroicons/react/24/outline'
import type { Player } from './PlayerBoard'

export interface WatchlistProps {
  watchlist: Player[]
  onRemoveFromWatchlist: (playerId: string) => void
  onPlayerSelect: (player: Player) => void
  scoringProfile?: string
}

export const Watchlist: React.FC<WatchlistProps> = ({
  watchlist,
  onRemoveFromWatchlist,
  onPlayerSelect,
  scoringProfile,
}) => {
  const [sortField, setSortField] = useState<'name' | 'position' | 'fantasyPoints' | 'tier'>('fantasyPoints')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  // Sort watchlist
  const sortedWatchlist = useMemo(() => {
    return [...watchlist].sort((a, b) => {
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
  }, [watchlist, sortField, sortDirection])

  // Handle sorting
  const handleSort = useCallback((field: 'name' | 'position' | 'fantasyPoints' | 'tier') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }, [sortField, sortDirection])

  // Format fantasy points
  const formatPoints = (points?: number) => {
    if (points === undefined) return '-'
    return points.toFixed(1)
  }

  // Get tier color
  const getTierColor = (tier?: number) => {
    if (!tier) return 'text-gray-500'
    if (tier <= 2) return 'text-red-600 font-bold'
    if (tier <= 4) return 'text-orange-600 font-semibold'
    if (tier <= 6) return 'text-yellow-600 font-medium'
    return 'text-gray-600'
  }

  // Sort header component
  const SortHeader: React.FC<{ field: 'name' | 'position' | 'fantasyPoints' | 'tier'; children: React.ReactNode }> = ({ field, children }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center space-x-1 px-2 py-1 text-left text-xs font-medium text-gray-700 uppercase tracking-wider hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <span>{children}</span>
      {sortField === field && (
        <span className="text-blue-600">
          {sortDirection === 'asc' ? '↑' : '↓'}
        </span>
      )}
    </button>
  )

  if (watchlist.length === 0) {
    return (
      <div className="flex-1 flex flex-col bg-white">
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Watchlist</h2>
            <div className="text-sm text-gray-500">0 players</div>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <StarIcon className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No players in watchlist</h3>
            <p className="mt-1 text-sm text-gray-500">
              Add players to your watchlist using the 'A' key or Add button
            </p>
            <div className="mt-4 text-xs text-gray-400 space-y-1">
              <div><strong>Keyboard Shortcuts:</strong></div>
              <div>A - Add player to watchlist</div>
              <div>R - Remove player from watchlist</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Watchlist</h2>
          <div className="text-sm text-gray-500">
            {watchlist.length} player{watchlist.length !== 1 ? 's' : ''}
            {scoringProfile && ` • ${scoringProfile}`}
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-500">
          <span className="font-medium">Keyboard Shortcuts:</span> A - Add, R - Remove
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0">
            <tr>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader field="name">Player</SortHeader>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader field="position">Pos</SortHeader>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Team
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader field="fantasyPoints">MyPts</SortHeader>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <SortHeader field="tier">Tier</SortHeader>
              </th>
              <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedWatchlist.map((player) => (
              <tr 
                key={player.id}
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => onPlayerSelect(player)}
              >
                {/* Player Name */}
                <td className="px-3 py-3 whitespace-nowrap">
                  <div className="flex items-center">
                    <StarIcon className="h-4 w-4 text-yellow-500 mr-2" />
                    <div>
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

                {/* Fantasy Points */}
                <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                  {formatPoints(player.fantasyPoints)}
                </td>

                {/* Tier */}
                <td className={`px-3 py-3 whitespace-nowrap text-sm font-medium ${getTierColor(player.tier)}`}>
                  {player.tier || '-'}
                </td>

                {/* Actions */}
                <td className="px-3 py-3 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onRemoveFromWatchlist(player.id)
                    }}
                    className="text-red-600 hover:text-red-900 p-1 rounded hover:bg-red-50"
                    title="Remove from watchlist (R)"
                  >
                    <XMarkIcon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
