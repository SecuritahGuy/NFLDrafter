import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { PlayerBoard } from '../PlayerBoard';
import type { Player } from '../PlayerBoard';

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  ChevronUpIcon: ({ className }: { className?: string }) => (
    <div data-testid="chevron-up-icon" className={className} />
  ),
  ChevronDownIcon: ({ className }: { className?: string }) => (
    <div data-testid="chevron-down-icon" className={className} />
  ),
}));

// Mock ADPImport component
vi.mock('../ADPImport', () => ({
  ADPImport: ({ onADPImport, currentADP }: { onADPImport: (data: any) => void; currentADP: Record<string, number> }) => (
    <div data-testid="adp-import">
      <div>ADP Import Component</div>
      <button onClick={() => onADPImport([
        { player_name: 'Patrick Mahomes', adp: 1.5, team: 'KC', position: 'QB' },
        { player_name: 'Christian McCaffrey', adp: 2.1, team: 'SF', position: 'RB' }
      ])}>
        Import Test ADP
      </button>
      <div>Current ADP: {JSON.stringify(currentADP)}</div>
    </div>
  ),
}));

const mockPlayers: Player[] = [
  {
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
  },
  {
    id: '2',
    name: 'Christian McCaffrey',
    position: 'RB',
    team: 'SF',
    fantasyPoints: 398.5,
    yahooPoints: 395.1,
    delta: 3.4,
    vorp: 68.7,
    tier: 1,
    adp: 8,
    newsCount: 5,
    byeWeek: 13,
  },
];

const defaultProps = {
  players: mockPlayers,
  selectedPosition: 'ALL',
  searchQuery: '',
  onPlayerSelect: vi.fn(),
  onAddToWatchlist: vi.fn(),
  onRemoveFromWatchlist: vi.fn(),
  watchlist: [],
  scoringProfile: 'Standard PPR',
};

