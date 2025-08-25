import React, { useState, useEffect } from 'react'
import { UserGroupIcon, ArrowDownTrayIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { useToast } from './Toast'

interface YahooLeague {
  id: string
  name: string
  season: number
  scoring_type: string
  num_teams: number
  is_public: boolean
}

interface YahooTeam {
  id: string
  name: string
  owner: string
  rank: number
  wins: number
  losses: number
  ties: number
  points_for: number
  points_against: number
}

interface YahooLeagueImportProps {
  accessToken: string
  onLeagueSelect?: (league: YahooLeague) => void
  onImportComplete?: (leagueData: any) => void
  className?: string
}

export const YahooLeagueImport: React.FC<YahooLeagueImportProps> = ({
  accessToken,
  onLeagueSelect,
  onImportComplete,
  className = ''
}) => {
  const { addToast } = useToast()
  const [leagues, setLeagues] = useState<YahooLeague[]>([])
  const [selectedLeague, setSelectedLeague] = useState<YahooLeague | null>(null)
  const [teams, setTeams] = useState<YahooTeam[]>([])
  const [rosters, setRosters] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (accessToken) {
      fetchLeagues()
    }
  }, [accessToken])

  const fetchLeagues = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/yahoo/leagues', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch leagues')
      }

      const data = await response.json()
      setLeagues(data.leagues || [])
      
      if (data.leagues && data.leagues.length > 0) {
        addToast({
          type: 'success',
          title: 'Leagues Found',
          message: `Found ${data.leagues.length} fantasy football league(s)`,
          duration: 3000
        })
      }
    } catch (err) {
      console.error('Error fetching leagues:', err)
      setError('Failed to fetch leagues from Yahoo')
      addToast({
        type: 'error',
        title: 'Error',
        message: 'Failed to fetch leagues from Yahoo',
        duration: 5000
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLeagueSelect = async (league: YahooLeague) => {
    setSelectedLeague(league)
    setTeams([])
    setRosters([])
    
    // Call onLeagueSelect immediately
    onLeagueSelect?.(league)
    
    try {
      await fetchLeagueDetails(league.id, league)
    } catch (err) {
      console.error('Error fetching league details', err)
      setError('Failed to fetch league details')
    }
  }

  const fetchLeagueDetails = async (leagueId: string, league: YahooLeague) => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch teams
      const teamsResponse = await fetch(`/api/yahoo/leagues/${leagueId}/teams`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!teamsResponse.ok) {
        throw new Error('Failed to fetch teams')
      }

      const teamsData = await teamsResponse.json()
      setTeams(teamsData.teams || [])

      // Fetch rosters
      const rostersResponse = await fetch(`/api/yahoo/leagues/${leagueId}/rosters`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!rostersResponse.ok) {
        throw new Error('Failed to fetch rosters')
      }

      const rostersData = await rostersResponse.json()
      setRosters(rostersData.rosters || [])

    } catch (err) {
      console.error('Error fetching league details:', err)
      setError('Failed to fetch league details')
    } finally {
      setIsLoading(false)
    }
  }

  const handleImportLeague = async () => {
    if (!selectedLeague) return

    setIsImporting(true)
    setError(null)

    try {
      const response = await fetch('/api/yahoo/import-league', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          league_id: selectedLeague.id,
          include_rosters: true,
          include_standings: true
        })
      })

      if (!response.ok) {
        throw new Error('Failed to import league')
      }

      const data = await response.json()
      
      addToast({
        type: 'success',
        title: 'League Imported!',
        message: `Successfully imported ${selectedLeague.name} with ${teams.length} teams`,
        duration: 5000
      })

      onImportComplete?.(data)
      
    } catch (err) {
      console.error('Error importing league:', err)
      setError('Failed to import league data')
      addToast({
        type: 'error',
        title: 'Import Failed',
        message: 'Failed to import league data',
        duration: 5000
      })
    } finally {
      setIsImporting(false)
    }
  }

  if (isLoading) {
    return (
      <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leagues...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
          <UserGroupIcon className="w-6 h-6 text-primary-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Yahoo League Import</h3>
          <p className="text-sm text-gray-600">Import your fantasy football league data</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </div>
      )}

      {leagues.length === 0 ? (
        <div className="text-center py-8">
          <UserGroupIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No Leagues Found</h4>
          <p className="text-gray-600 mb-4">
            We couldn't find any fantasy football leagues in your Yahoo account.
          </p>
          <button
            onClick={fetchLeagues}
            className="bg-primary-600 hover:bg-primary-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Refresh Leagues
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select League
            </label>
            <select
              value={selectedLeague?.id || ''}
              onChange={(e) => {
                const league = leagues.find(l => l.id === e.target.value)
                if (league) handleLeagueSelect(league)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Choose a league...</option>
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.name} ({league.season}) - {league.num_teams} teams
                </option>
              ))}
            </select>
          </div>

          {selectedLeague && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">{selectedLeague.name}</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Season:</span>
                    <span className="ml-2 font-medium">{selectedLeague.season}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Teams:</span>
                    <span className="ml-2 font-medium">{selectedLeague.num_teams}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Scoring:</span>
                    <span className="ml-2 font-medium">{selectedLeague.scoring_type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <span className="ml-2 font-medium">
                      {selectedLeague.is_public ? 'Public' : 'Private'}
                    </span>
                  </div>
                </div>
              </div>

              {teams.length > 0 && (
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Teams ({teams.length})</h5>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {teams.map((team) => (
                      <div key={team.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm">
                        <span className="font-medium">{team.name}</span>
                        <span className="text-gray-600">{team.owner}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={handleImportLeague}
                disabled={isImporting}
                className="w-full bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {isImporting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <ArrowDownTrayIcon className="w-5 h-5" />
                    Import League Data
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
