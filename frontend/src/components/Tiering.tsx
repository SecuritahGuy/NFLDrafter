import React, { useState, useMemo, useCallback } from 'react'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

export interface Player {
  id: string
  name: string
  position: string
  team: string
  fantasyPoints: number
  tier?: number
}

export interface TieringProps {
  players: Player[]
  onTierChange?: (playerId: string, tier: number) => void
  defaultGap?: number
  showControls?: boolean
}

export const Tiering: React.FC<TieringProps> = ({
  players,
  onTierChange,
  defaultGap = 10,
  showControls = true,
}) => {
  const [gap, setGap] = useState(defaultGap)
  const [expandedTiers, setExpandedTiers] = useState<Set<number>>(new Set())

  const tieredPlayers = useMemo(() => {
    if (players.length === 0) return []

    const sortedPlayers = [...players].sort((a, b) => b.fantasyPoints - a.fantasyPoints)
    const tiers: { [tier: number]: Player[] } = {}
    let currentTier = 1
    let lastPoints = sortedPlayers[0].fantasyPoints

    sortedPlayers.forEach((player, index) => {
      if (index === 0) {
        tiers[currentTier] = [player]
      } else {
        const pointDifference = lastPoints - player.fantasyPoints
        if (pointDifference > gap) {
          currentTier++
          lastPoints = player.fantasyPoints
        }
        if (!tiers[currentTier]) {
          tiers[currentTier] = []
        }
        tiers[currentTier].push(player)
      }
    })

    const result: (Player & { tier: number })[] = []
    Object.entries(tiers).forEach(([tierNum, tierPlayers]) => {
      const tier = parseInt(tierNum)
      tierPlayers.forEach(player => {
        result.push({ ...player, tier })
      })
    })

    return result
  }, [players, gap])

  const playersByTier = useMemo(() => {
    const grouped: { [tier: number]: Player[] } = {}
    tieredPlayers.forEach(player => {
      if (!grouped[player.tier!]) {
        grouped[player.tier!] = []
      }
      grouped[player.tier!].push(player)
    })
    return grouped
  }, [tieredPlayers])

  const getTierColor = (tier: number) => {
    const colors = [
      'bg-red-100 border-red-300 text-red-800',
      'bg-orange-100 border-orange-300 text-orange-800',
      'bg-yellow-100 border-yellow-300 text-yellow-800',
      'bg-green-100 border-green-300 text-green-800',
      'bg-blue-100 border-blue-300 text-blue-800',
      'bg-purple-100 border-purple-300 text-purple-800',
    ]
    return colors[Math.min(tier - 1, colors.length - 1)]
  }

  const toggleTier = useCallback((tier: number) => {
    setExpandedTiers(prev => {
      const newSet = new Set(prev)
      if (newSet.has(tier)) {
        newSet.delete(tier)
      } else {
        newSet.add(tier)
      }
      return newSet
    })
  }, [])

  const handleGapChange = useCallback((newGap: number) => {
    setGap(Math.max(1, Math.min(50, newGap)))
  }, [])

  const handleTierChange = useCallback((playerId: string, newTier: number) => {
    if (onTierChange) {
      onTierChange(playerId, newTier)
    }
  }, [onTierChange])

  if (players.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No players available for tiering
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Player Tiers</h3>
          <p className="text-sm text-gray-600">
            {Object.keys(playersByTier).length} tiers • {players.length} players
          </p>
        </div>

        {showControls && (
          <div className="flex items-center space-x-3">
            <label htmlFor="gap-control" className="text-sm font-medium text-gray-700">
              Tier Gap:
            </label>
            <input
              id="gap-control"
              type="range"
              min="1"
              max="50"
              value={gap}
              onChange={(e) => handleGapChange(parseInt(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-sm font-medium text-gray-900 min-w-[3rem] text-right">
              {gap}
            </span>
          </div>
        )}
      </div>

      <div className="divide-y divide-gray-200">
        {Object.entries(playersByTier)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([tierNum, tierPlayers]) => {
            const tier = parseInt(tierNum)
            const isExpanded = expandedTiers.has(tier)
            const tierColor = getTierColor(tier)
            
            return (
              <div key={tier} className="bg-white">
                <button
                  onClick={() => toggleTier(tier)}
                  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${tierColor}`}>
                        Tier {tier}
                      </span>
                      <span className="text-sm text-gray-600">
                        {tierPlayers.length} player{tierPlayers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-500">
                        {tierPlayers[0].fantasyPoints.toFixed(1)} pts
                      </span>
                      {isExpanded ? (
                        <ChevronUpIcon className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-3 bg-gray-50">
                    <div className="space-y-2">
                      {tierPlayers.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-2 bg-white rounded border">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm font-medium text-gray-900">
                              {player.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {player.position} • {player.team}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-gray-900">
                              {player.fantasyPoints.toFixed(1)}
                            </span>
                            
                            {onTierChange && (
                              <div className="flex items-center space-x-1">
                                <button
                                  onClick={() => handleTierChange(player.id, tier - 1)}
                                  disabled={tier <= 1}
                                  className="btn btn-primary btn-sm px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  ↑
                                </button>
                                <button
                                  onClick={() => handleTierChange(player.id, tier + 1)}
                                  className="btn btn-primary btn-sm px-2 py-1"
                                >
                                  ↓
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
      </div>

      <div className="text-xs text-gray-600 bg-gray-50 p-3 rounded-md">
        <p>Tiers are automatically calculated based on {gap}-point gaps between players.</p>
        <p>Lower tier numbers indicate higher value players.</p>
      </div>
    </div>
  )
}
