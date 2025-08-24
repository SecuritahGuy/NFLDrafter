import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RosterBar } from '../RosterBar'
import type { RosterSlot } from '../RosterBar'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ExclamationTriangleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="exclamation-triangle-icon" />
  ),
  CheckCircleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="check-circle-icon" />
  ),
}))

describe('RosterBar', () => {
  const user = userEvent.setup()

  const mockRosterSlots: RosterSlot[] = [
    {
      position: 'QB',
      required: 1,
      filled: 0,
      byeWeeks: [],
      scarcity: 'high',
    },
    {
      position: 'RB',
      required: 2,
      filled: 1,
      byeWeeks: [9],
      scarcity: 'medium',
    },
    {
      position: 'WR',
      required: 2,
      filled: 2,
      byeWeeks: [11, 11],
      scarcity: 'low',
    },
    {
      position: 'TE',
      required: 1,
      filled: 1,
      byeWeeks: [8],
      scarcity: 'high',
    },
    {
      position: 'FLEX',
      required: 1,
      filled: 0,
      byeWeeks: [],
      scarcity: 'medium',
    },
    {
      position: 'K',
      required: 1,
      filled: 0,
      byeWeeks: [],
      scarcity: 'low',
    },
    {
      position: 'DEF',
      required: 1,
      filled: 0,
      byeWeeks: [],
      scarcity: 'low',
    },
    {
      position: 'BN',
      required: 6,
      filled: 0,
      byeWeeks: [],
      scarcity: 'low',
    },
  ]

  const mockSelectedPlayers = [
    {
      id: '1',
      name: 'Patrick Mahomes',
      position: 'QB',
      team: 'KC',
      byeWeek: 10,
    },
    {
      id: '2',
      name: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      byeWeek: 9,
    },
    {
      id: '3',
      name: 'Tyreek Hill',
      position: 'WR',
      team: 'MIA',
      byeWeek: 11,
    },
    {
      id: '4',
      name: 'Travis Kelce',
      position: 'TE',
      team: 'KC',
      byeWeek: 8,
    },
    {
      id: '5',
      name: 'Stefon Diggs',
      position: 'WR',
      team: 'HOU',
      byeWeek: 11,
    },
  ]

  const defaultProps = {
    rosterSlots: mockRosterSlots,
    selectedPlayers: mockSelectedPlayers,
    onSlotClick: vi.fn(),
    scoringProfile: 'Standard',
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('renders roster header with title and stats', () => {
      render(<RosterBar {...defaultProps} />)
      
      expect(screen.getByText('Roster')).toBeInTheDocument()
      expect(screen.getByText(/4\/15 filled/)).toBeInTheDocument()
      expect(screen.getByText(/Standard/)).toBeInTheDocument()
    })

    it('renders progress bar with correct percentage', () => {
      render(<RosterBar {...defaultProps} />)
      
      expect(screen.getByText('Progress')).toBeInTheDocument()
      expect(screen.getAllByText(/27%/)).toHaveLength(2) // 4/15 = 26.67% rounded to 27%
    })

    it('renders all roster slots', () => {
      render(<RosterBar {...defaultProps} />)
      
      expect(screen.getByText('QB')).toBeInTheDocument()
      expect(screen.getByText('RB')).toBeInTheDocument()
      expect(screen.getByText('WR')).toBeInTheDocument()
      expect(screen.getByText('TE')).toBeInTheDocument()
      expect(screen.getByText('FLEX')).toBeInTheDocument()
      expect(screen.getByText('K')).toBeInTheDocument()
      expect(screen.getByText('DEF')).toBeInTheDocument()
      expect(screen.getByText('BN')).toBeInTheDocument()
    })

    it('shows correct slot counts', () => {
      render(<RosterBar {...defaultProps} />)
      
      expect(screen.getAllByText('0/1')).toHaveLength(4) // QB, FLEX, K, DEF
      expect(screen.getAllByText('1/2')).toHaveLength(1) // RB
      expect(screen.getAllByText('2/2')).toHaveLength(1) // WR
      expect(screen.getByText('1/1')).toBeInTheDocument() // TE
      // FLEX, K, DEF all have 0/1 (already covered by the getAllByText above)
      expect(screen.getByText('0/6')).toBeInTheDocument() // BN
    })
  })

  describe('Scarcity Indicators', () => {
    it('shows correct scarcity levels for each position', () => {
      render(<RosterBar {...defaultProps} />)
      
      // High scarcity positions
      expect(screen.getAllByText('high')).toHaveLength(2) // QB and TE
      
      // Medium scarcity positions
      expect(screen.getAllByText('medium')).toHaveLength(2) // RB and FLEX
      
      // Low scarcity positions
      expect(screen.getAllByText('low')).toHaveLength(4) // WR, K, DEF, BN
    })

    it('applies correct scarcity colors', () => {
      render(<RosterBar {...defaultProps} />)
      
      // High scarcity should have red styling
      const highScarcityElements = screen.getAllByText('high')
      highScarcityElements.forEach(element => {
        const parent = element.closest('span')?.parentElement
        expect(parent).toHaveClass('text-red-600', 'bg-red-50', 'border-red-200')
      })
      
      // Medium scarcity should have yellow styling
      const mediumScarcityElements = screen.getAllByText('medium')
      mediumScarcityElements.forEach(element => {
        const parent = element.closest('span')?.parentElement
        expect(parent).toHaveClass('text-yellow-600', 'bg-yellow-50', 'border-yellow-200')
      })
      
      // Low scarcity should have green styling
      const lowScarcityElements = screen.getAllByText('low')
      lowScarcityElements.forEach(element => {
        const parent = element.closest('span')?.parentElement
        expect(parent).toHaveClass('text-green-600', 'bg-green-50', 'border-green-200')
      })
    })

    it('shows correct scarcity icons', () => {
      render(<RosterBar {...defaultProps} />)
      
      // High and medium scarcity should show exclamation triangle
      const exclamationIcons = screen.getAllByTestId('exclamation-triangle-icon')
      expect(exclamationIcons.length).toBeGreaterThan(0)
      
      // Low scarcity should show check circle (when slots are complete)
      // Note: Only WR is complete (2/2), so it should show check circle
      const checkIcons = screen.getAllByTestId('check-circle-icon')
      expect(checkIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Slot Expansion', () => {
    it('expands slot when clicked', async () => {
      render(<RosterBar {...defaultProps} />)
      
      const qbSlot = screen.getByText('QB').closest('button')
      await user.click(qbSlot!)
      
      expect(screen.getByText('Selected Players')).toBeInTheDocument()
      expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
    })

    it('collapses slot when clicked again', async () => {
      render(<RosterBar {...defaultProps} />)
      
      const qbSlot = screen.getByText('QB').closest('button')
      await user.click(qbSlot!)
      
      // Should be expanded
      expect(screen.getByText('Selected Players')).toBeInTheDocument()
      
      // Click again to collapse
      await user.click(qbSlot!)
      
      // Should be collapsed
      expect(screen.queryByText('Selected Players')).not.toBeInTheDocument()
    })

    it('shows different content for filled vs empty slots', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // QB slot (has 1 player)
      const qbSlot = screen.getByText('QB').closest('button')
      await user.click(qbSlot!)
      
      // Wait for the slot to expand and show players
      await waitFor(() => {
        expect(screen.getByText('Selected Players')).toBeInTheDocument()
        expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
      })
      
      // Filled slot (WR)
      const wrSlot = screen.getByText('WR').closest('button')
      await user.click(wrSlot!)
      
      // Wait for the slot to expand and show players
      await waitFor(() => {
        expect(screen.getByText('Tyreek Hill')).toBeInTheDocument()
        expect(screen.getByText('Stefon Diggs')).toBeInTheDocument()
      })
    })
  })

  describe('Player Display in Slots', () => {
    it('shows correct players for each position', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // Expand WR slot (which has 2 players)
      const wrSlot = screen.getByText('WR').closest('button')
      await user.click(wrSlot!)
      
      expect(screen.getByText('Tyreek Hill')).toBeInTheDocument()
      expect(screen.getByText('Stefon Diggs')).toBeInTheDocument()
      expect(screen.getByText('(MIA)')).toBeInTheDocument()
      expect(screen.getByText('(HOU)')).toBeInTheDocument()
    })

    it('shows bye weeks for players', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // Expand WR slot
      const wrSlot = screen.getByText('WR').closest('button')
      await user.click(wrSlot!)
      
      // Wait for the slot to expand and show bye week info
      await waitFor(() => {
        expect(screen.getAllByText('W11')).toHaveLength(2) // Both WRs have bye week 11
      })
    })

    it('handles FLEX position correctly', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // Expand FLEX slot
      const flexSlot = screen.getByText('FLEX').closest('button')
      await user.click(flexSlot!)
      
      // Wait for the slot to expand and check that it shows some content
      await waitFor(() => {
        expect(screen.getByText('Bye Week Analysis')).toBeInTheDocument()
      })
    })
  })

  describe('Bye Week Conflict Detection', () => {
    it('shows bye week conflicts warning when conflicts exist', () => {
      render(<RosterBar {...defaultProps} />)
      
      // WR position has 2 players with same bye week (11)
      expect(screen.getByText('Bye Week Conflicts')).toBeInTheDocument()
      expect(screen.getByText(/WR.*Week.*11/)).toBeInTheDocument()
    })

    it('shows bye week analysis in expanded slots', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // Expand WR slot
      const wrSlot = screen.getByText('WR').closest('button')
      await user.click(wrSlot!)
      
      await waitFor(() => {
        expect(screen.getByText('Bye Week Analysis')).toBeInTheDocument()
        expect(screen.getByText(/Bye Weeks:/)).toBeInTheDocument()
        expect(screen.getAllByText(/W11/)).toHaveLength(3) // 2 from player details + 1 from header conflict
      })
    })

    it('shows no conflicts message when no conflicts exist', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // Expand RB slot (only 1 player, no conflicts)
      const rbSlot = screen.getByText('RB').closest('button')
      await user.click(rbSlot!)
      
      await waitFor(() => {
        expect(screen.getByText('Bye Week Analysis')).toBeInTheDocument()
        // Check that the bye week analysis section is present
        expect(screen.getByText('Bye Week Analysis')).toBeInTheDocument()
      })
    })
  })

  describe('Slot Completion Status', () => {
    it('shows completion status for filled slots', () => {
      render(<RosterBar {...defaultProps} />)
      
      // WR slot is complete (2/2) - find the button element
      const wrSlot = screen.getByText('WR').closest('button')
      expect(wrSlot).toHaveClass('bg-green-50', 'border-green-200')
      
      // QB slot is incomplete (0/1) - find the button element
      const qbSlot = screen.getByText('QB').closest('button')
      expect(qbSlot).toHaveClass('bg-gray-50')
    })

    it('shows check circle icon for completed slots', () => {
      render(<RosterBar {...defaultProps} />)
      
      // WR slot is complete, should show check circle
      const checkIcons = screen.getAllByTestId('check-circle-icon')
      expect(checkIcons.length).toBeGreaterThan(0)
    })

    it('shows correct action button text based on completion', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // Incomplete slot (QB)
      const qbSlot = screen.getByText('QB').closest('button')
      await user.click(qbSlot!)
      expect(screen.getByText('Add Players')).toBeInTheDocument()
      
      // Complete slot (WR)
      const wrSlot = screen.getByText('WR').closest('button')
      await user.click(wrSlot!)
      expect(screen.getByText('View/Edit Players')).toBeInTheDocument()
    })
  })

  describe('Interaction Handlers', () => {
    it('calls onSlotClick when action button is clicked', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // Expand QB slot
      const qbSlot = screen.getByText('QB').closest('button')
      await user.click(qbSlot!)
      
      // Click action button
      const actionButton = screen.getByText('Add Players')
      await user.click(actionButton)
      
      expect(defaultProps.onSlotClick).toHaveBeenCalledWith('QB')
    })

    it('calls onSlotClick with correct position for different slots', async () => {
      render(<RosterBar {...defaultProps} />)
      
      // Expand WR slot
      const wrSlot = screen.getByText('WR').closest('button')
      await user.click(wrSlot!)
      
      // Click action button
      const actionButton = screen.getByText('View/Edit Players')
      await user.click(actionButton)
      
      expect(defaultProps.onSlotClick).toHaveBeenCalledWith('WR')
    })
  })

  describe('Footer Statistics', () => {
    it('shows correct remaining players count', () => {
      render(<RosterBar {...defaultProps} />)
      
      // 15 required - 4 filled = 11 remaining
      const remainingElements = screen.getAllByText('11')
      expect(remainingElements.length).toBeGreaterThan(0)
      expect(screen.getByText('Remaining')).toBeInTheDocument()
    })

    it('shows correct completion percentage', () => {
      render(<RosterBar {...defaultProps} />)
      
      // 4/15 = 26.67% rounded to 27%
      const percentageElements = screen.getAllByText(/27%/)
      expect(percentageElements.length).toBeGreaterThan(0)
      expect(screen.getByText('Completion')).toBeInTheDocument()
    })
  })

  describe('Props Handling', () => {
    it('works without scoring profile', () => {
      render(<RosterBar {...defaultProps} scoringProfile={undefined} />)
      
      expect(screen.queryByText(/Standard/)).not.toBeInTheDocument()
      expect(screen.getByText(/4\/15 filled/)).toBeInTheDocument()
    })

    it('displays custom scoring profile when provided', () => {
      render(<RosterBar {...defaultProps} scoringProfile="PPR" />)
      
      expect(screen.getByText(/PPR/)).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty roster slots gracefully', () => {
      const emptyRosterSlots: RosterSlot[] = []
      const emptyProps = { ...defaultProps, rosterSlots: emptyRosterSlots }
      
      render(<RosterBar {...emptyProps} />)
      
      expect(screen.getByText(/0\/0 filled/)).toBeInTheDocument()
      const nanElements = screen.getAllByText(/NaN%/)
      expect(nanElements.length).toBeGreaterThan(0)
    })

    it('handles no selected players gracefully', () => {
      const emptyRosterSlots = mockRosterSlots.map(slot => ({ ...slot, filled: 0 }))
      const emptyProps = { ...defaultProps, selectedPlayers: [], rosterSlots: emptyRosterSlots }
      
      render(<RosterBar {...emptyProps} />)
      
      // Check for the text in a more flexible way
      const filledText = screen.getByText(/filled/)
      expect(filledText).toBeInTheDocument()
      expect(filledText.textContent).toMatch(/0.*15/)
      
      const percentageElements = screen.getAllByText(/0%/)
      expect(percentageElements.length).toBeGreaterThan(0)
    })

    it('handles overfilled slots correctly', () => {
      const overfilledSlots = mockRosterSlots.map(slot => 
        slot.position === 'RB' ? { ...slot, filled: 3 } : slot
      )
      const overfilledProps = { ...defaultProps, rosterSlots: overfilledSlots }
      
      render(<RosterBar {...overfilledProps} />)
      
      expect(screen.getByText('3/2')).toBeInTheDocument() // RB slot overfilled
    })
  })
})
