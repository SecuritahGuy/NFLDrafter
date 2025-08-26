import { useState } from 'react'
import { useScoringProfiles } from '../hooks/useScoringProfiles'

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
    <div className="container">
      <div className="card">
        <div className="card-header">
          <h2 className="text-2xl font-bold text-gray-900">Player Explorer</h2>
        </div>
        <div className="card-body">
        
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Season</label>
            <select
              value={selectedSeason}
              onChange={(e) => setSelectedSeason(parseInt(e.target.value))}
              className="input"
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
              className="input"
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
              className="input"
            >
              <option value="">Select Profile</option>
              {profilesData?.map((profile) => (
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
              className="input"
            />
          </div>
        </div>

        {/* Player Table */}
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>
                  Player
                </th>
                <th>
                  Position
                </th>
                <th>
                  Team
                </th>
                <th>
                  Fantasy Points
                </th>
                <th>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
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
                      <button className="btn btn-primary btn-sm mr-3">
                        View Stats
                      </button>
                      <button className="btn btn-secondary btn-sm">
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
    </div>

    {/* Quick Stats Preview */}
    {selectedProfile && (
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-semibold text-gray-900">Quick Stats Preview</h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card">
              <h4 className="font-medium text-gray-900 mb-2">Top Performers</h4>
              <p className="text-sm text-gray-600">Select a player to view detailed stats</p>
            </div>
            <div className="stat-card">
              <h4 className="font-medium text-gray-900 mb-2">Position Breakdown</h4>
              <p className="text-sm text-gray-600">QB, RB, WR, TE rankings</p>
            </div>
            <div className="stat-card">
              <h4 className="font-medium text-gray-900 mb-2">Profile Comparison</h4>
              <p className="text-sm text-gray-600">Compare multiple scoring systems</p>
            </div>
          </div>
        </div>
      </div>
    )}
  </div>
  )
}
