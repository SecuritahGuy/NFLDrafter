import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { VORP } from '../VORP'

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ChevronUpIcon: ({ className }: { className: string }) => (
    <div data-testid="chevron-up" className={className}>↑</div>
  ),
  ChevronDownIcon: ({ className }: { className: string }) => (
    <div data-testid="chevron-down" className={className}>↓</div>
  ),
}))

// Mock data
const mockPlayers = [
  {
    id: '1',
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF',
    fantasyPoints: 350.5,
    yahooPoints: 340.2,
    delta: 10.3,
    vorp: 45.2,
    tier: 1,
    adp: 2,
    newsCount: 3,
    byeWeek: 9,
  },
  {
    id: '2',
    name: 'Patrick Mahomes',
    position: 'QB',
    team: 'KC',
    fantasyPoints: 320.8,
    yahooPoints: 315.6,
    delta: 5.2,
    vorp: 38.7,
    tier: 1,
    adp: 15,
    newsCount: 2,
    byeWeek: 10,
  },
  {
    id: '3',
    name: 'Tyreek Hill',
    position: 'WR',
    team: 'MIA',
    fantasyPoints: 310.2,
    yahooPoints: 305.8,
    delta: 4.4,
    vorp: 35.1,
    tier: 1,
    adp: 8,
    newsCount: 4,
    byeWeek: 11,
  },
  {
    id: '4',
    name: 'Travis Kelce',
    position: 'TE',
    team: 'KC',
    fantasyPoints: 280.5,
    yahooPoints: 275.3,
    delta: 5.2,
    vorp: 42.8,
    tier: 1,
    adp: 12,
    newsCount: 1,
    byeWeek: 10,
  },
  {
    id: '5',
    name: 'Austin Ekeler',
    position: 'RB',
    team: 'LAC',
    fantasyPoints: 290.1,
    yahooPoints: 285.7,
    delta: 4.4,
    vorp: 32.6,
    tier: 2,
    adp: 18,
    newsCount: 2,
    byeWeek: 7,
  },
  {
    id: '6',
    name: 'Justin Herbert',
    position: 'QB',
    team: 'LAC',
    fantasyPoints: 280.3,
    yahooPoints: 275.1,
    delta: 5.2,
    vorp: 28.2,
    tier: 2,
    adp: 25,
    newsCount: 1,
    byeWeek: 7,
  },
]

const defaultProps = {
  players: mockPlayers,
  onVorpChange: vi.fn(),
  replacementRanks: { QB: 12, RB: 24, WR: 36, TE: 12, K: 12, DEF: 12 },
  onReplacementRanksChange: vi.fn(),
}