describe('PlayerBoard with ADP Import', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ADP Import Button', () => {
    it('shows Import ADP button when onADPImport is provided', () => {
      render(<PlayerBoard {...defaultProps} onADPImport={vi.fn()} />);
      
      expect(screen.getByText('Import ADP')).toBeInTheDocument();
    });

    it('does not show Import ADP button when onADPImport is not provided', () => {
      render(<PlayerBoard {...defaultProps} />);
      
      expect(screen.queryByText('Import ADP')).not.toBeInTheDocument();
    });
  });

  describe('ADP Import Modal', () => {
    it('opens ADP import modal when Import ADP button is clicked', async () => {
      const user = userEvent.setup();
      render(<PlayerBoard {...defaultProps} onADPImport={vi.fn()} />);
      
      const importButton = screen.getByText('Import ADP');
      await user.click(importButton);
      
      expect(screen.getByText('Import ADP Data')).toBeInTheDocument();
      expect(screen.getByTestId('adp-import')).toBeInTheDocument();
    });

    it('closes ADP import modal when close button is clicked', async () => {
      const user = userEvent.setup();
      render(<PlayerBoard {...defaultProps} onADPImport={vi.fn()} />);
      
      // Open modal
      const importButton = screen.getByText('Import ADP');
      await user.click(importButton);
      
      // Close modal - use the first chevron icon (modal close button)
      const closeButtons = screen.getAllByTestId('chevron-up-icon');
      const modalCloseButton = closeButtons[0]; // First one is the modal close button
      await user.click(modalCloseButton);
      
      expect(screen.queryByText('Import ADP Data')).not.toBeInTheDocument();
    });
  });

  describe('ADP Data Integration', () => {
    it('displays imported ADP data in the table', async () => {
      const mockOnADPImport = vi.fn();
      const user = userEvent.setup();
      
      render(<PlayerBoard {...defaultProps} onADPImport={mockOnADPImport} />);
      
      // Open ADP import modal
      const importButton = screen.getByText('Import ADP');
      await user.click(importButton);
      
      // Import test ADP data
      const importTestButton = screen.getByText('Import Test ADP');
      await user.click(importTestButton);
      
      // Check that onADPImport was called
      expect(mockOnADPImport).toHaveBeenCalledWith([
        { player_name: 'Patrick Mahomes', adp: 1.5, team: 'KC', position: 'QB' },
        { player_name: 'Christian McCaffrey', adp: 2.1, team: 'SF', position: 'RB' }
      ]);
    });

    it('shows effective ADP (imported or default) in ADP column', () => {
      const importedADP = {
        'Patrick Mahomes': 1.5,
        'Christian McCaffrey': 2.1
      };
      
      render(<PlayerBoard {...defaultProps} importedADP={importedADP} />);
      
      // Should show imported ADP values
      expect(screen.getByText('#1.5')).toBeInTheDocument();
      expect(screen.getByText('#2.1')).toBeInTheDocument();
      
      // Should show import indicator
      expect(screen.getAllByText('📊')).toHaveLength(2);
    });

    it('shows default ADP when no imported data exists', () => {
      render(<PlayerBoard {...defaultProps} />);
      
      // Should show default ADP values
      expect(screen.getByText('#12')).toBeInTheDocument();
      expect(screen.getByText('#8')).toBeInTheDocument();
      
      // Should not show import indicator
      expect(screen.queryByText('📊')).not.toBeInTheDocument();
    });
  });

  describe('Value vs ADP Column', () => {
    it('displays Value vs ADP column in table headers', () => {
      render(<PlayerBoard {...defaultProps} />);
      
      expect(screen.getByText('Value vs ADP')).toBeInTheDocument();
    });

    it('calculates and displays Value vs ADP correctly', () => {
      const importedADP = {
        'Patrick Mahomes': 1.5, // Imported ADP: 1.5, Default ADP: 12
        'Christian McCaffrey': 2.1 // Imported ADP: 2.1, Default ADP: 8
      };
      
      render(<PlayerBoard {...defaultProps} importedADP={importedADP} />);
      
      // Mahomes: 1.5 - 12 = -10.5 (overvalued)
      expect(screen.getByText(/-10\.5.*-87\.5%/)).toBeInTheDocument();
      
      // McCaffrey: 2.1 - 8 = -5.9 (overvalued)
      expect(screen.getByText(/-5\.9.*-73\.8%/)).toBeInTheDocument();
    });

    it('shows dash when no Value vs ADP calculation is possible', () => {
      render(<PlayerBoard {...defaultProps} />);
      
      // Should show dashes for Value vs ADP when no imported ADP exists
      const dashes = screen.getAllByText('-');
      expect(dashes.length).toBeGreaterThanOrEqual(2); // At least 2 dashes (Value vs ADP column)
    });

    it('supports sorting by Value vs ADP', async () => {
      const importedADP = {
        'Patrick Mahomes': 1.5,
        'Christian McCaffrey': 2.1
      };
      
      const user = userEvent.setup();
      render(<PlayerBoard {...defaultProps} importedADP={importedADP} />);
      
      // Click on Value vs ADP header to sort
      const valueVsADPHeader = screen.getByText('Value vs ADP');
      await user.click(valueVsADPHeader);
      
      // Should show sort indicator
      expect(screen.getByTestId('chevron-down-icon')).toBeInTheDocument();
    });
  });

  describe('Enhanced Player Details', () => {
    it('shows effective ADP in expanded player details', async () => {
      const importedADP = { 'Patrick Mahomes': 1.5 };
      const user = userEvent.setup();
      
      render(<PlayerBoard {...defaultProps} importedADP={importedADP} />);
      
      // Expand first player
      const expandButton = screen.getByTestId('expand-button-1');
      await user.click(expandButton);
      
      // Should show effective ADP
      expect(screen.getByText('ADP: #1.5')).toBeInTheDocument();
    });

    it('shows Value vs ADP in expanded player details when available', async () => {
      const importedADP = { 'Patrick Mahomes': 1.5 };
      const user = userEvent.setup();
      
      render(<PlayerBoard {...defaultProps} importedADP={importedADP} />);
      
      // Expand first player
      const expandButton = screen.getByTestId('expand-button-1');
      await user.click(expandButton);
      
      // Should show Value vs ADP calculation
      expect(screen.getByText(/Value vs ADP: -10\.5/)).toBeInTheDocument();
    });
  });

  describe('ADP Import Workflow', () => {
    it('completes full ADP import workflow', async () => {
      const mockOnADPImport = vi.fn();
      const user = userEvent.setup();
      
      render(<PlayerBoard {...defaultProps} onADPImport={mockOnADPImport} />);
      
      // 1. Click Import ADP button
      const importButton = screen.getByText('Import ADP');
      await user.click(importButton);
      
      // 2. Modal should be open
      expect(screen.getByText('Import ADP Data')).toBeInTheDocument();
      
      // 3. Import test data
      const importTestButton = screen.getByText('Import Test ADP');
      await user.click(importTestButton);
      
      // 4. Modal should close and callback should be called
      expect(screen.queryByText('Import ADP Data')).not.toBeInTheDocument();
      expect(mockOnADPImport).toHaveBeenCalledTimes(1);
    });
  });
});
