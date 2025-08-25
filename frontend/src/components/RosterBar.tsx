import React, { useState, useMemo, useEffect } from 'react'
import {
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  UserIcon,
  ChartBarIcon,
  TrophyIcon,
  CalendarIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline'
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
          bg: 'bg-gray-50',
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
      <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary-100 rounded-xl">
              <TrophyIcon className="w-6 h-6 text-primary-600" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900">Roster Overview</h3>
              <p className="text-sm text-gray-600 mt-1 flex items-center gap-2">
                {scoringProfile && (
                  <>
                    <span className="px-2 py-1 bg-primary-100 text-primary-800 rounded-full text-xs font-medium">
                      {scoringProfile}
                    </span>
                    <span>•</span>
                  </>
                )}
                <span className="flex items-center gap-1">
                  <ChartBarIcon className="w-4 h-4 text-gray-400" />
                  Draft Progress
                </span>
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {rosterStats.totalFilled}/{rosterStats.totalRequired}
            </div>
            <div className="text-sm text-gray-600 font-medium">spots filled</div>
          </div>
        </div>
        
        {/* Enhanced Progress Bar */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-700 flex items-center gap-2">
              <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
              Completion Progress
            </span>
            <span className="font-bold text-primary-600 text-lg">{rosterStats.completionPercentage.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
            <div
              className="bg-gradient-to-r from-primary-500 to-primary-600 h-4 rounded-full transition-all duration-700 ease-out shadow-sm"
              style={{ width: `${rosterStats.completionPercentage}%` }}
            />
          </div>
        </div>

        {/* Enhanced Quick Stats */}
        <div className="grid grid-cols-3 gap-6 mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">{rosterStats.totalRemaining}</div>
            <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Remaining</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">{rosterStats.byeWeekConflicts.length}</div>
            <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Bye Conflicts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900 mb-1">{rosterSlots.length}</div>
            <div className="text-xs text-gray-600 font-medium uppercase tracking-wide">Positions</div>
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
              className={`${scarcityStyles.bg} ${scarcityStyles.border} rounded-xl border-2 transition-all duration-200 hover:shadow-lg cursor-pointer group`}
              onClick={() => onSlotClick(slot.position)}
            >
              {/* Slot Header */}
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-white/80 rounded-xl shadow-sm">
                      {getPositionIcon(slot.position)}
                    </div>
                    <div>
                      <h4 className="font-bold text-xl text-gray-900 mb-2">{slot.position}</h4>
                      <div className="flex items-center gap-3">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 ${scarcityStyles.badge}`}>
                          {slot.scarcity} priority
                        </span>
                        {slot.filled > 0 && slot.byeWeeks.length > 0 && (
                          <span className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-800 rounded-full text-xs font-medium border border-orange-200">
                            <ExclamationCircleIcon className="w-3 h-3" />
                            {slot.byeWeeks.length} bye conflict{slot.byeWeeks.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-3xl font-bold text-gray-900 mb-1">
                      {slot.filled}/{slot.required}
                    </div>
                    <div className="text-sm text-gray-600 font-medium">
                      {slot.filled === slot.required ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <CheckCircleIcon className="w-4 h-4" />
                          Complete
                        </span>
                      ) : (
                        `${slot.required - slot.filled} needed`
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Enhanced Expandable Content */}
              <div className="border-t border-gray-200/50">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    console.log(`Button clicked for slot: ${slot.position}`)
                    toggleSlotExpansion(slot.position)
                  }}
                  className="w-full px-5 py-3 flex items-center justify-between text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-white/50 transition-all duration-200 group-hover:bg-white/30"
                >
                  <span className="flex items-center gap-2">
                    <UserIcon className="w-4 h-4" />
                    View Details
                  </span>
                  {isExpanded ? (
                    <ChevronDownIcon className="w-5 h-5 text-gray-400 transition-transform duration-200" />
                  ) : (
                    <ChevronRightIcon className="w-5 h-5 text-gray-400 transition-transform duration-200" />
                  )}
                </button>
                
                {isExpanded && (
                  <div className="px-5 pb-5 space-y-3">
                    {slotPlayers.length > 0 ? (
                      slotPlayers.map((player) => (
                        <div key={player.id} className="flex items-center justify-between p-4 bg-white/80 rounded-xl border border-gray-200/50 shadow-sm hover:shadow-md transition-all duration-200">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-primary-100 rounded-xl flex items-center justify-center shadow-sm">
                              <span className="text-sm font-bold text-primary-700">{player.position}</span>
                            </div>
                            <div>
                              <div className="font-semibold text-gray-900 text-base">{player.name}</div>
                              <div className="text-sm text-gray-600 flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                  {player.team}
                                </span>
                                <span className="flex items-center gap-1">
                                  <CalendarIcon className="w-3 h-3 text-gray-400" />
                                  Week {player.byeWeek}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900 text-lg">{player.fantasyPoints.toFixed(1)}</div>
                            <div className="text-xs text-gray-500 font-medium">points</div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-6 text-gray-500">
                        <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3 flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-gray-400" />
                        </div>
                        <div className="text-sm font-medium mb-1">No players drafted</div>
                        <div className="text-xs">Click to add players to this position</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Enhanced Bye Week Conflicts Warning */}
      {rosterStats.byeWeekConflicts.length > 0 && (
        <div className="bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-2 bg-orange-100 rounded-lg flex-shrink-0">
              <ExclamationTriangleIcon className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-orange-800 text-lg mb-2">Bye Week Conflicts Detected</h4>
              <p className="text-orange-700 mb-3">
                You have <span className="font-semibold">{rosterStats.byeWeekConflicts.length}</span> position{rosterStats.byeWeekConflicts.length > 1 ? 's' : ''} with bye week conflicts that could leave you short-handed during those weeks.
              </p>
              <div className="space-y-2">
                {rosterStats.byeWeekConflicts.map((conflict) => (
                  <div key={conflict.position} className="flex items-center gap-2 text-sm text-orange-700 bg-orange-100/50 px-3 py-2 rounded-lg border border-orange-200">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="font-semibold">{conflict.position}:</span>
                    <span>Week{conflict.conflicts.length > 1 ? 's' : ''} {conflict.conflicts.join(', ')}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 text-xs text-orange-600">
                💡 Consider drafting backup players with different bye weeks to avoid these conflicts.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
