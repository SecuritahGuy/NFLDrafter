import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '../../test/test-utils'
import { PlayerExplorer } from '../PlayerExplorer'
import { mockScoringProfiles } from '../../test/mocks'

// Mock the hooks
vi.mock('../../hooks/usePoints', () => ({
  useScoringProfiles: vi.fn()
}))

import { useScoringProfiles } from '../../hooks/usePoints'

describe('PlayerExplorer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders loading state when profiles are loading', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    expect(screen.getByText('Loading scoring profiles...')).toBeInTheDocument()
  })

  it('renders the player explorer interface when loaded', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    expect(screen.getByText('Player Explorer')).toBeInTheDocument()
    expect(screen.getByText('Season')).toBeInTheDocument()
    expect(screen.getByText('Week')).toBeInTheDocument()
    expect(screen.getByText('Scoring Profile')).toBeInTheDocument()
    expect(screen.getByText('Search Players')).toBeInTheDocument()
  })

  it('displays season selection dropdown', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    const seasonSelect = screen.getByDisplayValue('2023')
    expect(seasonSelect).toBeInTheDocument()
    
    // Check that season options are available
    expect(screen.getByText('2020')).toBeInTheDocument()
    expect(screen.getByText('2024')).toBeInTheDocument()
  })

  it('displays week selection dropdown', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    const weekSelect = screen.getByDisplayValue('Week 1')
    expect(weekSelect).toBeInTheDocument()
    
    // Check that week options are available
    expect(screen.getByText('Week 18')).toBeInTheDocument()
  })

  it('displays scoring profile selection dropdown', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    // Check that profile options are rendered
    expect(screen.getByText('Standard PPR')).toBeInTheDocument()
    expect(screen.getByText('Half PPR')).toBeInTheDocument()
  })

  it('displays mock player data in table', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    // Check for mock players
    expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
    expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
    expect(screen.getByText('Tyreek Hill')).toBeInTheDocument()
    expect(screen.getByText('Travis Kelce')).toBeInTheDocument()
    expect(screen.getByText('Justin Jefferson')).toBeInTheDocument()
  })

  it('filters players based on search query', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    const searchInput = screen.getByPlaceholderText('Player name...')
    fireEvent.change(searchInput, { target: { value: 'mahomes' } })
    
    // Should show only Mahomes
    expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
    expect(screen.queryByText('Christian McCaffrey')).not.toBeInTheDocument()
  })

  it('shows no results message when search yields no matches', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    const searchInput = screen.getByPlaceholderText('Player name...')
    fireEvent.change(searchInput, { target: { value: 'nonexistent player' } })
    
    expect(screen.getByText('No players found matching your search criteria.')).toBeInTheDocument()
  })

  it('shows quick stats preview when profile is selected', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    // Initially should not show preview
    expect(screen.queryByText('Quick Stats Preview')).not.toBeInTheDocument()
    
    // Select a profile
    const profileSelect = screen.getByDisplayValue('Select Profile')
    fireEvent.change(profileSelect, { target: { value: 'test-profile-1' } })
    
    // Now should show preview
    expect(screen.getByText('Quick Stats Preview')).toBeInTheDocument()
    expect(screen.getByText('Top Performers')).toBeInTheDocument()
    expect(screen.getByText('Position Breakdown')).toBeInTheDocument()
    expect(screen.getByText('Profile Comparison')).toBeInTheDocument()
  })

  it('displays correct player positions and teams', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    // Check position badges (use getAllByText for positions that appear multiple times)
    expect(screen.getByText('QB')).toBeInTheDocument()
    expect(screen.getByText('RB')).toBeInTheDocument()
    expect(screen.getAllByText('WR')).toHaveLength(2) // Tyreek Hill and Justin Jefferson
    expect(screen.getByText('TE')).toBeInTheDocument()
    
    // Check team abbreviations (use getAllByText for teams that appear multiple times)
    expect(screen.getAllByText('KC')).toHaveLength(2) // Mahomes and Kelce
    expect(screen.getByText('SF')).toBeInTheDocument()
    expect(screen.getByText('MIA')).toBeInTheDocument()
    expect(screen.getByText('MIN')).toBeInTheDocument()
  })

  it('renders action buttons for each player', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<PlayerExplorer />)
    
    const viewStatsButtons = screen.getAllByText('View Stats')
    const compareButtons = screen.getAllByText('Compare')
    
    // Should have buttons for each player (5 players)
    expect(viewStatsButtons).toHaveLength(5)
    expect(compareButtons).toHaveLength(5)
  })
})
