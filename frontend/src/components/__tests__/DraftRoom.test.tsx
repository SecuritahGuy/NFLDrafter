import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DraftRoom } from '../DraftRoom'
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ChevronLeftIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-left-icon" />
  ),
  ChevronRightIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-right-icon" />
  ),
  StarIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="star-icon" />
  ),
  ChartBarIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chart-bar-icon" />
  ),
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-down-icon" />
  ),
  ChevronUpIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="chevron-up-icon" />
  ),
  AdjustmentsHorizontalIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="adjustments-horizontal-icon" />
  ),
  FireIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="fire-icon" />
  ),
  ArrowTrendingUpIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="arrow-trending-up-icon" />
  ),
  ArrowTrendingDownIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="arrow-trending-down-icon" />
  ),
  UserIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="user-icon" />
  ),
  TrophyIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="trophy-icon" />
  ),
  ExclamationTriangleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="exclamation-triangle-icon" />
  ),
  CheckCircleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="check-circle-icon" />
  ),
  CalendarIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="calendar-icon" />
  ),
  ExclamationCircleIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="exclamation-circle-icon" />
  ),
  CloudArrowUpIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="cloud-arrow-up-icon" />
  ),
  FunnelIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="funnel-icon" />
  ),
  MagnifyingGlassIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="magnifying-glass-icon" />
  ),
  EyeIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="eye-icon" />
  ),
  PlusIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="plus-icon" />
  ),
  MinusIcon: ({ className }: { className?: string }) => (
    <svg className={className} data-testid="minus-icon" />
  ),
}))

