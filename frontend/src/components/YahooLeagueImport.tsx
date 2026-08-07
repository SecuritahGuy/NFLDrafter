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

interface YahooLeagueSettings {
  roster_positions: Array<{ position: string; count: number }>
  translation: {
    rules: Array<{ stat_key: string; multiplier: number; source_name: string }>
    unmapped_stat_modifiers: Array<{ stat_id: string; value: number; name: string }>
    roster_slots: Array<{ position: string; normalized_position: string; count: number }>
    draft_config: { league_size: number; rounds: number }
    complete: boolean
  }
}

interface YahooImportResult {
  imported_at: string
  teams_imported: number
  players_imported: number
  rosters_imported: number
  prepared_league: YahooLeagueSettings['translation']
  scoring_profile: { name: string; rule_count: number; complete: boolean } | null
  player_mapping: {
    total: number
    matched: number
    ambiguous: number
    unmatched: number
    results: Array<{ external_id: string; status: string; method: string }>
  }
  status: string
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
  const [settings, setSettings] = useState<YahooLeagueSettings | null>(null)
  const [importResult, setImportResult] = useState<YahooImportResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const responseError = async (response: Response, fallback: string) => {
    try {
      const data = await response.json()
      return typeof data?.detail === 'string' ? data.detail : fallback
    } catch {
      return fallback
    }
  }

  useEffect(() => {
    if (accessToken) {
      fetchLeagues()
    }
  }, [accessToken])

  const fetchLeagues = async () => {
    setIsLoading(true)
    setError(null)
    let failureMessage = 'Failed to fetch leagues from Yahoo'

    try {
      const response = await fetch('/api/yahoo/leagues', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      })

      if (!response.ok) {
        failureMessage = await responseError(response, failureMessage)
        throw new Error(failureMessage)
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
      setError(failureMessage)
      addToast({
        type: 'error',
        title: 'Error',
        message: failureMessage,
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
    setSettings(null)
    setImportResult(null)
    
    // Call onLeagueSelect immediately
    onLeagueSelect?.(league)
    
    try {
      await fetchLeagueDetails(league.id)
    } catch (err) {
      console.error('Error fetching league details', err)
      setError('Failed to fetch league details')
    }
  }

  const fetchLeagueDetails = async (leagueId: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const headers = { 'Authorization': `Bearer ${accessToken}` }
      const [teamsResponse, rostersResponse, settingsResponse] = await Promise.all([
        fetch(`/api/yahoo/leagues/${leagueId}/teams`, { headers }),
        fetch(`/api/yahoo/leagues/${leagueId}/rosters`, { headers }),
        fetch(`/api/yahoo/leagues/${leagueId}/settings`, { headers }),
      ])
      if (!teamsResponse.ok || !rostersResponse.ok || !settingsResponse.ok) {
        throw new Error('Yahoo did not return complete league details')
      }

      const [teamsData, rostersData, settingsData] = await Promise.all([
        teamsResponse.json(), rostersResponse.json(), settingsResponse.json(),
      ])
      setTeams(teamsData.teams || [])
      setRosters(rostersData.rosters || [])
      setSettings(settingsData)

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
      setImportResult(data)
      
      addToast({
        type: 'success',
        title: 'League Imported!',
        message: `Imported ${data.teams_imported} teams and matched ${data.player_mapping?.matched ?? 0} players`,
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leagues...</p>
        </div>
      </div>
    )
  }

  const previewPlayerCount = rosters.reduce(
    (total, roster) => total + (roster.players?.length ?? 0),
    0,
  )
  const mappingCoverage = importResult?.player_mapping.total
    ? Math.round((importResult.player_mapping.matched / importResult.player_mapping.total) * 100)
    : 0

  return (
    <div className={`bg-white rounded-xl border border-gray-200 shadow-sm p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <UserGroupIcon className="w-6 h-6 text-blue-600" />
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
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
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
              title="Select League"
              value={selectedLeague?.id || ''}
              onChange={(e) => {
                const league = leagues.find(l => l.id === e.target.value)
                if (league) handleLeagueSelect(league)
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

              {settings && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between">
                    <h5 className="font-semibold text-slate-900">Import preflight</h5>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${settings.translation.complete ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                      {settings.translation.complete ? 'Scoring mapped' : 'Review scoring'}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-slate-500">Teams loaded</span><div className="font-bold text-slate-900">{teams.length} / {selectedLeague.num_teams}</div></div>
                    <div><span className="text-slate-500">Roster players</span><div className="font-bold text-slate-900">{previewPlayerCount}</div></div>
                    <div><span className="text-slate-500">Draft rounds</span><div className="font-bold text-slate-900">{settings.translation.draft_config.rounds}</div></div>
                    <div><span className="text-slate-500">Scoring rules</span><div className="font-bold text-slate-900">{settings.translation.rules.length} mapped</div></div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Yahoo roster slots">
                    {settings.translation.roster_slots.map((slot, index) => (
                      <span key={`${slot.position}-${index}`} className="rounded bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                        {slot.normalized_position} × {slot.count}
                      </span>
                    ))}
                  </div>
                  {settings.translation.unmapped_stat_modifiers.length > 0 && (
                    <p className="mt-3 text-xs font-medium text-amber-800">
                      {settings.translation.unmapped_stat_modifiers.length} Yahoo scoring categories need manual review; NFLDrafter will not guess their meaning.
                    </p>
                  )}
                </div>
              )}

              <button
                onClick={handleImportLeague}
                disabled={isImporting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
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

              {importResult && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4" data-testid="yahoo-import-report">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="h-5 w-5 text-emerald-600" />
                    <h5 className="font-bold text-emerald-950">Dress rehearsal report</h5>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                    <div><span className="text-emerald-800">Teams</span><div className="font-black text-emerald-950">{importResult.teams_imported}</div></div>
                    <div><span className="text-emerald-800">Rosters</span><div className="font-black text-emerald-950">{importResult.rosters_imported}</div></div>
                    <div><span className="text-emerald-800">Players</span><div className="font-black text-emerald-950">{importResult.players_imported}</div></div>
                    <div><span className="text-emerald-800">ID coverage</span><div className="font-black text-emerald-950">{mappingCoverage}%</div></div>
                  </div>
                  <p className="mt-3 text-xs text-emerald-900">
                    {importResult.player_mapping.matched} matched · {importResult.player_mapping.ambiguous} ambiguous · {importResult.player_mapping.unmatched} unmatched
                  </p>
                  <p className="mt-1 text-xs text-emerald-900">
                    Scoring profile: {importResult.scoring_profile?.name ?? 'not created'} ({importResult.scoring_profile?.rule_count ?? 0} rules)
                  </p>
                  {(importResult.player_mapping.ambiguous > 0 || importResult.player_mapping.unmatched > 0) && (
                    <details className="mt-3 text-xs text-amber-950">
                      <summary className="cursor-pointer font-bold">Review unresolved Yahoo player IDs</summary>
                      <ul className="mt-2 space-y-1">
                        {importResult.player_mapping.results.filter(item => item.status !== 'matched').map(item => (
                          <li key={item.external_id}>{item.external_id} — {item.status}</li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
