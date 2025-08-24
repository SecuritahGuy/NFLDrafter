import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PlayerDrawer } from '../PlayerDrawer';
import type { PlayerNews, WeeklyStats, DepthChartPosition } from '../PlayerDrawer';

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  XMarkIcon: ({ className }: { className?: string }) => (
    <div data-testid="x-mark-icon" className={className} />
  ),
  ChartBarIcon: ({ className }: { className?: string }) => (
    <div data-testid="chart-bar-icon" className={className} />
  ),
  NewspaperIcon: ({ className }: { className?: string }) => (
    <div data-testid="newspaper-icon" className={className} />
  ),
  UserGroupIcon: ({ className }: { className?: string }) => (
    <div data-testid="user-group-icon" className={className} />
  ),
  PencilIcon: ({ className }: { className?: string }) => (
    <div data-testid="pencil-icon" className={className} />
  ),
}));

const mockPlayer = {
  id: '1',
  name: 'Patrick Mahomes',
  position: 'QB',
  team: 'KC',
  fantasyPoints: 350.5,
  yahooPoints: 345.2,
  delta: 5.3,
  vorp: 45.2,
  tier: 1,
  adp: 12,
  newsCount: 3,
  byeWeek: 10,
  effectiveADP: 12,
  valueVsADP: null,
};

const mockWeeklyStats: WeeklyStats[] = [
  { week: 1, fantasyPoints: 25.3, passingYards: 300, rushingYards: 25, touchdowns: 3, interceptions: 0 },
  { week: 2, fantasyPoints: 18.7, passingYards: 250, rushingYards: 15, touchdowns: 2, interceptions: 1 },
  { week: 3, fantasyPoints: 32.1, passingYards: 400, rushingYards: 30, touchdowns: 4, interceptions: 0 },
  { week: 4, fantasyPoints: 15.2, passingYards: 200, rushingYards: 10, touchdowns: 1, interceptions: 2 },
];

const mockNews: PlayerNews[] = [
  {
    id: '1',
    title: 'Mahomes Leads Chiefs to Victory',
    summary: 'Patrick Mahomes threw for 300 yards and 3 touchdowns in a dominant performance.',
    source: 'ESPN',
    publishedAt: '2024-01-15T10:00:00Z',
    url: 'https://espn.com/news/1',
  },
  {
    id: '2',
    title: 'Mahomes Named AFC Player of the Week',
    summary: 'Chiefs quarterback earns weekly honors after stellar performance.',
    source: 'NFL.com',
    publishedAt: '2024-01-14T15:30:00Z',
    url: 'https://nfl.com/news/2',
  },
  {
    id: '3',
    title: 'Chiefs Offense Firing on All Cylinders',
    summary: 'Kansas City offense looks unstoppable with Mahomes at the helm.',
    source: 'CBS Sports',
    publishedAt: '2024-01-13T12:00:00Z',
    url: 'https://cbssports.com/news/3',
  },
];

const mockDepthChart: DepthChartPosition[] = [
  { rank: 1, playerName: 'Patrick Mahomes', status: 'starter' },
  { rank: 2, playerName: 'Blaine Gabbert', status: 'backup' },
  { rank: 3, playerName: 'Shane Buechele', status: 'practice_squad' },
];

const defaultProps = {
  player: mockPlayer,
  isOpen: true,
  onClose: vi.fn(),
  weeklyStats: mockWeeklyStats,
  news: mockNews,
  depthChart: mockDepthChart,
  notes: 'Elite QB with great weapons. High floor, high ceiling.',
  onNotesChange: vi.fn(),
};

