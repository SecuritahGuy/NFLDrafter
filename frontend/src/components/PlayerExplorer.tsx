import { useState } from 'react'
import { useScoringProfiles } from '../hooks/usePoints'

export function PlayerExplorer() {
  const { data: profilesData, isLoading: profilesLoading } = useScoringProfiles()
  const [selectedSeason, setSelectedSeason] = useState(2023)
  const [selectedWeek, setSelectedWeek] = useState(1)
  const [selectedProfile, setSelectedProfile] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')

  // Mock data for demonstration - in real app this would come from API
  const mockPlayers = [
    { id: '1', name: 'Patrick Mahomes', position: 'QB', team: 'KC' },
    { id: '2', name: 'Christian McCaffrey', position: 'RB', team: 'SF' },
    { id: '3', name: 'Tyreek Hill', position: 'WR', team: 'MIA' },
    { id: '4', name: 'Travis Kelce', position: 'TE', team: 'KC' },
    { id: '5', name: 'Justin Jefferson', position: 'WR', team: 'MIN' },
  ]

  const seasons = [2020, 2021, 2022, 2023, 2024]
  const weeks = Array.from({ length: 18 }, (_, i) => i + 1)

  if (profilesLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading scoring profiles...</div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Player Explorer</h2>
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Season</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nfl-blue"
            >
              {seasons.map((season) => (
                <option key={season} value={season}>{season}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Week</label>
            <select
              value={selectedWeek}
              onChange={(e) => setSelectedWeek(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nfl-blue"
            >
              {weeks.map((week) => (
                <option key={week} value={week}>Week {week}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Scoring Profile</label>
            <select
              value={selectedProfile}
              onChange={(e) => setSelectedProfile(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nfl-blue"
            >
              <option value="">Select Profile</option>
              {profilesData?.profiles.map((profile) => (
                <option key={profile.profile_id} value={profile.profile_id}>
                  {profile.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Search Players</label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Player name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-nfl-blue"
            />
          </div>
        </div>

        {/* Player Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Player
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Position
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Team
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Fantasy Points
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {mockPlayers
                .filter(player => 
                  player.name.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((player) => (
                  <tr key={player.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {player.name}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                        {player.position}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {player.team}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {selectedProfile ? '--' : 'Select Profile'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button className="text-nfl-blue hover:text-blue-700 mr-3">
                        View Stats
                      </button>
                      <button className="text-nfl-red hover:text-red-700">
                        Compare
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {mockPlayers.filter(player => 
          player.name.toLowerCase().includes(searchQuery.toLowerCase())
        ).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No players found matching your search criteria.
          </div>
        )}
      </div>

      {/* Quick Stats Preview */}
      {selectedProfile && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats Preview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Top Performers</h4>
              <p className="text-sm text-gray-600">Select a player to view detailed stats</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Position Breakdown</h4>
              <p className="text-sm text-gray-600">QB, RB, WR, TE rankings</p>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Profile Comparison</h4>
              <p className="text-sm text-gray-600">Compare multiple scoring systems</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