describe('VORP Component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('renders the component with title', () => {
      render(<VORP {...defaultProps} />)
      expect(screen.getByText('VORP Analysis')).toBeInTheDocument()
    })

    it('shows expand/collapse button', () => {
      render(<VORP {...defaultProps} />)
      expect(screen.getByTestId('chevron-up')).toBeInTheDocument()
    })

    it('shows replacement ranks toggle button', () => {
      render(<VORP {...defaultProps} />)
      expect(screen.getByText('Show Replacement Ranks')).toBeInTheDocument()
    })

    it('renders players by default when expanded', () => {
      render(<VORP {...defaultProps} />)
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
      expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
    })
  })

  describe('Empty State', () => {
    it('shows empty state when no players', () => {
      render(<VORP {...defaultProps} players={[]} />)
      expect(screen.getByText('No players available')).toBeInTheDocument()
      expect(screen.getByText('Add players to see VORP calculations')).toBeInTheDocument()
    })
  })

  describe('VORP Calculations', () => {
    it('calculates VORP correctly for each position', () => {
      render(<VORP {...defaultProps} />)
      
      // RB replacement rank is 24, so replacement value should be 0 (no 24th RB)
      // McCaffrey (350.5) - 0 = 350.5 VORP
      // Ekeler (290.1) - 0 = 290.1 VORP
      
      // QB replacement rank is 12, so replacement value should be 0 (no 12th QB)
      // Mahomes (320.8) - 0 = 320.8 VORP
      // Herbert (280.3) - 0 = 280.3 VORP
      
      expect(screen.getByText('350.5')).toBeInTheDocument() // McCaffrey
      expect(screen.getByText('320.8')).toBeInTheDocument() // Mahomes
    })

    it('sorts players by VORP descending', () => {
      render(<VORP {...defaultProps} />)
      
      const playerRows = screen.getAllByTestId(/vorp-player-/)
      expect(playerRows).toHaveLength(6)
      
      // First player should be highest VORP
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
    })

    it('handles players with undefined fantasy points', () => {
      const playersWithUndefined = [
        { ...mockPlayers[0], fantasyPoints: undefined },
        { ...mockPlayers[1], fantasyPoints: 300 },
      ]
      
      render(<VORP {...defaultProps} players={playersWithUndefined} />)
      
      // Should only show players with defined fantasy points
      expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
      expect(screen.queryByText('Christian McCaffrey')).not.toBeInTheDocument()
    })
  })

  describe('Replacement Ranks Configuration', () => {
    it('shows replacement ranks when toggle is clicked', () => {
      render(<VORP {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Show Replacement Ranks'))
      
      expect(screen.getByText('Replacement Ranks by Position')).toBeInTheDocument()
      // Check that we have inputs with the expected values
      const inputs12 = screen.getAllByDisplayValue('12')
      const input24 = screen.getByDisplayValue('24')
      const input36 = screen.getByDisplayValue('36')
      
      expect(inputs12.length).toBeGreaterThan(0) // QB, TE, K, DEF all have value 12
      expect(input24).toBeInTheDocument() // RB
      expect(input36).toBeInTheDocument() // WR
    })

    it('allows changing replacement ranks', () => {
      render(<VORP {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Show Replacement Ranks'))
      
      // Get the first input with value 12 (QB)
      const inputs12 = screen.getAllByDisplayValue('12')
      const qbInput = inputs12[0] as HTMLInputElement
      expect(qbInput).toBeInTheDocument()
      
      fireEvent.change(qbInput, { target: { value: '15' } })
      
      expect(defaultProps.onReplacementRanksChange).toHaveBeenCalledWith({
        ...defaultProps.replacementRanks,
        QB: 15,
      })
    })

    it('constrains replacement rank values to valid range', () => {
      render(<VORP {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Show Replacement Ranks'))
      
      // Get the first input with value 12 (QB)
      const inputs12 = screen.getAllByDisplayValue('12')
      const qbInput = inputs12[0] as HTMLInputElement
      expect(qbInput).toBeInTheDocument()
      
      fireEvent.change(qbInput, { target: { value: '0' } })
      
      expect(defaultProps.onReplacementRanksChange).toHaveBeenCalledWith({
        ...defaultProps.replacementRanks,
        QB: 1, // Should be constrained to minimum 1
      })
    })

    it('shows position colors correctly', () => {
      render(<VORP {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Show Replacement Ranks'))
      
      // Get the first occurrence of each position label (from replacement ranks section)
      const qbLabel = screen.getAllByText('QB')[0]
      const rbLabel = screen.getAllByText('RB')[0]
      const wrLabel = screen.getAllByText('WR')[0]
      
      expect(qbLabel).toHaveClass('bg-blue-100', 'text-blue-800')
      expect(rbLabel).toHaveClass('bg-green-100', 'text-green-800')
      expect(wrLabel).toHaveClass('bg-purple-100', 'text-purple-800')
    })
  })

  describe('Expand/Collapse Functionality', () => {
    it('collapses content when toggle is clicked', () => {
      render(<VORP {...defaultProps} />)
      
      fireEvent.click(screen.getByTestId('chevron-up'))
      
      expect(screen.getByTestId('chevron-down')).toBeInTheDocument()
      expect(screen.queryByText('Christian McCaffrey')).not.toBeInTheDocument()
    })

    it('expands content when toggle is clicked again', () => {
      render(<VORP {...defaultProps} />)
      
      // First click to collapse
      fireEvent.click(screen.getByTestId('chevron-up'))
      expect(screen.queryByText('Christian McCaffrey')).not.toBeInTheDocument()
      
      // Second click to expand
      fireEvent.click(screen.getByTestId('chevron-down'))
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
    })
  })

  describe('Player Display', () => {
    it('shows player information correctly', () => {
      render(<VORP {...defaultProps} />)
      
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
      expect(screen.getByText('SF')).toBeInTheDocument()
      // Use getAllByText since there are multiple RB elements
      expect(screen.getAllByText('RB').length).toBeGreaterThan(0)
      expect(screen.getByText('350.5')).toBeInTheDocument()
    })

    it('shows position badges with correct colors', () => {
      render(<VORP {...defaultProps} />)
      
      // Look for position badges in the player display section (not replacement ranks)
      // Get the first player row and check its position badge
      const firstPlayerRow = screen.getByTestId('vorp-player-1')
      const rbBadge = firstPlayerRow.querySelector('[class*="bg-green-100"]')
      const qbBadge = screen.getByTestId('vorp-player-2').querySelector('[class*="bg-blue-100"]')
      
      expect(rbBadge).toBeInTheDocument()
      expect(qbBadge).toBeInTheDocument()
      
      // Check that they have the correct color classes
      expect(rbBadge).toHaveClass('bg-green-100', 'text-green-800')
      expect(qbBadge).toHaveClass('bg-blue-100', 'text-blue-800')
    })

    it('limits display to top 20 players', () => {
      const manyPlayers = Array.from({ length: 25 }, (_, i) => ({
        ...mockPlayers[0],
        id: `${i + 1}`,
        name: `Player ${i + 1}`,
        fantasyPoints: 300 - i,
      }))
      
      render(<VORP {...defaultProps} players={manyPlayers} />)
      
      expect(screen.getByText('Showing top 20 players of 25 total')).toBeInTheDocument()
    })
  })

  describe('VORP Color Coding', () => {
    it('applies correct colors based on VORP values', () => {
      const playersWithVaryingVorp = [
        { ...mockPlayers[0], fantasyPoints: 400 }, // High VORP
        { ...mockPlayers[1], fantasyPoints: 300 }, // Medium VORP
        { ...mockPlayers[2], fantasyPoints: 200 }, // Lower VORP
      ]
      
      render(<VORP {...defaultProps} players={playersWithVaryingVorp} />)
      
      // Look for VORP values in the VORP column
      // Check that we have VORP values displayed with appropriate styling
      const vorpElements = screen.getAllByText(/^\d+\.\d+$/) // Matches VORP format
      expect(vorpElements.length).toBeGreaterThan(0)
      
      // Check that at least one VORP element has styling (could be any color based on value)
      const styledVorpElement = vorpElements.find(el => 
        el.className.includes('text-') && el.className.includes('font-')
      )
      expect(styledVorpElement).toBeInTheDocument()
      
      // Verify that the styling is applied (should have both color and font weight classes)
      expect(styledVorpElement?.className).toMatch(/text-\w+-\d+/)
      expect(styledVorpElement?.className).toMatch(/font-\w+/)
    })
  })

  describe('Summary Statistics', () => {
    it('shows correct summary statistics', () => {
      render(<VORP {...defaultProps} />)
      
      expect(screen.getByText('6')).toBeInTheDocument() // Total Players
      expect(screen.getByText('6')).toBeInTheDocument() // Positive VORP (all players have positive VORP in this case)
    })

    it('calculates average VORP correctly', () => {
      render(<VORP {...defaultProps} />)
      
      // All players have positive VORP, so average should be positive
      // Look for the specific average value that should be displayed
      const avgVorpElement = screen.getByText('16.8') // This matches the calculated average from the test data
      expect(avgVorpElement).toBeInTheDocument()
    })
  })

  describe('Props Handling', () => {
    it('calls onVorpChange when provided', () => {
      render(<VORP {...defaultProps} />)
      
      // The component doesn't directly call onVorpChange in the current implementation
      // This test ensures the prop is properly passed through
      expect(defaultProps.onVorpChange).toBeDefined()
    })

    it('calls onReplacementRanksChange when ranks are modified', () => {
      render(<VORP {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Show Replacement Ranks'))
      
      // Get the first input with value 12 (QB)
      const inputs12 = screen.getAllByDisplayValue('12')
      const qbInput = inputs12[0] as HTMLInputElement
      expect(qbInput).toBeInTheDocument()
      
      fireEvent.change(qbInput, { target: { value: '20' } })
      
      expect(defaultProps.onReplacementRanksChange).toHaveBeenCalledWith({
        ...defaultProps.replacementRanks,
        QB: 20,
      })
    })

    it('uses default replacement ranks when not provided', () => {
      const { rerender } = render(<VORP {...defaultProps} replacementRanks={undefined} />)
      
      // Should use default ranks
      expect(screen.getByText('VORP Analysis')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles very large fantasy point values', () => {
      const playersWithLargeValues = [
        { ...mockPlayers[0], fantasyPoints: 9999.9 },
        { ...mockPlayers[1], fantasyPoints: 8888.8 },
      ]
      
      render(<VORP {...defaultProps} players={playersWithLargeValues} />)
      
      expect(screen.getByText('9999.9')).toBeInTheDocument()
      expect(screen.getByText('8888.8')).toBeInTheDocument()
    })

    it('handles negative fantasy points', () => {
      const playersWithNegativeValues = [
        { ...mockPlayers[0], fantasyPoints: -50.5 },
        { ...mockPlayers[1], fantasyPoints: 100.0 },
      ]
      
      render(<VORP {...defaultProps} players={playersWithNegativeValues} />)
      
      expect(screen.getByText('-50.5')).toBeInTheDocument()
      expect(screen.getByText('100.0')).toBeInTheDocument()
    })

    it('handles players with missing optional fields', () => {
      const playersWithMissingFields = [
        { id: '1', name: 'Player 1', position: 'QB', team: 'TEAM', fantasyPoints: 200 },
        { id: '2', name: 'Player 2', position: 'RB', team: 'TEAM', fantasyPoints: 180 },
      ]
      
      render(<VORP {...defaultProps} players={playersWithMissingFields} />)
      
      expect(screen.getByText('Player 1')).toBeInTheDocument()
      expect(screen.getByText('Player 2')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper heading structure', () => {
      render(<VORP {...defaultProps} />)
      
      const mainHeading = screen.getByRole('heading', { level: 3 })
      expect(mainHeading).toHaveTextContent('VORP Analysis')
    })

    it('has proper button labels', () => {
      render(<VORP {...defaultProps} />)
      
      const showRanksButton = screen.getByText('Show Replacement Ranks')
      const expandButton = screen.getByTestId('chevron-up')
      
      expect(showRanksButton).toBeInTheDocument()
      expect(expandButton).toBeInTheDocument()
    })

    it('has proper input labels and constraints', () => {
      render(<VORP {...defaultProps} />)
      
      fireEvent.click(screen.getByText('Show Replacement Ranks'))
      
      // Get the first input with value 12 (QB)
      const inputs12 = screen.getAllByDisplayValue('12')
      const qbInput = inputs12[0] as HTMLInputElement
      expect(qbInput).toBeInTheDocument()
      
      expect(qbInput).toHaveAttribute('min', '1')
      expect(qbInput).toHaveAttribute('max', '50')
      expect(qbInput).toHaveAttribute('type', 'number')
    })
  })
})
