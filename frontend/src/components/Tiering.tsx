import React, { useState, useMemo, useCallback } from 'react'
import { 
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  StarIcon,
  AdjustmentsHorizontalIcon,
  FireIcon
} from '@heroicons/react/24/outline'
import type { Player } from '../types'

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
    if (!players.length) return []

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
      'bg-gradient-to-r from-red-100 to-red-50 border-red-200 text-red-800',
      'bg-gradient-to-r from-orange-100 to-orange-50 border-orange-200 text-orange-800',
      'bg-gradient-to-r from-yellow-100 to-yellow-50 border-yellow-200 text-yellow-800',
      'bg-gradient-to-r from-green-100 to-green-50 border-green-200 text-green-800',
      'bg-gradient-to-r from-blue-100 to-blue-50 border-blue-200 text-blue-800',
      'bg-gradient-to-r from-purple-100 to-purple-50 border-purple-200 text-purple-800',
      'bg-gradient-to-r from-indigo-100 to-indigo-50 border-indigo-200 text-indigo-800',
    ]
    return colors[Math.min(tier - 1, colors.length - 1)]
  }

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

  if (!players.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <ChartBarIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
        <div className="text-lg font-medium">No players available</div>
        <div className="text-sm">Add players to see tiering analysis</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ChartBarIcon className="w-5 h-5 text-primary-600" />
            Tiering Analysis
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {Object.keys(playersByTier).length} tiers • {players.length} players
          </p>
        </div>
        
        {showControls && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Gap:</label>
              <input
                type="range"
                min="1"
                max="50"
                value={gap}
                onChange={(e) => handleGapChange(parseInt(e.target.value))}
                className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
              />
              <span className="text-sm font-medium text-gray-900 w-8">{gap}</span>
            </div>
          </div>
        )}
      </div>

      {/* Tier Controls */}
      {showControls && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <AdjustmentsHorizontalIcon className="w-4 h-4" />
            <span className="font-medium">Tier Gap Control</span>
          </div>
          <div className="mt-2 text-xs text-blue-700">
            Lower gap = more tiers, Higher gap = fewer tiers
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-blue-600">
            <span>Current: {gap} points</span>
            <span>•</span>
            <span>Result: {Object.keys(playersByTier).length} tiers</span>
          </div>
        </div>
      )}

      {/* Tiers */}
      <div className="space-y-4">
        {Object.entries(playersByTier)
          .sort(([a], [b]) => parseInt(a) - parseInt(b))
          .map(([tierNum, tierPlayers]) => {
            const tier = parseInt(tierNum)
            const isExpanded = expandedTiers.has(tier)
            const tierValue = tierPlayers[0]?.fantasyPoints || 0
            const tierSize = tierPlayers.length
            
            return (
              <div key={tier} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
                {/* Tier Header */}
                <div className={`p-4 ${getTierColor(tier)} border-b border-gray-200`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/80 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                          <StarIcon className="w-5 h-5 text-gray-700" />
                        </div>
                        <div>
                          <h4 className="text-xl font-bold text-gray-900">Tier {tier}</h4>
                          <div className="text-sm text-gray-700 font-medium">
                            {tierSize} player{tierSize !== 1 ? 's' : ''} • {tierValue.toFixed(1)} pts
                          </div>
                        </div>
                      </div>
                      
                      {/* Tier Stats */}
                      <div className="hidden md:flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-bold text-gray-900">{tierSize}</div>
                          <div className="text-gray-600">Players</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-gray-900">{tierValue.toFixed(1)}</div>
                          <div className="text-gray-600">Avg Pts</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-gray-900">
                            {tierPlayers.reduce((sum, p) => sum + p.vorp, 0).toFixed(1)}
                          </div>
                          <div className="text-gray-600">Total VORP</div>
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => toggleTier(tier)}
                      className="p-2 text-gray-600 hover:text-gray-900 hover:bg-white/50 rounded-lg transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUpIcon className="w-5 h-5" />
                      ) : (
                        <ChevronDownIcon className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Tier Players */}
                {isExpanded && (
                  <div className="p-4 bg-gray-50 space-y-3">
                    {tierPlayers.map((player) => (
                      <div key={player.id} className="bg-white rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border ${getPositionColor(player.position)}`}>
                              {player.position}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{player.name}</div>
                              <div className="text-sm text-gray-600">{player.team} • {player.fantasyPoints.toFixed(1)} pts</div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            {player.newsCount > 0 && (
                              <div className="flex items-center gap-1 text-orange-600">
                                <FireIcon className="w-3 h-3" />
                                <span className="text-xs">{player.newsCount}</span>
                              </div>
                            )}
                            
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">{player.fantasyPoints.toFixed(1)}</div>
                              <div className="text-xs text-gray-500">fantasy pts</div>
                            </div>
                            
                            {onTierChange && (
                              <select
                                value={player.tier}
                                onChange={(e) => handleTierChange(player.id, parseInt(e.target.value))}
                                className="text-xs border border-gray-300 rounded px-2 py-1 bg-white focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {Array.from({ length: 10 }, (_, i) => i + 1).map((t) => (
                                  <option key={t} value={t}>T{t}</option>
                                ))}
                              </select>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
      </div>

      {/* Summary Stats */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-6 border border-gray-200">
        <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-primary-600" />
          Tiering Summary
        </h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{Object.keys(playersByTier).length}</div>
            <div className="text-sm text-gray-600">Total Tiers</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {(players.length / Object.keys(playersByTier).length).toFixed(1)}
            </div>
            <div className="text-sm text-gray-600">Avg Tier Size</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.max(...Object.values(playersByTier).map(tier => tier.length))}
            </div>
            <div className="text-sm text-gray-600">Largest Tier</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {Math.min(...Object.values(playersByTier).map(tier => tier.length))}
            </div>
            <div className="text-sm text-gray-600">Smallest Tier</div>
          </div>
        </div>
        
        {/* Tier Distribution Chart */}
        <div className="mt-6">
          <h5 className="text-sm font-medium text-gray-700 mb-3">Tier Distribution</h5>
          <div className="flex items-end gap-2 h-20">
            {Object.entries(playersByTier)
              .sort(([a], [b]) => parseInt(a) - parseInt(b))
              .map(([tierNum, tierPlayers]) => {
                const tier = parseInt(tierNum)
                const height = (tierPlayers.length / Math.max(...Object.values(playersByTier).map(tier => tier.length))) * 100
                return (
                  <div key={tier} className="flex-1 flex flex-col items-center">
                    <div 
                      className={`w-full rounded-t-sm transition-all duration-300 ${getTierColor(tier).split(' ')[0]}`}
                      style={{ height: `${height}%` }}
                    ></div>
                    <div className="text-xs text-gray-600 mt-1">T{tier}</div>
                    <div className="text-xs font-medium text-gray-900">{tierPlayers.length}</div>
                  </div>
                )
              })}
          </div>
        </div>
      </div>
    </div>
  )
}
