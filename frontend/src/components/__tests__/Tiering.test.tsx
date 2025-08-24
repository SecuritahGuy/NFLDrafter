import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Tiering } from '../Tiering'
import type { Player } from '../Tiering'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ChevronUpIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-up-icon" />
  ),
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-down-icon" />
  ),
}))

describe('Tiering', () => {
  const user = userEvent.setup()

  const mockPlayers: Player[] = [
    {
      id: '1',
      name: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      fantasyPoints: 380.1,
    },
    {
      id: '2',
      name: 'Tyreek Hill',
      position: 'WR',
      team: 'MIA',
      fantasyPoints: 320.8,
    },
    {
      id: '3',
      name: 'Patrick Mahomes',
      position: 'QB',
      team: 'KC',
      fantasyPoints: 350.5,
    },
    {
      id: '4',
      name: 'Stefon Diggs',
      position: 'WR',
      team: 'HOU',
      fantasyPoints: 310.2,
    },
    {
      id: '5',
      name: 'Travis Kelce',
      position: 'TE',
      team: 'KC',
      fantasyPoints: 290.0,
    },
    {
      id: '6',
      name: 'Austin Ekeler',
      position: 'RB',
      team: 'LAC',
      fantasyPoints: 280.5,
    },
  ]

  const defaultProps = {
    players: mockPlayers,
    onTierChange: vi.fn(),
    defaultGap: 10,
    showControls: true,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Initial Render', () => {
    it('renders component with title and player count', () => {
      render(<Tiering {...defaultProps} />)
      
      expect(screen.getByText('Player Tiers')).toBeInTheDocument()
      expect(screen.getByText(/tiers.*players/)).toBeInTheDocument()
    })

    it('shows gap control slider when showControls is true', () => {
      render(<Tiering {...defaultProps} />)
      
      expect(screen.getByText('Tier Gap:')).toBeInTheDocument()
      expect(screen.getByRole('slider')).toBeInTheDocument()
      expect(screen.getByDisplayValue('10')).toBeInTheDocument()
    })

    it('hides gap control when showControls is false', () => {
      render(<Tiering {...defaultProps} showControls={false} />)
      
      expect(screen.queryByText('Tier Gap:')).not.toBeInTheDocument()
      expect(screen.queryByRole('slider')).not.toBeInTheDocument()
    })

    it('shows empty state when no players', () => {
      render(<Tiering {...defaultProps} players={[]} />)
      
      expect(screen.getByText('No players available for tiering')).toBeInTheDocument()
    })
  })

  describe('Tier Calculation', () => {
    it('creates correct number of tiers with default gap', () => {
      render(<Tiering {...defaultProps} />)
      
      // With 10-point gap, should create multiple tiers
      const tierElements = screen.getAllByText(/Tier \d+/)
      expect(tierElements.length).toBeGreaterThan(1)
    })

    it('creates single tier when gap is very large', () => {
      render(<Tiering {...defaultProps} defaultGap={100} />)
      
      const tierElements = screen.getAllByText(/Tier \d+/)
      expect(tierElements.length).toBe(1)
    })

    it('creates many tiers when gap is very small', () => {
      render(<Tiering {...defaultProps} defaultGap={1} />)
      
      const tierElements = screen.getAllByText(/Tier \d+/)
      expect(tierElements.length).toBeGreaterThan(3)
    })

    it('sorts players by fantasy points within tiers', () => {
      render(<Tiering {...defaultProps} />)
      
      // First tier should have highest points player
      expect(screen.getByText('380.1 pts')).toBeInTheDocument()
    })
  })

  describe('Tier Display', () => {
    it('shows tier headers with correct colors', () => {
      render(<Tiering {...defaultProps} />)
      
      const tier1 = screen.getByText('Tier 1')
      expect(tier1).toBeInTheDocument()
      expect(tier1.closest('span')).toHaveClass('bg-red-100', 'border-red-300', 'text-red-800')
    })

    it('shows player count for each tier', () => {
      render(<Tiering {...defaultProps} />)
      
      // Should show player counts like "1 player" or "2 players"
      expect(screen.getAllByText(/1 player/)).toHaveLength(4) // 4 tiers with 1 player each
    })

    it('shows fantasy points for tier leaders', () => {
      render(<Tiering {...defaultProps} />)
      
      expect(screen.getByText('380.1 pts')).toBeInTheDocument()
    })

    it('shows chevron icons for expand/collapse', () => {
      render(<Tiering {...defaultProps} />)
      
      const chevronIcons = screen.getAllByTestId('chevron-down-icon')
      expect(chevronIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Tier Expansion', () => {
    it('expands tier when clicked', async () => {
      render(<Tiering {...defaultProps} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      await user.click(tier1Button!)
      
      // Should show players in the tier
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
      expect(screen.getByText('RB • SF')).toBeInTheDocument()
    })

    it('collapses tier when clicked again', async () => {
      render(<Tiering {...defaultProps} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      
      // Expand first
      await user.click(tier1Button!)
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
      
      // Collapse
      await user.click(tier1Button!)
      expect(screen.queryByText('Christian McCaffrey')).not.toBeInTheDocument()
    })

    it('shows chevron up when expanded', async () => {
      render(<Tiering {...defaultProps} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      await user.click(tier1Button!)
      
      const upIcons = screen.getAllByTestId('chevron-up-icon')
      expect(upIcons.length).toBeGreaterThan(0)
    })
  })

  describe('Player Display in Tiers', () => {
    it('shows player information when tier is expanded', async () => {
      render(<Tiering {...defaultProps} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      await user.click(tier1Button!)
      
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
      expect(screen.getByText('RB • SF')).toBeInTheDocument()
      expect(screen.getByText('380.1')).toBeInTheDocument()
    })

    it('shows multiple players in same tier', async () => {
      render(<Tiering {...defaultProps} defaultGap={50} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      await user.click(tier1Button!)
      
      // Wait for the tier to expand
      await waitFor(() => {
        expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
        expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
      })
      
      // With large gap, more players should be in tier 1
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
      expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
    })
  })

  describe('Gap Control', () => {
    it('updates tiers when gap is changed', async () => {
      render(<Tiering {...defaultProps} defaultGap={50} />)
      
      // With larger gap, should create fewer tiers
      const tierElements = screen.getAllByText(/Tier \d+/)
      expect(tierElements.length).toBeLessThan(4)
    })

    it('constrains gap values to valid range', () => {
      render(<Tiering {...defaultProps} defaultGap={100} />)
      
      // Should be constrained to max value of 50
      const gapValue = screen.getByDisplayValue('50')
      expect(gapValue).toBeInTheDocument()
    })
  })

  describe('Tier Change Controls', () => {
    it('shows tier change buttons when onTierChange is provided', async () => {
      render(<Tiering {...defaultProps} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      await user.click(tier1Button!)
      
      const upButtons = screen.getAllByText('↑')
      const downButtons = screen.getAllByText('↓')
      expect(upButtons.length).toBeGreaterThan(0)
      expect(downButtons.length).toBeGreaterThan(0)
    })

    it('hides tier change buttons when onTierChange is not provided', async () => {
      render(<Tiering {...defaultProps} onTierChange={undefined} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      await user.click(tier1Button!)
      
      expect(screen.queryByText('↑')).not.toBeInTheDocument()
      expect(screen.queryByText('↓')).not.toBeInTheDocument()
    })

    it('calls onTierChange when up button is clicked', async () => {
      render(<Tiering {...defaultProps} />)
      
      const tier2Button = screen.getByText('Tier 2').closest('button')
      await user.click(tier2Button!)
      
      // Wait for the tier to expand
      await waitFor(() => {
        expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument()
      })
      
      const upButton = screen.getAllByText('↑')[0]
      await user.click(upButton)
      
      expect(defaultProps.onTierChange).toHaveBeenCalledWith('3', 1) // Patrick Mahomes is ID 3
    })

    it('calls onTierChange when down button is clicked', async () => {
      render(<Tiering {...defaultProps} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      await user.click(tier1Button!)
      
      const downButton = screen.getAllByText('↓')[0]
      await user.click(downButton)
      
      expect(defaultProps.onTierChange).toHaveBeenCalledWith('1', 2)
    })

    it('disables up button for tier 1 players', async () => {
      render(<Tiering {...defaultProps} />)
      
      const tier1Button = screen.getByText('Tier 1').closest('button')
      await user.click(tier1Button!)
      
      const upButton = screen.getAllByText('↑')[0]
      expect(upButton).toBeDisabled()
    })
  })

  describe('Props Handling', () => {
    it('uses custom default gap', () => {
      render(<Tiering {...defaultProps} defaultGap={25} />)
      
      expect(screen.getByDisplayValue('25')).toBeInTheDocument()
    })

    it('works without onTierChange callback', () => {
      render(<Tiering {...defaultProps} onTierChange={undefined} />)
      
      expect(screen.getByText('Player Tiers')).toBeInTheDocument()
    })

    it('handles empty players array gracefully', () => {
      render(<Tiering {...defaultProps} players={[]} />)
      
      expect(screen.getByText('No players available for tiering')).toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('handles single player correctly', () => {
      render(<Tiering {...defaultProps} players={[mockPlayers[0]]} />)
      
      expect(screen.getByText('Tier 1')).toBeInTheDocument()
      expect(screen.getByText('1 player')).toBeInTheDocument()
    })

    it('handles players with identical fantasy points', () => {
      const identicalPlayers = [
        { ...mockPlayers[0], fantasyPoints: 100 },
        { ...mockPlayers[1], fantasyPoints: 100 },
        { ...mockPlayers[2], fantasyPoints: 100 },
      ]
      
      render(<Tiering {...defaultProps} players={identicalPlayers} />)
      
      expect(screen.getByText('Tier 1')).toBeInTheDocument()
      expect(screen.getByText('3 players')).toBeInTheDocument()
    })

    it('handles very large fantasy point values', () => {
      const largeValuePlayers = mockPlayers.map(player => ({
        ...player,
        fantasyPoints: player.fantasyPoints * 1000,
      }))
      
      render(<Tiering {...defaultProps} players={largeValuePlayers} />)
      
      expect(screen.getByText('Player Tiers')).toBeInTheDocument()
      expect(screen.getAllByText(/pts/)).toHaveLength(6) // 6 players, each with pts
    })
  })

  describe('Accessibility', () => {
    it('has proper labels for controls', () => {
      render(<Tiering {...defaultProps} />)
      
      expect(screen.getByLabelText('Tier Gap:')).toBeInTheDocument()
    })

    it('uses semantic HTML elements', () => {
      render(<Tiering {...defaultProps} />)
      
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
      expect(screen.getByRole('slider')).toBeInTheDocument()
    })

    it('provides helpful information in footer', () => {
      render(<Tiering {...defaultProps} />)
      
      expect(screen.getByText(/Tiers are automatically calculated/)).toBeInTheDocument()
      expect(screen.getByText(/Lower tier numbers indicate higher value/)).toBeInTheDocument()
    })
  })
})