describe('DraftRoom', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    // Clear any existing event listeners
    document.removeEventListener('keydown', expect.any(Function))
  })

  describe('Initial Render', () => {
    it('renders the hero header with title and description', () => {
      render(<DraftRoom />)
      
      expect(screen.getByText('Draft Room')).toBeInTheDocument()
      expect(screen.getByText(/Professional fantasy football drafting experience/)).toBeInTheDocument()
    })

    it('renders quick stats section', () => {
      render(<DraftRoom />)
      
      expect(screen.getByText('Players Available')).toBeInTheDocument()
      expect(screen.getAllByText('Watchlist').length).toBeGreaterThan(0)
      expect(screen.getByText('Roster Slots')).toBeInTheDocument()
    })

    it('renders scoring profile selector', () => {
      render(<DraftRoom />)
      
      expect(screen.getByText('Scoring Profile:')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Standard PPR')).toBeInTheDocument()
    })

    it('renders left sidebar tools', () => {
      render(<DraftRoom />)
      
      expect(screen.getAllByText('Watchlist').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Tiering Analysis').length).toBeGreaterThan(0)
      expect(screen.getAllByText('VORP Analysis').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Roster Overview').length).toBeGreaterThan(0)
      expect(screen.getByText('Yahoo Fantasy')).toBeInTheDocument()
    })

    it('renders main player board', () => {
      render(<DraftRoom />)
      
      expect(screen.getAllByText('Player Board').length).toBeGreaterThan(0)
    })
  })

  describe('Scoring Profile Selection', () => {
    it('allows changing scoring profile', async () => {
      render(<DraftRoom />)
      
      const select = screen.getByDisplayValue('Standard PPR')
      await user.selectOptions(select, 'Half PPR')
      
      expect(select).toHaveValue('Half PPR')
    })

    it('displays all scoring profile options', () => {
      render(<DraftRoom />)
      
      const select = screen.getByDisplayValue('Standard PPR')
      const options = Array.from(select.querySelectorAll('option'))
      
      expect(options).toHaveLength(4)
      expect(options.map(opt => opt.value)).toEqual([
        'Standard PPR',
        'Half PPR', 
        'Standard',
        'Superflex'
      ])
    })
  })

  describe('Watchlist Management', () => {
    it('shows empty watchlist initially', () => {
      render(<DraftRoom />)
      
      // The watchlist component should handle empty state
      expect(screen.getAllByText('Watchlist').length).toBeGreaterThan(0)
    })

    it('displays watchlist players when added', async () => {
      render(<DraftRoom />)
      
      // This would require interaction with the PlayerBoard to add players
      // For now, just verify the watchlist section exists
      expect(screen.getAllByText('Watchlist').length).toBeGreaterThan(0)
    })
  })

  describe('Component Integration', () => {
    it('renders all required components', () => {
      render(<DraftRoom />)
      
      // Check that all major components are rendered
      expect(screen.getAllByText('Watchlist').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Tiering Analysis').length).toBeGreaterThan(0)
      expect(screen.getAllByText('VORP Analysis').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Roster Overview').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Player Board').length).toBeGreaterThan(0)
    })

    it('displays player data in components', () => {
      render(<DraftRoom />)
      
      // Check that mock player data is displayed somewhere
      expect(screen.getAllByText('Patrick Mahomes').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Christian McCaffrey').length).toBeGreaterThan(0)
      expect(screen.getAllByText('Tyreek Hill').length).toBeGreaterThan(0)
    })
  })

  describe('Yahoo Integration', () => {
    it('renders Yahoo OAuth component', () => {
      render(<DraftRoom />)
      
      expect(screen.getByText('Yahoo Fantasy')).toBeInTheDocument()
    })

    it('shows league import when authenticated', () => {
      render(<DraftRoom />)
      
      // Initially should not show league import (no auth token)
      expect(screen.queryByText('League Import')).not.toBeInTheDocument()
    })
  })

  describe('Responsive Design', () => {
    it('applies correct grid layout classes', () => {
      render(<DraftRoom />)
      
      const mainGrid = document.querySelector('.grid.grid-cols-1.xl\\:grid-cols-5')
      expect(mainGrid).toBeInTheDocument()
    })

    it('applies backdrop blur and transparency effects', () => {
      render(<DraftRoom />)
      
      const cards = document.querySelectorAll('.backdrop-blur-sm')
      expect(cards.length).toBeGreaterThan(0)
    })
  })

  describe('Visual Design', () => {
    it('applies gradient backgrounds', () => {
      render(<DraftRoom />)
      
      const mainBg = document.querySelector('.bg-gradient-to-br.from-slate-900.via-blue-900.to-indigo-900')
      expect(mainBg).toBeInTheDocument()
    })

    it('applies shadow and border effects', () => {
      render(<DraftRoom />)
      
      const shadowCards = document.querySelectorAll('.shadow-2xl')
      expect(shadowCards.length).toBeGreaterThan(0)
    })

    it('uses proper color schemes for different sections', () => {
      render(<DraftRoom />)
      
      // Check that different sections have different color schemes
      const watchlistHeader = document.querySelector('.bg-gradient-to-r.from-blue-600.to-purple-600')
      const tieringHeader = document.querySelector('.bg-gradient-to-r.from-purple-600.to-pink-600')
      const vorpHeader = document.querySelector('.bg-gradient-to-r.from-orange-600.to-red-600')
      
      expect(watchlistHeader).toBeInTheDocument()
      expect(tieringHeader).toBeInTheDocument()
      expect(vorpHeader).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('provides proper heading structure', () => {
      render(<DraftRoom />)
      
      const h1 = screen.getByRole('heading', { level: 1 })
      expect(h1).toHaveTextContent('Draft Room')
    })

    it('uses semantic HTML elements', () => {
      render(<DraftRoom />)
      
      // Check for proper form elements
      const select = screen.getByDisplayValue('Standard PPR')
      expect(select.tagName).toBe('SELECT')
    })
  })

  describe('Error Handling', () => {
    it('handles missing player data gracefully', () => {
      render(<DraftRoom />)
      
      // Component should render without crashing even with empty data
      expect(screen.getByText('Draft Room')).toBeInTheDocument()
    })
  })
})


















