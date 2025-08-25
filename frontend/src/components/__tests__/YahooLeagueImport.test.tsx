import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { YahooLeagueImport } from '../YahooLeagueImport'
import { ToastProvider } from '../Toast'

// Mock the Toast context
const mockAddToast = vi.fn()

vi.mock('../Toast', async () => {
  const actual = await vi.importActual('../Toast')
  return {
    ...actual,
    useToast: () => ({
      addToast: mockAddToast
    })
  }
})

// Mock fetch
global.fetch = vi.fn()

describe('YahooLeagueImport', () => {
  const mockAccessToken = 'mock-access-token'
  const mockOnLeagueSelect = vi.fn()
  const mockOnImportComplete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders league import interface', async () => {
    const mockLeagues = {
      leagues: [
        {
          id: 'league_1',
          name: 'My Fantasy League',
          season: 2024,
          scoring_type: 'PPR',
          num_teams: 12,
          is_public: false
        }
      ]
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockLeagues
    })

    render(
      <ToastProvider>
        <YahooLeagueImport accessToken={mockAccessToken} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Yahoo League Import')).toBeInTheDocument()
    })
    expect(screen.getByText('Import your fantasy football league data')).toBeInTheDocument()
  })

  it('fetches leagues on mount', async () => {
    const mockLeagues = {
      leagues: [
        {
          id: 'league_1',
          name: 'My Fantasy League',
          season: 2024,
          scoring_type: 'PPR',
          num_teams: 12,
          is_public: false
        }
      ]
    }

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockLeagues
    })

    render(
      <ToastProvider>
        <YahooLeagueImport accessToken={mockAccessToken} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/yahoo/leagues', {
        headers: {
          'Authorization': `Bearer ${mockAccessToken}`
        }
      })
    })

    expect(screen.getByText('My Fantasy League (2024) - 12 teams')).toBeInTheDocument()
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      title: 'Leagues Found',
      message: 'Found 1 fantasy football league(s)',
      duration: 3000
    })
  })

  it('shows loading state while fetching leagues', () => {
    global.fetch = vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves

    render(
      <ToastProvider>
        <YahooLeagueImport accessToken={mockAccessToken} />
      </ToastProvider>
    )

    expect(screen.getByText('Loading leagues...')).toBeInTheDocument()
  })

  it('shows error when fetching leagues fails', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

    render(
      <ToastProvider>
        <YahooLeagueImport accessToken={mockAccessToken} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('Failed to fetch leagues from Yahoo')).toBeInTheDocument()
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Error',
      message: 'Failed to fetch leagues from Yahoo',
      duration: 5000
    })
  })

  it('shows no leagues message when empty', async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ leagues: [] })
    })

    render(
      <ToastProvider>
        <YahooLeagueImport accessToken={mockAccessToken} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('No Leagues Found')).toBeInTheDocument()
    })

    expect(screen.getByText('Refresh Leagues')).toBeInTheDocument()
  })

  it('fetches league details when league is selected', async () => {
    const mockLeagues = {
      leagues: [
        {
          id: 'league_1',
          name: 'My Fantasy League',
          season: 2024,
          scoring_type: 'PPR',
          num_teams: 12,
          is_public: false
        }
      ]
    }

    const mockTeams = {
      teams: [
        {
          id: 'team_1',
          name: 'Team Alpha',
          owner: 'John Doe',
          rank: 1,
          wins: 8,
          losses: 4,
          ties: 0,
          points_for: 1250.5,
          points_against: 1180.2
        }
      ]
    }

    const mockRosters = {
      rosters: [
        {
          team_id: 'team_1',
          players: [
            { id: 'player_1', name: 'Patrick Mahomes', position: 'QB' }
          ]
        }
      ]
    }

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeagues
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTeams
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockRosters
      })

    render(
      <ToastProvider>
        <YahooLeagueImport 
          accessToken={mockAccessToken}
          onLeagueSelect={mockOnLeagueSelect}
        />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('My Fantasy League (2024) - 12 teams')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('Choose a league...')
    fireEvent.change(select, { target: { value: 'league_1' } })

    await waitFor(() => {
      expect(mockOnLeagueSelect).toHaveBeenCalledWith(mockLeagues.leagues[0])
    })

    expect(screen.getByText('My Fantasy League')).toBeInTheDocument()
    expect(screen.getByText('Team Alpha')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('handles league import', async () => {
    const mockLeagues = {
      leagues: [
        {
          id: 'league_1',
          name: 'My Fantasy League',
          season: 2024,
          scoring_type: 'PPR',
          num_teams: 12,
          is_public: false
        }
      ]
    }

    const mockTeams = {
      teams: [
        {
          id: 'team_1',
          name: 'Team Alpha',
          owner: 'John Doe',
          rank: 1,
          wins: 8,
          losses: 4,
          ties: 0,
          points_for: 1250.5,
          points_against: 1180.2
        }
      ]
    }

    const mockImportResult = {
      league_id: 'league_1',
      imported_at: '2024-01-01T00:00:00',
      teams_imported: 12,
      players_imported: 144,
      rosters_imported: 12,
      status: 'success'
    }

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeagues
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTeams
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rosters: [] })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockImportResult
      })

    render(
      <ToastProvider>
        <YahooLeagueImport 
          accessToken={mockAccessToken}
          onImportComplete={mockOnImportComplete}
        />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('My Fantasy League (2024) - 12 teams')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('Choose a league...')
    fireEvent.change(select, { target: { value: 'league_1' } })

    await waitFor(() => {
      expect(screen.getByText('Import League Data')).toBeInTheDocument()
    })

    const importButton = screen.getByText('Import League Data')
    fireEvent.click(importButton)

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/yahoo/import-league', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${mockAccessToken}`
        },
        body: JSON.stringify({
          league_id: 'league_1',
          include_rosters: true,
          include_standings: true
        })
      })
    })

    expect(mockOnImportComplete).toHaveBeenCalledWith(mockImportResult)
    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'success',
      title: 'League Imported!',
      message: 'Successfully imported My Fantasy League with 1 teams',
      duration: 5000
    })
  })

  it('shows error when import fails', async () => {
    const mockLeagues = {
      leagues: [
        {
          id: 'league_1',
          name: 'My Fantasy League',
          season: 2024,
          scoring_type: 'PPR',
          num_teams: 12,
          is_public: false
        }
      ]
    }

    const mockTeams = {
      teams: [
        {
          id: 'team_1',
          name: 'Team Alpha',
          owner: 'John Doe',
          rank: 1,
          wins: 8,
          losses: 4,
          ties: 0,
          points_for: 1250.5,
          points_against: 1180.2
        }
      ]
    }

    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockLeagues
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockTeams
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ rosters: [] })
      })
      .mockResolvedValueOnce({
        ok: false
      })

    render(
      <ToastProvider>
        <YahooLeagueImport accessToken={mockAccessToken} />
      </ToastProvider>
    )

    await waitFor(() => {
      expect(screen.getByText('My Fantasy League (2024) - 12 teams')).toBeInTheDocument()
    })

    const select = screen.getByDisplayValue('Choose a league...')
    fireEvent.change(select, { target: { value: 'league_1' } })

    await waitFor(() => {
      expect(screen.getByText('Import League Data')).toBeInTheDocument()
    })

    const importButton = screen.getByText('Import League Data')
    fireEvent.click(importButton)

    await waitFor(() => {
      expect(screen.getByText('Failed to import league data')).toBeInTheDocument()
    })

    expect(mockAddToast).toHaveBeenCalledWith({
      type: 'error',
      title: 'Import Failed',
      message: 'Failed to import league data',
      duration: 5000
    })
  })
})
