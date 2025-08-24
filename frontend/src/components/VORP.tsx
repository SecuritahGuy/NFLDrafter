import React, { useState, useMemo } from 'react'
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

export interface VORPProps {
  players: Player[]
  onVorpChange: (playerId: string, vorp: number) => void
  replacementRanks?: Record<string, number>
  onReplacementRanksChange?: (ranks: Record<string, number>) => void
}

export const VORP: React.FC<VORPProps> = ({
  players,
  onVorpChange,
  replacementRanks = { QB: 12, RB: 24, WR: 36, TE: 12, K: 12, DEF: 12 },
  onReplacementRanksChange,
}) => {
  const [expanded, setExpanded] = useState(true)
  const [showReplacementRanks, setShowReplacementRanks] = useState(false)

  // Calculate VORP for each player
  const playersWithVORP = useMemo(() => {
    if (!players.length) return []

    // Group players by position
    const playersByPosition = players.reduce((acc, player) => {
      if (!acc[player.position]) {
        acc[player.position] = []
      }
      acc[player.position].push(player)
      return acc
    }, {} as Record<string, Player[]>)

    // Calculate VORP for each position
    const result: (Player & { calculatedVorp: number })[] = []

    Object.entries(playersByPosition).forEach(([position, positionPlayers]) => {
      // Sort by fantasy points descending
      const sortedPlayers = positionPlayers
        .filter(p => p.fantasyPoints !== undefined)
        .sort((a, b) => (b.fantasyPoints || 0) - (a.fantasyPoints || 0))

      if (sortedPlayers.length === 0) return

      const replacementRank = replacementRanks[position] || 12
      const replacementPlayer = sortedPlayers[replacementRank - 1] || sortedPlayers[sortedPlayers.length - 1]
      const replacementValue = replacementPlayer.fantasyPoints || 0

      // Calculate VORP for each player in this position
      sortedPlayers.forEach(player => {
        const vorp = (player.fantasyPoints || 0) - replacementValue
        result.push({
          ...player,
          calculatedVorp: vorp,
        })
      })
    })

    // Sort by VORP descending
    return result.sort((a, b) => b.calculatedVorp - a.calculatedVorp)
  }, [players, replacementRanks])

  // Handle replacement rank changes
  const handleReplacementRankChange = (position: string, rank: number) => {
    if (onReplacementRanksChange) {
      const newRanks = { ...replacementRanks, [position]: Math.max(1, rank) }
      onReplacementRanksChange(newRanks)
    }
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

  // Get position color
  const getPositionColor = (position: string) => {
    const colors: Record<string, string> = {
      QB: 'bg-blue-100 text-blue-800',
      RB: 'bg-green-100 text-green-800',
      WR: 'bg-purple-100 text-purple-800',
      TE: 'bg-orange-100 text-orange-800',
      K: 'bg-gray-100 text-gray-800',
      DEF: 'bg-red-100 text-red-800',
    }
    return colors[position] || 'bg-gray-100 text-gray-800'
  }

  if (!players.length) {
    return (
      <div className="text-center py-4 text-gray-500">
        <div className="text-lg font-medium">No players available</div>
        <div className="text-sm">Add players to see VORP calculations</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">VORP Analysis</h3>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowReplacementRanks(!showReplacementRanks)}
            className="btn btn-primary btn-sm"
          >
            {showReplacementRanks ? 'Hide' : 'Show'} Replacement Ranks
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
          >
            {expanded ? (
              <ChevronUpIcon className="h-5 w-5" />
            ) : (
              <ChevronDownIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Replacement Ranks Configuration */}
      {showReplacementRanks && (
        <div className="bg-gray-50 p-4 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Replacement Ranks by Position</h4>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Object.entries(replacementRanks).map(([position, rank]) => (
              <div key={position} className="flex items-center space-x-2">
                <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getPositionColor(position)}`}>
                  {position}
                </span>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={rank}
                  onChange={(e) => handleReplacementRankChange(position, parseInt(e.target.value) || 1)}
                  className="input w-16"
                />
                <span className="text-xs text-gray-500">rank</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-600">
            VORP = Player's Fantasy Points - Replacement Player's Fantasy Points
          </div>
        </div>
      )}

      {/* VORP Results */}
      {expanded && (
        <div className="space-y-2">
          {playersWithVORP.slice(0, 20).map((player, index) => (
            <div
              key={player.id}
              className="p-3 hover:bg-gray-50 transition-colors rounded-md border border-gray-100"
              data-testid={`vorp-player-${player.id}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>
                  <div>
                    <div className="font-medium text-gray-900">{player.name}</div>
                    <div className="flex items-center space-x-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getPositionColor(player.position)}`}>
                        {player.position}
                      </span>
                      <span className="text-sm text-gray-500">{player.team}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-sm text-gray-500">Fantasy Points</div>
                    <div className="font-medium text-gray-900">
                      {player.fantasyPoints?.toFixed(1) || 'N/A'}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-500">VORP</div>
                    <div className={`font-medium ${getVorpColor(player.calculatedVorp)}`}>
                      {player.calculatedVorp.toFixed(1)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          
          {playersWithVORP.length > 20 && (
            <div className="px-4 py-3 text-center text-sm text-gray-500">
              Showing top 20 players of {playersWithVORP.length} total
            </div>
          )}
        </div>
      )}

      {/* Summary Stats */}
      {expanded && (
        <div className="bg-gray-50 p-4 rounded-md">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Total Players</div>
              <div className="font-medium text-gray-900">{playersWithVORP.length}</div>
            </div>
            <div>
              <div className="text-gray-500">Positive VORP</div>
              <div className="font-medium text-green-600">
                {playersWithVORP.filter(p => p.calculatedVorp > 0).length}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Top VORP</div>
              <div className="font-medium text-gray-900">
                {playersWithVORP.length > 0 ? playersWithVORP[0].calculatedVorp.toFixed(1) : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Avg VORP</div>
              <div className="font-medium text-gray-900">
                {playersWithVORP.length > 0 
                  ? (playersWithVORP.reduce((sum, p) => sum + p.calculatedVorp, 0) / playersWithVORP.length).toFixed(1)
                  : 'N/A'
                }
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
