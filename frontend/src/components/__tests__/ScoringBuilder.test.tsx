import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '../../test/test-utils'
import { ScoringBuilder } from '../ScoringBuilder'
import { mockScoringProfiles } from '../../test/mocks'

// Mock the hooks
vi.mock('../../hooks/usePoints', () => ({
  useScoringProfiles: vi.fn()
}))

import { useScoringProfiles } from '../../hooks/usePoints'

describe('ScoringBuilder', () => {
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

    render(<ScoringBuilder />)
    
    expect(screen.getByText('Loading scoring profiles...')).toBeInTheDocument()
  })

  it('renders the scoring builder form when profiles are loaded', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<ScoringBuilder />)
    
    expect(screen.getByText('Scoring Profile Builder')).toBeInTheDocument()
    expect(screen.getByText('Select Existing Profile')).toBeInTheDocument()
    expect(screen.getByText('Scoring Rules')).toBeInTheDocument()
  })

  it('displays existing profiles in the dropdown', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<ScoringBuilder />)
    
    // Check that profile options are rendered
    expect(screen.getByText('Standard PPR')).toBeInTheDocument()
    expect(screen.getByText('Half PPR')).toBeInTheDocument()
  })

  it('renders default scoring rules', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<ScoringBuilder />)
    
    // Check for some default rules - there should be 7 rule rows by default
    const removeButtons = screen.getAllByText('Remove')
    expect(removeButtons).toHaveLength(7) // 7 default rules
    
    // Check that multiplier values are present (these are inputs, not selects)
    expect(screen.getByDisplayValue('0.04')).toBeInTheDocument()
    expect(screen.getByDisplayValue('4')).toBeInTheDocument()
    expect(screen.getAllByDisplayValue('0.1')).toHaveLength(2) // rushing_yards and receiving_yards
    expect(screen.getAllByDisplayValue('6')).toHaveLength(2) // rushing_touchdowns and receiving_touchdowns
    expect(screen.getByDisplayValue('0.5')).toBeInTheDocument()
    
    // Check that some 'per' values are present
    expect(screen.getAllByDisplayValue('1')).toHaveLength(3) // passing_yards, rushing_yards, receiving_yards have per: 1
  })

  it('allows adding new scoring rules', async () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<ScoringBuilder />)
    
    const addButton = screen.getByText('Add Rule')
    fireEvent.click(addButton)
    
    // Should have one more rule row than the default 7
    const statSelects = screen.getAllByDisplayValue('Select stat')
    expect(statSelects).toHaveLength(1) // One empty rule added
  })

  it('allows removing scoring rules', async () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<ScoringBuilder />)
    
    const removeButtons = screen.getAllByText('Remove')
    const initialCount = removeButtons.length
    
    fireEvent.click(removeButtons[0])
    
    // Should have one fewer remove button
    const updatedRemoveButtons = screen.getAllByText('Remove')
    expect(updatedRemoveButtons).toHaveLength(initialCount - 1)
  })

  it('allows updating rule values', async () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<ScoringBuilder />)
    
    // Find the first multiplier input and change its value
    const multiplierInputs = screen.getAllByDisplayValue('0.04')
    const firstMultiplierInput = multiplierInputs[0]
    
    fireEvent.change(firstMultiplierInput, { target: { value: '0.05' } })
    
    expect(firstMultiplierInput).toHaveValue(0.05)
  })

  it('renders profile preview', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<ScoringBuilder />)
    
    expect(screen.getByText('Profile Preview')).toBeInTheDocument()
    
    // Check that JSON preview contains expected content
    const previewSection = screen.getByText((content, element) => {
      return element?.tagName.toLowerCase() === 'pre' && content.includes('passing_yards')
    })
    expect(previewSection).toBeInTheDocument()
  })

  it('renders action buttons', () => {
    vi.mocked(useScoringProfiles).mockReturnValue({
      data: mockScoringProfiles,
      isLoading: false,
      error: null,
      isError: false
    } as any)

    render(<ScoringBuilder />)
    
    expect(screen.getByText('Save Profile')).toBeInTheDocument()
    expect(screen.getByText('Test Profile')).toBeInTheDocument()
  })
})
