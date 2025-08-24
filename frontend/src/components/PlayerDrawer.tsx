import React, { useState, useCallback } from 'react';
import { XMarkIcon, ChartBarIcon, NewspaperIcon, UserGroupIcon, PencilIcon } from '@heroicons/react/24/outline';

export interface PlayerNews {
  id: string;
  title: string;
  summary: string;
  source: string;
  publishedAt: string;
  url: string;
}

export interface WeeklyStats {
  week: number;
  fantasyPoints: number;
  rushingYards?: number;
  passingYards?: number;
  receivingYards?: number;
  touchdowns?: number;
  interceptions?: number;
  fumbles?: number;
}

export interface DepthChartPosition {
  rank: number;
  playerName: string;
  status: 'starter' | 'backup' | 'practice_squad' | 'injured';
}

export interface PlayerDrawerProps {
  player: {
    id: string;
    name: string;
    position: string;
    team: string;
    fantasyPoints?: number;
    yahooPoints?: number;
    delta?: number;
    vorp?: number;
    tier?: number;
    adp?: number;
    newsCount?: number;
    byeWeek?: number;
    effectiveADP?: number;
    valueVsADP?: {
      value: number;
      isValue: boolean;
      percentage: string;
    } | null;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  weeklyStats?: WeeklyStats[];
  news?: PlayerNews[];
  depthChart?: DepthChartPosition[];
  notes?: string;
  onNotesChange?: (notes: string) => void;
  className?: string;
}

export const PlayerDrawer: React.FC<PlayerDrawerProps> = ({
  player,
  isOpen,
  onClose,
  weeklyStats = [],
  news = [],
  depthChart = [],
  notes = '',
  onNotesChange,
  className = ''
}) => {
  const [isNotesEditing, setIsNotesEditing] = useState(false);
  const [editedNotes, setEditedNotes] = useState(notes);

  // Handle notes editing
  const handleNotesSave = useCallback(() => {
    if (onNotesChange) {
      onNotesChange(editedNotes);
    }
    setIsNotesEditing(false);
  }, [editedNotes, onNotesChange]);

  const handleNotesCancel = useCallback(() => {
    setEditedNotes(notes);
    setIsNotesEditing(false);
  }, [notes]);

  // Format weekly stats for sparkline
  const formatWeeklyData = useCallback((stats: WeeklyStats[]) => {
    return stats
      .sort((a, b) => a.week - b.week)
      .map((stat, index) => ({
        week: stat.week,
        points: stat.fantasyPoints,
        color: stat.fantasyPoints >= 20 ? '#10b981' : 
               stat.fantasyPoints >= 15 ? '#f59e0b' : 
               stat.fantasyPoints >= 10 ? '#3b82f6' : '#6b7280'
      }));
  }, []);

  // Get position-specific stats
  const getPositionStats = useCallback((stats: WeeklyStats[]) => {
    if (!stats.length) return null;
    
    const latest = stats[stats.length - 1];
    const position = player?.position;
    
    switch (position) {
      case 'QB':
        return {
          passing: latest.passingYards || 0,
          rushing: latest.rushingYards || 0,
          touchdowns: latest.touchdowns || 0,
          interceptions: latest.interceptions || 0
        };
      case 'RB':
        return {
          rushing: latest.rushingYards || 0,
          receiving: latest.receivingYards || 0,
          touchdowns: latest.touchdowns || 0,
          fumbles: latest.fumbles || 0
        };
      case 'WR':
      case 'TE':
        return {
          receiving: latest.receivingYards || 0,
          touchdowns: latest.touchdowns || 0,
          fumbles: latest.fumbles || 0
        };
      default:
        return null;
    }
  }, [player?.position]);

  if (!player) return null;

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      {/* Drawer */}
      <div className={`fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl transform transition-transform duration-300 ease-in-out z-50 ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      } ${className}`}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 font-semibold text-sm">
                {player.position}
              </span>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{player.name}</h2>
              <p className="text-sm text-gray-500">{player.team} • {player.position}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          
          {/* Key Stats */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-900 mb-3">Key Stats</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">My Points</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.fantasyPoints ? player.fantasyPoints.toFixed(1) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Yahoo Points</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.yahooPoints ? player.yahooPoints.toFixed(1) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">VORP</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.vorp ? player.vorp.toFixed(1) : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Tier</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.tier || '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">ADP</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.effectiveADP ? `#${player.effectiveADP}` : '-'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Bye Week</p>
                <p className="text-lg font-semibold text-gray-900">
                  {player.byeWeek ? `W${player.byeWeek}` : '-'}
                </p>
              </div>
            </div>
            
            {/* Value vs ADP */}
            {player.valueVsADP && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <p className="text-xs text-gray-500">Value vs ADP</p>
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium ${
                  player.valueVsADP.isValue 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {player.valueVsADP.value > 0 ? '+' : ''}{player.valueVsADP.value} ({player.valueVsADP.percentage}%)
                </span>
              </div>
            )}
          </div>

          {/* Weekly Sparkline */}
          {weeklyStats.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <ChartBarIcon className="h-5 w-5 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900">Weekly Performance</h3>
              </div>
              
              {/* Simple sparkline visualization */}
              <div className="flex items-end space-x-1 h-20">
                {formatWeeklyData(weeklyStats).map((stat, index) => (
                  <div
                    key={index}
                    className="flex-1 bg-gray-100 rounded-t"
                    style={{
                      height: `${Math.max(stat.points * 2, 4)}px`,
                      backgroundColor: stat.color
                    }}
                    title={`Week ${stat.week}: ${stat.points} pts`}
                  />
                ))}
              </div>
              
              {/* Week labels */}
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                {formatWeeklyData(weeklyStats).map((stat, index) => (
                  <span key={index} className="flex-1 text-center">
                    Week {stat.week}
                  </span>
                ))}
              </div>
              
              {/* Position-specific stats */}
              {getPositionStats(weeklyStats) && (
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Latest Week Stats</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {Object.entries(getPositionStats(weeklyStats)!).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-gray-600 capitalize">{key}:</span>
                        <span className="font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Recent News */}
          {news.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <NewspaperIcon className="h-5 w-5 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900">Recent News</h3>
                <span className="text-xs text-gray-500">({news.length} items)</span>
              </div>
              
              <div className="space-y-3">
                {news.slice(0, 7).map((item) => (
                  <div key={item.id} className="border-l-2 border-blue-200 pl-3">
                    <h4 className="text-sm font-medium text-gray-900 line-clamp-2">
                      {item.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {item.summary}
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">{item.source}</span>
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Read More →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Depth Chart */}
          {depthChart.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <UserGroupIcon className="h-5 w-5 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900">Depth Chart</h3>
              </div>
              
              <div className="space-y-2">
                {depthChart.map((position) => (
                  <div key={position.rank} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                        position.status === 'starter' ? 'bg-green-100 text-green-800' :
                        position.status === 'backup' ? 'bg-blue-100 text-blue-800' :
                        position.status === 'practice_squad' ? 'bg-gray-100 text-gray-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {position.rank}
                      </span>
                      <span className="text-sm text-gray-900">{position.playerName}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      position.status === 'starter' ? 'bg-green-100 text-green-800' :
                      position.status === 'backup' ? 'bg-blue-100 text-blue-800' :
                      position.status === 'practice_squad' ? 'bg-gray-100 text-gray-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {position.status.replace('_', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <PencilIcon className="h-5 w-5 text-gray-400" />
                <h3 className="text-sm font-medium text-gray-900">Notes</h3>
              </div>
                          {!isNotesEditing && onNotesChange && (
              <button
                onClick={() => setIsNotesEditing(true)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Edit
              </button>
            )}
            </div>
            
            {isNotesEditing ? (
              <div className="space-y-3">
                <textarea
                  value={editedNotes}
                  onChange={(e) => setEditedNotes(e.target.value)}
                  className="w-full h-24 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add your notes about this player..."
                />
                <div className="flex space-x-2">
                  <button
                    onClick={handleNotesSave}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleNotesCancel}
                    className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="min-h-[6rem]">
                {notes ? (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{notes}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">No notes yet. Click edit to add your thoughts about this player.</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