describe('PlayerDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when player is null', () => {
      const { container } = render(<PlayerDrawer {...defaultProps} player={null} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders drawer when open', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('Patrick Mahomes', { selector: 'h2' })).toBeInTheDocument();
      expect(screen.getByText('KC • QB')).toBeInTheDocument();
      expect(screen.getByText('Key Stats')).toBeInTheDocument();
    });

    it('does not render drawer when closed', () => {
      render(<PlayerDrawer {...defaultProps} isOpen={false} />);
      
      // When closed, the drawer should still be in DOM but with translate-x-full class
      const drawer = screen.getByText('Patrick Mahomes', { selector: 'h2' }).closest('div[class*="translate-x-full"]');
      expect(drawer).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(<PlayerDrawer {...defaultProps} className="custom-class" />);
      
      const drawer = container.querySelector('.custom-class');
      expect(drawer).toBeInTheDocument();
    });
  });

  describe('Header', () => {
    it('displays player information correctly', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('Patrick Mahomes', { selector: 'h2' })).toBeInTheDocument();
      expect(screen.getByText('KC • QB')).toBeInTheDocument();
      expect(screen.getByText('QB')).toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<PlayerDrawer {...defaultProps} />);
      
      const closeButton = screen.getByTestId('x-mark-icon').parentElement;
      await user.click(closeButton!);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when backdrop is clicked', async () => {
      const user = userEvent.setup();
      render(<PlayerDrawer {...defaultProps} />);
      
      // Find the backdrop by looking for the fixed inset-0 div with specific classes
      const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50');
      expect(backdrop).toBeInTheDocument();
      
      await user.click(backdrop!);
      
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Key Stats', () => {
    it('displays all key stats correctly', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('350.5')).toBeInTheDocument(); // My Points
      expect(screen.getByText('345.2')).toBeInTheDocument(); // Yahoo Points
      expect(screen.getByText('45.2')).toBeInTheDocument(); // VORP
      expect(screen.getByText('1', { selector: 'p.text-lg.font-semibold.text-gray-900' })).toBeInTheDocument(); // Tier
      expect(screen.getByText('#12')).toBeInTheDocument(); // ADP
      expect(screen.getByText('W10')).toBeInTheDocument(); // Bye Week
    });

    it('displays Value vs ADP when available', () => {
      const playerWithValue = {
        ...mockPlayer,
        valueVsADP: {
          value: 2.5,
          isValue: true,
          percentage: '20.8'
        }
      };
      
      render(<PlayerDrawer {...defaultProps} player={playerWithValue} />);
      
      expect(screen.getByText('Value vs ADP')).toBeInTheDocument();
      expect(screen.getByText('+2.5 (20.8%)')).toBeInTheDocument();
    });

    it('shows dash for missing stats', () => {
      const playerWithMissingStats = {
        ...mockPlayer,
        fantasyPoints: undefined,
        vorp: undefined,
        tier: undefined,
      };
      
      render(<PlayerDrawer {...defaultProps} player={playerWithMissingStats} />);
      
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThan(0);
    });
  });

  describe('Weekly Sparkline', () => {
    it('displays weekly performance section when stats are available', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('Weekly Performance')).toBeInTheDocument();
      // Check that week labels are rendered in the sparkline section
      const weekLabels = screen.getAllByText(/Week \d+/);
      expect(weekLabels.length).toBeGreaterThan(0);
    });

    it('does not display weekly performance when no stats', () => {
      render(<PlayerDrawer {...defaultProps} weeklyStats={[]} />);
      
      expect(screen.queryByText('Weekly Performance')).not.toBeInTheDocument();
    });

    it('displays position-specific stats for QB', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('Latest Week Stats')).toBeInTheDocument();
      expect(screen.getByText('passing:')).toBeInTheDocument();
      expect(screen.getByText('rushing:')).toBeInTheDocument();
      expect(screen.getByText('touchdowns:')).toBeInTheDocument();
      expect(screen.getByText('interceptions:')).toBeInTheDocument();
    });

    it('displays position-specific stats for RB', () => {
      const rbPlayer = { ...mockPlayer, position: 'RB' };
      const rbStats = mockWeeklyStats.map(stat => ({
        ...stat,
        rushingYards: stat.rushingYards || 0,
        receivingYards: 15,
      }));
      
      render(<PlayerDrawer {...defaultProps} player={rbPlayer} weeklyStats={rbStats} />);
      
      expect(screen.getByText('rushing:')).toBeInTheDocument();
      expect(screen.getByText('receiving:')).toBeInTheDocument();
      expect(screen.getByText('touchdowns:')).toBeInTheDocument();
      expect(screen.getByText('fumbles:')).toBeInTheDocument();
    });

    it('displays position-specific stats for WR', () => {
      const wrPlayer = { ...mockPlayer, position: 'WR' };
      const wrStats = mockWeeklyStats.map(stat => ({
        ...stat,
        receivingYards: 80,
      }));
      
      render(<PlayerDrawer {...defaultProps} player={wrPlayer} weeklyStats={wrStats} />);
      
      expect(screen.getByText('receiving:')).toBeInTheDocument();
      expect(screen.getByText('touchdowns:')).toBeInTheDocument();
      expect(screen.getByText('fumbles:')).toBeInTheDocument();
    });
  });

  describe('Recent News', () => {
    it('displays news section when news are available', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('Recent News')).toBeInTheDocument();
      expect(screen.getByText('(3 items)')).toBeInTheDocument();
    });

    it('displays news items correctly', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('Mahomes Leads Chiefs to Victory')).toBeInTheDocument();
      expect(screen.getByText('Patrick Mahomes threw for 300 yards and 3 touchdowns in a dominant performance.')).toBeInTheDocument();
      expect(screen.getByText('ESPN')).toBeInTheDocument();
    });

    it('limits news to 7 items', () => {
      const manyNews = Array.from({ length: 10 }, (_, i) => ({
        id: `${i + 1}`,
        title: `News ${i + 1}`,
        summary: `Summary ${i + 1}`,
        source: 'Source',
        publishedAt: '2024-01-15T10:00:00Z',
        url: `https://example.com/${i + 1}`,
      }));
      
      render(<PlayerDrawer {...defaultProps} news={manyNews} />);
      
      expect(screen.getByText('(10 items)')).toBeInTheDocument();
      expect(screen.getByText('News 1')).toBeInTheDocument();
      expect(screen.getByText('News 7')).toBeInTheDocument();
      expect(screen.queryByText('News 8')).not.toBeInTheDocument();
    });

    it('does not display news section when no news', () => {
      render(<PlayerDrawer {...defaultProps} news={[]} />);
      
      expect(screen.queryByText('Recent News')).not.toBeInTheDocument();
    });

    it('opens news links in new tab', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      const newsLinks = screen.getAllByText('Read More →');
      newsLinks.forEach(link => {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      });
    });
  });

  describe('Depth Chart', () => {
    it('displays depth chart section when available', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('Depth Chart')).toBeInTheDocument();
    });

    it('displays depth chart positions correctly', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      // Check depth chart section specifically
      const depthChartSection = screen.getByText('Depth Chart').closest('div');
      expect(depthChartSection).toBeInTheDocument();
      
      // Check that depth chart players are rendered
      expect(screen.getByText('Blaine Gabbert')).toBeInTheDocument();
      expect(screen.getByText('Shane Buechele')).toBeInTheDocument();
    });

    it('applies correct status colors', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      // Check that status badges are rendered
      expect(screen.getByText('starter')).toBeInTheDocument();
      expect(screen.getByText('backup')).toBeInTheDocument();
      expect(screen.getByText('practice squad')).toBeInTheDocument();
    });

    it('does not display depth chart section when empty', () => {
      render(<PlayerDrawer {...defaultProps} depthChart={[]} />);
      
      expect(screen.queryByText('Depth Chart')).not.toBeInTheDocument();
    });
  });

  describe('Notes', () => {
    it('displays notes section', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      expect(screen.getByText('Notes')).toBeInTheDocument();
      expect(screen.getByText('Elite QB with great weapons. High floor, high ceiling.')).toBeInTheDocument();
    });

    it('shows placeholder when no notes', () => {
      render(<PlayerDrawer {...defaultProps} notes="" />);
      
      expect(screen.getByText('No notes yet. Click edit to add your thoughts about this player.')).toBeInTheDocument();
    });

    it('enters edit mode when edit button is clicked', async () => {
      const user = userEvent.setup();
      render(<PlayerDrawer {...defaultProps} />);
      
      const editButton = screen.getByText('Edit');
      await user.click(editButton);
      
      expect(screen.getByDisplayValue('Elite QB with great weapons. High floor, high ceiling.')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('saves notes when save button is clicked', async () => {
      const user = userEvent.setup();
      render(<PlayerDrawer {...defaultProps} />);
      
      // Enter edit mode
      const editButton = screen.getByText('Edit');
      await user.click(editButton);
      
      // Edit notes
      const textarea = screen.getByDisplayValue('Elite QB with great weapons. High floor, high ceiling.');
      await user.clear(textarea);
      await user.type(textarea, 'Updated notes about Mahomes');
      
      // Save
      const saveButton = screen.getByText('Save');
      await user.click(saveButton);
      
      expect(defaultProps.onNotesChange).toHaveBeenCalledWith('Updated notes about Mahomes');
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('cancels notes editing when cancel button is clicked', async () => {
      const user = userEvent.setup();
      render(<PlayerDrawer {...defaultProps} />);
      
      // Enter edit mode
      const editButton = screen.getByText('Edit');
      await user.click(editButton);
      
      // Edit notes
      const textarea = screen.getByDisplayValue('Elite QB with great weapons. High floor, high ceiling.');
      await user.clear(textarea);
      await user.type(textarea, 'This should not be saved');
      
      // Cancel
      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);
      
      expect(defaultProps.onNotesChange).not.toHaveBeenCalled();
      expect(screen.getByText('Elite QB with great weapons. High floor, high ceiling.')).toBeInTheDocument();
      expect(screen.queryByText('Save')).not.toBeInTheDocument();
    });

    it('does not show edit button when onNotesChange is not provided', () => {
      render(<PlayerDrawer {...defaultProps} onNotesChange={undefined} />);
      
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('provides proper button titles and labels', () => {
      render(<PlayerDrawer {...defaultProps} />);
      
      const closeButton = screen.getByTestId('x-mark-icon').parentElement;
      expect(closeButton).toHaveAttribute('aria-label', 'Close');
    });

    it('supports keyboard navigation', async () => {
      const user = userEvent.setup();
      render(<PlayerDrawer {...defaultProps} />);
      
      // Test tab navigation
      await user.tab();
      // Should focus on close button
      expect(screen.getByTestId('x-mark-icon').parentElement).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles missing weekly stats gracefully', () => {
      render(<PlayerDrawer {...defaultProps} weeklyStats={[]} />);
      
      expect(screen.queryByText('Weekly Performance')).not.toBeInTheDocument();
    });

    it('handles missing news gracefully', () => {
      render(<PlayerDrawer {...defaultProps} news={[]} />);
      
      expect(screen.queryByText('Recent News')).not.toBeInTheDocument();
    });

    it('handles missing depth chart gracefully', () => {
      render(<PlayerDrawer {...defaultProps} depthChart={[]} />);
      
      expect(screen.queryByText('Depth Chart')).not.toBeInTheDocument();
    });

    it('handles player with minimal data', () => {
      const minimalPlayer = {
        id: '1',
        name: 'Test Player',
        position: 'RB',
        team: 'TEST',
      };
      
      render(<PlayerDrawer {...defaultProps} player={minimalPlayer} />);
      
      expect(screen.getByText('Test Player')).toBeInTheDocument();
      expect(screen.getByText('TEST • RB')).toBeInTheDocument();
    });
  });
});
