import React, { useState, useMemo, useEffect } from 'react'
// Temporarily comment out Heroicons to get tests running
// import {
//   ExclamationTriangleIcon,
//   CheckCircleIcon,
//   ChevronDownIcon,
//   ChevronRightIcon,
//   UserIcon,
//   ChartBarIcon
// } from '@heroicons/react/24/outline'
import type { Player } from '../types'

export interface RosterSlot {
  position: string
  required: number
  filled: number
  byeWeeks: number[]
  scarcity: 'high' | 'medium' | 'low'
}

export interface RosterBarProps {
  rosterSlots: RosterSlot[]
  selectedPlayers: Player[]
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

  // Debug: Monitor expandedSlot state changes
  useEffect(() => {
    console.log('expandedSlot state changed to:', expandedSlot)
  }, [expandedSlot])

  // Calculate roster statistics
  const rosterStats = useMemo(() => {
    if (!rosterSlots || rosterSlots.length === 0) {
      return {
        totalRequired: 0,
        totalFilled: 0,
        totalRemaining: 0,
        byeWeekConflicts: [],
        completionPercentage: 0
      }
    }
    
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

  // Get scarcity styling
  const getScarcityStyles = (scarcity: 'high' | 'medium' | 'low') => {
    switch (scarcity) {
      case 'high':
        return {
          bg: 'bg-gradient-to-r from-red-50 to-orange-50',
          border: 'border-red-200',
          text: 'text-red-700',
          icon: 'text-red-500',
          badge: 'bg-red-100 text-red-800 border-red-200'
        }
      case 'medium':
        return {
          bg: 'bg-gradient-to-r from-yellow-50 to-amber-50',
          border: 'border-yellow-200',
          text: 'text-yellow-700',
          icon: 'text-yellow-500',
          badge: 'bg-yellow-100 text-yellow-800 border-yellow-200'
        }
      case 'low':
        return {
          bg: 'bg-gradient-to-r from-green-50 to-emerald-50',
          border: 'border-green-200',
          text: 'text-green-700',
          icon: 'text-green-500',
          badge: 'bg-green-100 text-green-800 border-green-200'
        }
      default:
        return {
          bg: 'bg-gradient-to-r from-gray-50 to-slate-50',
          border: 'border-gray-200',
          text: 'text-gray-700',
          icon: 'text-gray-500',
          badge: 'bg-gray-100 text-gray-800 border-gray-200'
        }
    }
  }

  // Get position icon
  const getPositionIcon = (position: string) => {
    const icons: Record<string, React.ReactNode> = {
      'QB': <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-bold">QB</div>,
      'RB': <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-white text-xs font-bold">RB</div>,
      'WR': <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-white text-xs font-bold">WR</div>,
      'TE': <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold">TE</div>,
      'K': <div className="w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center text-white text-xs font-bold">K</div>,
      'DST': <div className="w-6 h-6 bg-red-500 rounded-full flex items-center justify-center text-white text-xs font-bold">D</div>,
      'FLEX': <div className="w-6 h-6 bg-gray-500 rounded-full flex items-center justify-center text-white text-xs font-bold">F</div>
    }
    return icons[position] || <div className="w-6 h-6 bg-gray-400 rounded-full flex items-center justify-center text-white text-xs font-bold">?</div>
  }

  // Toggle slot expansion
  const toggleSlotExpansion = (position: string) => {
    console.log('toggleSlotExpansion called with:', position, 'current expandedSlot:', expandedSlot)
    const newExpandedSlot = expandedSlot === position ? null : position
    console.log('setting expandedSlot to:', newExpandedSlot)
    setExpandedSlot(newExpandedSlot)
    console.log('setExpandedSlot called with:', newExpandedSlot)
  }

  // Early return if no roster slots
  if (!rosterSlots || rosterSlots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-lg font-medium">No roster slots configured</div>
        <div className="text-sm">Please configure roster requirements</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <div className="w-6 h-6 bg-primary-600 rounded flex items-center justify-center text-white text-xs font-bold">📊</div>
              Roster Overview
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {scoringProfile && `${scoringProfile} • `}Draft Progress
            </p>
          </div>
          
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">
              {rosterStats.totalFilled}/{rosterStats.totalRequired}
            </div>
            <div className="text-sm text-gray-600">spots filled</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">Completion</span>
            <span className="font-bold text-primary-600">{rosterStats.completionPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${rosterStats.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{rosterStats.totalRemaining}</div>
            <div className="text-xs text-gray-600">Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-gray-900">{rosterStats.byeWeekConflicts.length}</div>
            <div className="text-xs text-gray-600">Bye Conflicts</div>
          </div>
        </div>
      </div>

      {/* Roster Slots */}
      <div className="space-y-4">
        {rosterSlots.map((slot) => {
          const scarcityStyles = getScarcityStyles(slot.scarcity)
          const isExpanded = expandedSlot === slot.position
          const slotPlayers = selectedPlayers.filter(player => 
            slot.position === 'FLEX' ? ['RB', 'WR', 'TE'].includes(player.position) : player.position === slot.position
          )
          
          console.log(`Slot ${slot.position}: isExpanded=${isExpanded}, expandedSlot=${expandedSlot}, slotPlayers.length=${slotPlayers.length}`)
          console.log(`Slot ${slot.position}: will render expanded content:`, isExpanded)
          
          return (
            <div
              key={slot.position}
              className={`${scarcityStyles.bg} ${scarcityStyles.border} rounded-xl border-2 transition-all duration-200 hover:shadow-md cursor-pointer`}
              onClick={() => onSlotClick(slot.position)}
            >
              {/* Slot Header */}
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getPositionIcon(slot.position)}
                    <div>
                      <h4 className="font-bold text-lg text-gray-900">{slot.position}</h4>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${scarcityStyles.badge}`}>
                          {slot.scarcity} priority
                        </span>
                        {slot.filled > 0 && (
                          <span className="text-xs text-gray-600">
                            {slot.byeWeeks.length > 0 && (
                              <span className="text-orange-600 font-medium">
                                ⚠️ {slot.byeWeeks.length} bye conflict{slot.byeWeeks.length > 1 ? 's' : ''}
                              </span>
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-gray-900">
                      {slot.filled}/{slot.required}
                    </div>
                    <div className="text-sm text-gray-600">
                      {slot.filled === slot.required ? 'Complete' : `${slot.required - slot.filled} needed`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expandable Content */}
              <div className="border-t border-gray-200">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log(`Button clicked for slot: ${slot.position}`)
                    toggleSlotExpansion(slot.position)
                  }}
                  className="w-full px-4 py-3 flex items-center justify-between text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-colors"
                >
                  <span>View Details</span>
                  {isExpanded ? (
                    <div className="w-4 h-4 text-gray-400">▼</div>
                  ) : (
                    <div className="w-4 h-4 text-gray-400">▶</div>
                  )}
                </button>
                
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <div className="text-xs text-gray-500 mb-2">DEBUG: Slot {slot.position} is expanded</div>
                    {slotPlayers.length > 0 ? (
                      slotPlayers.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-3 bg-white/70 rounded-lg border border-gray-200">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                              <span className="text-xs font-bold text-primary-700">{player.position}</span>
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{player.name}</div>
                              <div className="text-sm text-gray-600">{player.team} • Week {player.byeWeek}</div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900">{player.fantasyPoints.toFixed(1)}</div>
                            <div className="text-xs text-gray-500">pts</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4 text-gray-500">
                        <div className="w-8 h-8 bg-gray-400 rounded-full mx-auto mb-2 flex items-center justify-center text-white text-xs">👤</div>
                        <div className="text-sm">No players drafted</div>
                        <div className="text-xs">Click to add players</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bye Week Conflicts Warning */}
      {rosterStats.byeWeekConflicts.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-orange-600 mt-0.5 flex-shrink-0">⚠️</div>
            <div>
              <h4 className="font-medium text-orange-800">Bye Week Conflicts</h4>
              <p className="text-sm text-orange-700 mt-1">
                You have {rosterStats.byeWeekConflicts.length} position{rosterStats.byeWeekConflicts.length > 1 ? 's' : ''} with bye week conflicts.
              </p>
              <div className="mt-2 space-y-1">
                {rosterStats.byeWeekConflicts.map((conflict) => (
                  <div key={conflict.position} className="text-xs text-orange-600">
                    {conflict.position}: Week{conflict.conflicts.length > 1 ? 's' : ''} {conflict.conflicts.join(', ')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
