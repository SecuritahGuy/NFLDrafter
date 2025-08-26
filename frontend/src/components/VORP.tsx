import React, { useState, useMemo } from 'react'
import { 
  ChartBarIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ArrowTrendingUpIcon,
  AdjustmentsHorizontalIcon,
  UserIcon
} from '@heroicons/react/24/outline'
import type { Player } from '../types'

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

  // Get VORP badge color
  const getVorpBadgeColor = (vorp: number) => {
    if (vorp >= 50) return 'bg-green-100 text-green-800 border-green-200'
    if (vorp >= 25) return 'bg-green-50 text-green-700 border-green-200'
    if (vorp >= 10) return 'bg-blue-100 text-blue-800 border-blue-200'
    if (vorp <= -25) return 'bg-red-100 text-red-800 border-red-200'
    if (vorp <= -10) return 'bg-red-50 text-red-700 border-red-200'
    return 'bg-gray-100 text-gray-800 border-gray-200'
  }

  if (!players.length) {
    return (
      <div className="text-center py-8 text-gray-500">
                    <ChartBarIcon 
              className="w-8 h-8 mx-auto mb-2 text-gray-400" 
              style={{ width: '2rem', height: '2rem', flexShrink: 0 }}
            />
        <div className="text-lg font-medium">No players available</div>
        <div className="text-sm">Add players to see VORP calculations</div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <ArrowTrendingUpIcon 
                className="w-5 h-5 text-primary-600" 
                style={{ width: '1.25rem', height: '1.25rem', flexShrink: 0 }}
              />
            VORP Analysis
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Value Over Replacement Player • {playersWithVORP.length} players analyzed
          </p>
        </div>
        
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
                              {expanded ? (
                      <ChevronUpIcon 
                        className="w-4 h-4" 
                        style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
                      />
                    ) : (
                      <ChevronDownIcon 
                        className="w-4 h-4" 
                        style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
                      />
                    )}
        </button>
      </div>

      {expanded && (
        <>
          {/* Replacement Ranks Configuration */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                <AdjustmentsHorizontalIcon 
              className="w-4 h-4 text-primary-600" 
              style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
            />
                Replacement Ranks
              </h4>
              <button
                onClick={() => setShowReplacementRanks(!showReplacementRanks)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {showReplacementRanks ? 'Hide' : 'Show'} Configuration
              </button>
            </div>
            
            {showReplacementRanks && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(replacementRanks).map(([position, rank]) => (
                  <div key={position} className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPositionColor(position)}`}>
                      {position}
                    </span>
                    <input
                      type="number"
                      min="1"
                      value={rank}
                      onChange={(e) => handleReplacementRankChange(position, parseInt(e.target.value))}
                      aria-label={`Set replacement rank for ${position}`}
                      title={`Set replacement rank for ${position}`}
                      placeholder="Rank"
                      className="w-16 text-xs border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    />
                  </div>
                ))}
              </div>
            )}
            
            <div className="mt-3 text-xs text-gray-600">
              VORP = Player Points - Replacement Player Points
            </div>
          </div>

          {/* Top VORP Players */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
                                              <ArrowTrendingUpIcon 
                                  className="w-4 h-4 text-green-600" 
                                  style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
                                />
              Top VORP Players
            </h4>
            
            {/* Professional Table Format */}
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Player</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pos</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Team</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pts</th>
                    <th className="px-2 py-1.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">VORP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {playersWithVORP.slice(0, 8).map((player, index) => (
                    <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-2 py-1.5 text-sm font-medium text-gray-900">
                        <div className="flex items-center justify-center w-5 h-5 bg-gray-100 rounded-full text-xs font-bold">
                          {index + 1}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium text-gray-900 text-xs">{player.name}</div>
                      </td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium border ${getPositionColor(player.position)}`}>
                          {player.position}
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-xs text-gray-600">{player.team}</td>
                      <td className="px-2 py-1.5 text-xs text-gray-600">{player.fantasyPoints.toFixed(1)}</td>
                      <td className="px-2 py-1.5">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold border ${getVorpBadgeColor(player.calculatedVorp)}`}>
                          {player.calculatedVorp > 0 ? '+' : ''}{player.calculatedVorp.toFixed(1)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* VORP Summary Stats */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <ChartBarIcon 
              className="w-4 h-4 text-primary-600" 
              style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
            />
              VORP Summary
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Highest VORP</div>
                <div className="font-bold text-green-600">
                  +{Math.max(...playersWithVORP.map(p => p.calculatedVorp)).toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Lowest VORP</div>
                <div className="font-bold text-red-600">
                  {Math.min(...playersWithVORP.map(p => p.calculatedVorp)).toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Avg VORP</div>
                <div className="font-bold text-gray-900">
                  {(playersWithVORP.reduce((sum, p) => sum + p.calculatedVorp, 0) / playersWithVORP.length).toFixed(1)}
                </div>
              </div>
              <div>
                <div className="text-gray-600">Positive VORP</div>
                <div className="font-bold text-green-600">
                  {playersWithVORP.filter(p => p.calculatedVorp > 0).length}
                </div>
              </div>
            </div>
          </div>

          {/* Position Breakdown */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
              <UserIcon 
              className="w-4 h-4 text-primary-600" 
              style={{ width: '1rem', height: '1rem', flexShrink: 0 }}
            />
              Position Breakdown
            </h4>
            <div className="space-y-3">
              {Object.entries(
                playersWithVORP.reduce((acc, player) => {
                  if (!acc[player.position]) {
                    acc[player.position] = { count: 0, totalVorp: 0, avgVorp: 0 }
                  }
                  acc[player.position].count++
                  acc[player.position].totalVorp += player.calculatedVorp
                  acc[player.position].avgVorp = acc[player.position].totalVorp / acc[player.position].count
                  return acc
                }, {} as Record<string, { count: number; totalVorp: number; avgVorp: number }>)
              ).map(([position, stats]) => (
                <div key={position} className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getPositionColor(position)}`}>
                      {position}
                    </span>
                    <span className="text-sm text-gray-600">{stats.count} players</span>
                  </div>
                  <div className="text-sm font-medium text-gray-900">
                    {stats.avgVorp > 0 ? '+' : ''}{stats.avgVorp.toFixed(1)} avg VORP
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
