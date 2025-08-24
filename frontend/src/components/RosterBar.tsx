import React, { useState, useMemo } from 'react'
import { ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'

// Types
export interface RosterSlot {
  position: string
  required: number
  filled: number
  byeWeeks: number[]
  scarcity: 'high' | 'medium' | 'low'
}

export interface RosterBarProps {
  rosterSlots: RosterSlot[]
  selectedPlayers: Array<{
    id: string
    name: string
    position: string
    team: string
    byeWeek: number
  }>
  onSlotClick: (position: string) => void
  scoringProfile?: string
}

export const RosterBar: React.FC<RosterBarProps> = ({
  rosterSlots,
  selectedPlayers,
  onSlotClick,
  scoringProfile,
}) => {
  const [expandedSlot, setExpandedSlot] = useState<string | null>(null)

  // Calculate roster statistics
  const rosterStats = useMemo(() => {
    const totalRequired = rosterSlots.reduce((sum, slot) => sum + slot.required, 0)
    const totalFilled = rosterSlots.reduce((sum, slot) => sum + slot.filled, 0)
    const totalRemaining = totalRequired - totalFilled

    // Calculate bye-week conflicts
    const byeWeekConflicts = rosterSlots
      .filter(slot => slot.filled > 0)
      .map(slot => {
        const slotPlayers = selectedPlayers.filter(player => 
          slot.position === 'FLEX' ? ['RB', 'WR', 'TE'].includes(player.position) : player.position === slot.position
        )
        
        const byeWeeks = slotPlayers.map(player => player.byeWeek)
        const conflicts = byeWeeks.filter((bye, index) => byeWeeks.indexOf(bye) !== index)
        
        return {
          position: slot.position,
          conflicts: [...new Set(conflicts)]
        }
      })
      .filter(conflict => conflict.conflicts.length > 0)

    return {
      totalRequired,
      totalFilled,
      totalRemaining,
      byeWeekConflicts,
      completionPercentage: (totalFilled / totalRequired) * 100
    }
  }, [rosterSlots, selectedPlayers])

  // Get scarcity color
  const getScarcityColor = (scarcity: 'high' | 'medium' | 'low') => {
    switch (scarcity) {
      case 'high':
        return 'text-red-600 bg-red-50 border-red-200'
      case 'medium':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'low':
        return 'text-green-600 bg-green-50 border-green-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  // Get scarcity icon
  const getScarcityIcon = (scarcity: 'high' | 'medium' | 'low') => {
    switch (scarcity) {
      case 'high':
        return <ExclamationTriangleIcon className="h-4 w-4 text-red-600" />
      case 'medium':
        return <ExclamationTriangleIcon className="h-4 w-4 text-yellow-600" />
      case 'low':
        return <CheckCircleIcon className="h-4 w-4 text-green-600" />
      default:
        return null
    }
  }

  // Toggle slot expansion
  const toggleSlotExpansion = (position: string) => {
    setExpandedSlot(expandedSlot === position ? null : position)
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Roster</h2>
          <div className="text-sm text-gray-500">
            {rosterStats.totalFilled}/{rosterStats.totalRequired} filled
            {scoringProfile && ` • ${scoringProfile}`}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
            <span>Progress</span>
            <span>{rosterStats.completionPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${rosterStats.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Bye Week Conflicts */}
        {rosterStats.byeWeekConflicts.length > 0 && (
          <div className="mt-3 p-2 bg-orange-50 border border-orange-200 rounded-md">
            <div className="flex items-center text-sm text-orange-800">
              <ExclamationTriangleIcon className="h-4 w-4 mr-2" />
              <span className="font-medium">Bye Week Conflicts</span>
            </div>
            <div className="mt-1 text-xs text-orange-700">
              {rosterStats.byeWeekConflicts.map(conflict => (
                <div key={conflict.position}>
                  {conflict.position}: Week {conflict.conflicts.join(', ')}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Roster Slots */}
      <div className="flex-1 overflow-auto p-4">
        <div className="space-y-3">
          {rosterSlots.map((slot) => {
            const slotPlayers = selectedPlayers.filter(player => 
              slot.position === 'FLEX' ? ['RB', 'WR', 'TE'].includes(player.position) : player.position === slot.position
            )
            
            const isExpanded = expandedSlot === slot.position
            const isComplete = slot.filled >= slot.required
            const isOverfilled = slot.filled > slot.required

            return (
              <div key={slot.position} className="border border-gray-200 rounded-lg overflow-hidden">
                {/* Slot Header */}
                <button
                  onClick={() => toggleSlotExpansion(slot.position)}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                    isComplete ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className={`font-medium ${
                        isComplete ? 'text-green-800' : 'text-gray-900'
                      }`}>
                        {slot.position}
                      </span>
                      
                      {/* Scarcity Indicator */}
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getScarcityColor(slot.scarcity)}`}>
                        {getScarcityIcon(slot.scarcity)}
                        <span className="ml-1 capitalize">{slot.scarcity}</span>
                      </span>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <span className={`text-sm font-medium ${
                        isComplete ? 'text-green-600' : 'text-gray-600'
                      }`}>
                        {slot.filled}/{slot.required}
                      </span>
                      
                      {/* Status Icon */}
                      {isComplete && (
                        <CheckCircleIcon className="h-5 w-5 text-green-600" />
                      )}
                      
                      {/* Expand/Collapse Icon */}
                      <svg
                        className={`h-4 w-4 text-gray-400 transition-transform ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </button>

                {/* Slot Details */}
                {isExpanded && (
                  <div className="px-4 py-3 bg-white border-t border-gray-200">
                    {/* Players in this slot */}
                    {slotPlayers.length > 0 ? (
                      <div className="space-y-2">
                        <h4 className="text-sm font-medium text-gray-900">Selected Players</h4>
                        {slotPlayers.map((player) => (
                          <div key={player.id} className="flex items-center justify-between text-sm">
                            <div>
                              <span className="font-medium text-gray-900">{player.name}</span>
                              <span className="text-gray-500 ml-2">({player.team})</span>
                            </div>
                            <span className="text-gray-500">W{player.byeWeek}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">
                        No players selected for this position
                      </div>
                    )}

                    {/* Bye Week Analysis */}
                    {slotPlayers.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <h4 className="text-sm font-medium text-gray-900 mb-2">Bye Week Analysis</h4>
                        <div className="text-xs text-gray-600">
                          {slot.byeWeeks.length > 0 ? (
                            <div>
                              <span className="font-medium">Bye Weeks:</span> {slot.byeWeeks.map(bye => `W${bye}`).join(', ')}
                            </div>
                          ) : (
                            <div className="text-green-600">No bye week conflicts</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <button
                      onClick={() => onSlotClick(slot.position)}
                      className="mt-3 w-full px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      {isComplete ? 'View/Edit Players' : 'Add Players'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-600">Remaining</div>
            <div className="font-medium text-gray-900">{rosterStats.totalRemaining}</div>
          </div>
          <div>
            <div className="text-gray-600">Completion</div>
            <div className="font-medium text-gray-900">{rosterStats.completionPercentage.toFixed(0)}%</div>
          </div>
        </div>
      </div>
    </div>
  )
}
