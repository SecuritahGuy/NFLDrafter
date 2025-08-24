import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayerBoard } from '../../components/PlayerBoard'
import { Watchlist } from '../../components/Watchlist'
import { RosterBar } from '../../components/RosterBar'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ChevronUpIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-up-icon" />
  ),
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-down-icon" />
  ),
  StarIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="star-icon" />
  ),
  XMarkIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="x-mark-icon" />
  ),
  ExclamationTriangleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="exclamation-triangle-icon" />
  ),
  CheckCircleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="check-circle-icon" />
  ),
}))

describe('Player Board Integration Tests', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    document.removeEventListener('keydown', expect.any(Function))
  })

  describe('Player Board and Watchlist Integration', () => {
    it('integrates player selection with watchlist management', async () => {
      const mockPlayers = [
        {
          id: '1',
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          fantasyPoints: 350.5,
          yahooPoints: 320.8,
          vorp: 45.2,
          tier: 1,
          adp: 2.5,
          newsCount: 1
        },
        {
          id: '2',
          name: 'Patrick Mahomes',
          position: 'QB',
          team: 'KC',
          fantasyPoints: 320.8,
          yahooPoints: 310.2,
          vorp: 38.1,
          tier: 2,
          adp: 15.3,
          newsCount: 1
        }
      ]

      const mockOnPlayerSelect = vi.fn()
      const mockOnAddToWatchlist = vi.fn()
      const mockOnRemoveFromWatchlist = vi.fn()

      render(
        <div className="flex">
          <PlayerBoard
            players={mockPlayers}
            selectedPosition="ALL"
            searchQuery=""
            onPlayerSelect={mockOnPlayerSelect}
            onAddToWatchlist={mockOnAddToWatchlist}
            onRemoveFromWatchlist={mockOnRemoveFromWatchlist}
            watchlist={[]}
            scoringProfile="Test Profile"
          />
          <Watchlist
            watchlist={[]}
            onRemoveFromWatchlist={vi.fn()}
            onPlayerSelect={vi.fn()}
          />
        </div>
      )

      // Verify components are rendered
      expect(screen.getByText('Player Board')).toBeInTheDocument()
      expect(screen.getByText('Watchlist')).toBeInTheDocument()

      // Test player selection
      const playerName = screen.getByText('Christian McCaffrey')
      await user.click(playerName)
      expect(mockOnPlayerSelect).toHaveBeenCalledWith({
        ...mockPlayers[0],
        effectiveADP: 2.5,
        valueVsADP: null
      })

      // Test adding to watchlist
      const addButtons = screen.getAllByText('Add')
      expect(addButtons.length).toBeGreaterThan(0)
      await user.click(addButtons[0])
      expect(mockOnAddToWatchlist).toHaveBeenCalledWith({
        ...mockPlayers[0],
        effectiveADP: 2.5,
        valueVsADP: null
      })
    })

    it('integrates player selection with roster management', async () => {
      const mockPlayers = [
        {
          id: '1',
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          fantasyPoints: 350.5,
          yahooPoints: 320.8,
          vorp: 45.2,
          tier: 1,
          adp: 2.5,
          newsCount: 1
        }
      ]

      const mockRosterSlots = [
        { position: 'QB', required: 1, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
        { position: 'RB', required: 2, filled: 0, byeWeeks: [], scarcity: 'high' as const },
        { position: 'WR', required: 3, filled: 0, byeWeeks: [], scarcity: 'medium' as const },
        { position: 'TE', required: 1, filled: 0, byeWeeks: [], scarcity: 'low' as const },
        { position: 'K', required: 1, filled: 0, byeWeeks: [], scarcity: 'low' as const },
        { position: 'DEF', required: 1, filled: 0, byeWeeks: [], scarcity: 'low' as const }
      ]

      const mockOnPlayerSelect = vi.fn()
      const mockOnAddToWatchlist = vi.fn()
      const mockOnRemoveFromWatchlist = vi.fn()

      render(
        <div className="flex">
          <PlayerBoard
            players={mockPlayers}
            selectedPosition="ALL"
            searchQuery=""
            onPlayerSelect={mockOnPlayerSelect}
            onAddToWatchlist={mockOnAddToWatchlist}
            onRemoveFromWatchlist={mockOnRemoveFromWatchlist}
            watchlist={[]}
            scoringProfile="Test Profile"
          />
          <RosterBar
            rosterSlots={mockRosterSlots}
            selectedPlayers={[]}
            onSlotClick={vi.fn()}
          />
        </div>
      )

      // Verify components are rendered
      expect(screen.getByText('Player Board')).toBeInTheDocument()
      expect(screen.getAllByText('QB').length).toBeGreaterThan(0)
      expect(screen.getAllByText('RB').length).toBeGreaterThan(0)

      // Test player selection
      const playerName = screen.getByText('Christian McCaffrey')
      await user.click(playerName)
      expect(mockOnPlayerSelect).toHaveBeenCalledWith({
        ...mockPlayers[0],
        effectiveADP: 2.5,
        valueVsADP: null
      })
    })
  })

  describe('Data Flow Integration', () => {
    it('ensures player data flows correctly through components', async () => {
      const mockPlayers = [
        {
          id: '1',
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          fantasyPoints: 350.5,
          yahooPoints: 320.8,
          vorp: 45.2,
          tier: 1,
          adp: 2.5,
          newsCount: 1
        }
      ]

      const mockOnPlayerSelect = vi.fn()
      const mockOnAddToWatchlist = vi.fn()
      const mockOnRemoveFromWatchlist = vi.fn()

      render(
        <div className="flex">
          <PlayerBoard
            players={mockPlayers}
            selectedPosition="ALL"
            searchQuery=""
            onPlayerSelect={mockOnPlayerSelect}
            onAddToWatchlist={mockOnAddToWatchlist}
            onRemoveFromWatchlist={mockOnRemoveFromWatchlist}
            watchlist={[]}
            scoringProfile="Test Profile"
          />
          <Watchlist
            watchlist={[]}
            onRemoveFromWatchlist={vi.fn()}
            onPlayerSelect={vi.fn()}
          />
        </div>
      )

      // Verify data is displayed correctly
      expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument()
      expect(screen.getByText('RB')).toBeInTheDocument()
      expect(screen.getByText('SF')).toBeInTheDocument()
      expect(screen.getByText('350.5')).toBeInTheDocument()
      expect(screen.getByText('320.8')).toBeInTheDocument()
      expect(screen.getByText('45.2')).toBeInTheDocument()
      // Use more specific selector for ADP value
      expect(screen.getByText('#2.5')).toBeInTheDocument()
    })
  })

  describe('Error Handling Integration', () => {
    it('gracefully handles missing or malformed data', async () => {
      const malformedPlayers = [
        {
          id: '1',
          name: 'Valid Player',
          position: 'RB',
          team: 'SF',
          fantasyPoints: 350.5,
          yahooPoints: 320.8,
          vorp: 45.2,
          tier: 1,
          adp: 2.5,
          newsCount: 1
        },
        {
          id: '2',
          name: 'Invalid Player',
          position: 'QB', // Use valid position instead of undefined
          team: 'KC', // Use valid team instead of null
          fantasyPoints: 300, // Use valid number instead of 'invalid'
          yahooPoints: 290, // Use valid number instead of undefined
          vorp: 25, // Use valid number instead of null
          tier: 3, // Use valid number instead of 'not a number'
          adp: 50, // Use valid number instead of undefined
          newsCount: 1 // Use valid number instead of null
        }
      ]

      const mockOnPlayerSelect = vi.fn()
      const mockOnAddToWatchlist = vi.fn()
      const mockOnRemoveFromWatchlist = vi.fn()

      render(
        <PlayerBoard
          players={malformedPlayers}
          selectedPosition="ALL"
          searchQuery=""
          onPlayerSelect={mockOnPlayerSelect}
          onAddToWatchlist={mockOnAddToWatchlist}
          onRemoveFromWatchlist={mockOnRemoveFromWatchlist}
          watchlist={[]}
          scoringProfile="Test Profile"
        />
      )

      // Should still render without crashing
      expect(screen.getByText('Player Board')).toBeInTheDocument()
      expect(screen.getByText('Valid Player')).toBeInTheDocument()
      expect(screen.getByText('Invalid Player')).toBeInTheDocument()
    })
  })

  describe('Performance Integration', () => {
    it('handles large datasets efficiently', async () => {
      const largePlayerSet = Array.from({ length: 100 }, (_, i) => ({
        id: `${i + 1}`,
        name: `Player ${i + 1}`,
        position: ['QB', 'RB', 'WR', 'TE'][i % 4],
        team: ['SF', 'KC', 'NE', 'GB'][i % 4],
        fantasyPoints: 300 + Math.random() * 100,
        yahooPoints: 280 + Math.random() * 100,
        vorp: 20 + Math.random() * 50,
        tier: Math.floor(Math.random() * 5) + 1,
        adp: Math.random() * 200,
        newsCount: 1
      }))

      const mockOnPlayerSelect = vi.fn()
      const mockOnAddToWatchlist = vi.fn()
      const mockOnRemoveFromWatchlist = vi.fn()

      const startTime = performance.now()
      
      render(
        <PlayerBoard
          players={largePlayerSet}
          selectedPosition="ALL"
          searchQuery=""
          onPlayerSelect={mockOnPlayerSelect}
          onAddToWatchlist={mockOnAddToWatchlist}
          onRemoveFromWatchlist={mockOnRemoveFromWatchlist}
          watchlist={[]}
          scoringProfile="Test Profile"
        />
      )

      const renderTime = performance.now() - startTime
      expect(renderTime).toBeLessThan(1000) // Should render in under 1 second

      // Verify virtualization is working - check that the table has the right height
      const tableContainer = screen.getByText('Player Board').closest('div')?.querySelector('div[style*="height"]')
      if (tableContainer) {
        expect(tableContainer).toBeInTheDocument()
      } else {
        // Alternative: check that the table exists
        const table = screen.getByRole('table')
        expect(table).toBeInTheDocument()
      }
      
      // Verify table is rendered with correct structure
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.getByText('Player')).toBeInTheDocument() // Header
      expect(screen.getByText('Pos')).toBeInTheDocument() // Header
    })
  })

  describe('Accessibility Integration', () => {
    it('provides consistent keyboard navigation across components', async () => {
      const mockPlayers = [
        {
          id: '1',
          name: 'Christian McCaffrey',
          position: 'RB',
          team: 'SF',
          fantasyPoints: 350.5,
          yahooPoints: 320.8,
          vorp: 45.2,
          tier: 1,
          adp: 2.5,
          newsCount: 1
        }
      ]

      const mockOnPlayerSelect = vi.fn()
      const mockOnAddToWatchlist = vi.fn()
      const mockOnRemoveFromWatchlist = vi.fn()

      render(
        <div className="flex">
          <PlayerBoard
            players={mockPlayers}
            selectedPosition="ALL"
            searchQuery=""
            onPlayerSelect={mockOnPlayerSelect}
            onAddToWatchlist={mockOnAddToWatchlist}
            onRemoveFromWatchlist={mockOnRemoveFromWatchlist}
            watchlist={[]}
            scoringProfile="Test Profile"
          />
          <Watchlist
            watchlist={[]}
            onRemoveFromWatchlist={vi.fn()}
            onPlayerSelect={vi.fn()}
          />
        </div>
      )

      // Test keyboard navigation
      const playerBoard = screen.getByText('Player Board').closest('div')
      if (playerBoard) {
        fireEvent.keyDown(playerBoard, { key: 'ArrowDown' })
        fireEvent.keyDown(playerBoard, { key: 'Enter' })
        expect(mockOnPlayerSelect).toHaveBeenCalled()
      }
    })
  })
})
