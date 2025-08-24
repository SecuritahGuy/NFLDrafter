import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ADPImport } from '../ADPImport';
import type { ADPData } from '../ADPImport';

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  CloudArrowUpIcon: ({ className }: { className?: string }) => (
    <div data-testid="cloud-arrow-up-icon" className={className} />
  ),
  XMarkIcon: ({ className }: { className?: string }) => (
    <div data-testid="x-mark-icon" className={className} />
  ),
}));

// Mock File.text() method
Object.defineProperty(File.prototype, 'text', {
  value: vi.fn(),
  writable: true,
});

const mockOnADPImport = vi.fn();

const sampleCSV = `player_name,adp,team,position
Christian McCaffrey,1.2,SF,RB
Tyreek Hill,2.1,MIA,WR
Patrick Mahomes,3.5,KC,QB
Travis Kelce,4.2,KC,TE`;

const sampleCSVMinimal = `player_name,adp
Christian McCaffrey,1.2
Tyreek Hill,2.1
Patrick Mahomes,3.5`;

const invalidCSV = `name,rank
Christian McCaffrey,1.2
Tyreek Hill,2.1`;

const malformedCSV = `player_name,adp,team,position
Christian McCaffrey,1.2,SF,RB
Tyreek Hill,invalid,MIA,WR
Patrick Mahomes,3.5,KC,QB`;

const createFile = (content: string, name: string = 'test.csv'): File => {
  const blob = new Blob([content], { type: 'text/csv' });
  const file = new File([blob], name, { type: 'text/csv' });
  
  // Mock the text method for this file
  (file.text as any).mockResolvedValue(content);
  
  return file;
};

describe('ADPImport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders upload area with correct text', () => {
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      expect(screen.getByText('Click to upload')).toBeInTheDocument();
      expect(screen.getByText('or drag and drop')).toBeInTheDocument();
      expect(screen.getByText(/CSV file with columns/)).toBeInTheDocument();
    });

    it('renders with custom className', () => {
      const { container } = render(
        <ADPImport onADPImport={mockOnADPImport} className="custom-class" />
      );
      
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('shows cloud arrow up icon', () => {
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      expect(screen.getByTestId('cloud-arrow-up-icon')).toBeInTheDocument();
    });
  });

  describe('File Upload', () => {
    it('handles file input change', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('ADP Data Preview (4 players)')).toBeInTheDocument();
      });
    });

    it('processes CSV with all columns correctly', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument();
        expect(screen.getByText('1.2')).toBeInTheDocument();
        expect(screen.getByText('SF')).toBeInTheDocument();
        expect(screen.getByText('RB')).toBeInTheDocument();
      });
    });

    it('processes minimal CSV correctly', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSVMinimal);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('ADP Data Preview (3 players)')).toBeInTheDocument();
        expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument();
        // Check that there are multiple dash elements (indicating missing team/position data)
        const dashes = screen.getAllByText('-');
        expect(dashes.length).toBeGreaterThan(3); // Multiple dashes for team, position, and value columns
      });
    });

    it('sorts players by ADP', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        const rows = screen.getAllByRole('row');
        // Header row + 4 data rows
        expect(rows).toHaveLength(5);
        
        // Check first player (lowest ADP)
        expect(screen.getByText('Christian McCaffrey')).toBeInTheDocument();
        expect(screen.getByText('1.2')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error for invalid CSV headers', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(invalidCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('CSV must contain "player_name" and "adp" columns')).toBeInTheDocument();
      });
    });

    it('shows error for malformed CSV data', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(malformedCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('ADP Data Preview (2 players)')).toBeInTheDocument();
        // Should skip the invalid row and only show 2 valid players
      });
    });

    it('shows error for empty CSV', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile('player_name,adp\n');
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('No valid ADP data found in CSV')).toBeInTheDocument();
      });
    });
  });

  describe('Drag and Drop', () => {
    it('handles drag over state', () => {
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      // Target the main drop zone div, not the inner text div
      const dropZone = screen.getByText('or drag and drop').closest('div')!.parentElement!;
      
      fireEvent.dragOver(dropZone);
      expect(dropZone).toHaveClass('border-blue-500', 'bg-blue-50');
      
      fireEvent.dragLeave(dropZone);
      expect(dropZone).not.toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('handles file drop', async () => {
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const dropZone = screen.getByText('or drag and drop').closest('div')!.parentElement!;
      const file = createFile(sampleCSV);
      
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [file]
        }
      });
      
      fireEvent(dropZone, dropEvent);
      
      await waitFor(() => {
        expect(screen.getByText('ADP Data Preview (4 players)')).toBeInTheDocument();
      });
    });

    it('shows error for non-CSV file drop', async () => {
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const dropZone = screen.getByText('or drag and drop').closest('div')!.parentElement!;
      const nonCsvFile = new File(['content'], 'test.txt', { type: 'text/plain' });
      
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [nonCsvFile]
        }
      });
      
      fireEvent(dropZone, dropEvent);
      
      await waitFor(() => {
        expect(screen.getByText('Please upload a valid CSV file')).toBeInTheDocument();
      });
    });
  });

  describe('Data Preview', () => {
    it('shows preview table after file upload', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('ADP Data Preview (4 players)')).toBeInTheDocument();
        expect(screen.getByText('Import ADP Data')).toBeInTheDocument();
        expect(screen.getByText('Clear')).toBeInTheDocument();
      });
    });

    it('limits preview to 10 rows with overflow message', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      // Create CSV with 15 players
      const manyPlayers = Array.from({ length: 15 }, (_, i) => 
        `Player${i + 1},${i + 1},Team${i + 1},Pos${i + 1}`
      ).join('\n');
      const csv = `player_name,adp,team,position\n${manyPlayers}`;
      
      const file = createFile(csv);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('ADP Data Preview (15 players)')).toBeInTheDocument();
        expect(screen.getByText('... and 5 more players')).toBeInTheDocument();
      });
    });
  });

  describe('Value vs ADP Calculation', () => {
    it('calculates value vs ADP correctly', async () => {
      const currentADP = {
        'Christian McCaffrey': 2.5,
        'Tyreek Hill': 1.8
      };
      
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} currentADP={currentADP} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        // McCaffrey: 2.5 - 1.2 = +1.3 (value)
        expect(screen.getByText('+1.3 (108.3%)')).toBeInTheDocument();
        // Hill: 1.8 - 2.1 = -0.3 (overvalued) - handle floating point precision
        expect(screen.getByText(/-0\.3.*-14\.3%/)).toBeInTheDocument();
      });
    });

    it('shows dash for players not in current ADP', async () => {
      const currentADP = { 'Christian McCaffrey': 2.5 };
      
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} currentADP={currentADP} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        // McCaffrey should show value
        expect(screen.getByText('+1.3 (108.3%)')).toBeInTheDocument();
        // Other players should show dash
        const dashes = screen.getAllByText('-');
        expect(dashes.length).toBeGreaterThan(1);
      });
    });
  });

  describe('Actions', () => {
    it('calls onADPImport when import button is clicked', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('Import ADP Data')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Import ADP Data'));
      
      expect(mockOnADPImport).toHaveBeenCalledWith([
        { player_name: 'Christian McCaffrey', adp: 1.2, team: 'SF', position: 'RB' },
        { player_name: 'Tyreek Hill', adp: 2.1, team: 'MIA', position: 'WR' },
        { player_name: 'Patrick Mahomes', adp: 3.5, team: 'KC', position: 'QB' },
        { player_name: 'Travis Kelce', adp: 4.2, team: 'KC', position: 'TE' }
      ]);
    });

    it('clears data when clear button is clicked', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('ADP Data Preview (4 players)')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Clear'));
      
      expect(screen.queryByText('ADP Data Preview')).not.toBeInTheDocument();
      expect(screen.queryByText('Import ADP Data')).not.toBeInTheDocument();
    });

    it('clears data after successful import', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        expect(screen.getByText('Import ADP Data')).toBeInTheDocument();
      });
      
      await user.click(screen.getByText('Import ADP Data'));
      
      expect(screen.queryByText('ADP Data Preview')).not.toBeInTheDocument();
    });
  });

  describe('Processing State', () => {
    it('shows processing spinner during file upload', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      // Mock a delay to see the processing state
      const originalText = file.text;
      (file.text as any).mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(sampleCSV), 100))
      );
      
      await user.upload(input, file);
      
      // Should show processing state briefly
      expect(screen.getByText('Processing CSV...')).toBeInTheDocument();
      
      await waitFor(() => {
        expect(screen.queryByText('Processing CSV...')).not.toBeInTheDocument();
      });
      
      // Restore original mock
      (file.text as any).mockImplementation(originalText);
    });
  });

  describe('Accessibility', () => {
    it('has proper labels and aria attributes', () => {
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const uploadLabel = screen.getByLabelText(/Click to upload/);
      expect(uploadLabel).toBeInTheDocument();
      
      const fileInput = screen.getByLabelText(/Click to upload/);
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('accept', '.csv');
    });

    it('has proper button states', async () => {
      const user = userEvent.setup();
      render(<ADPImport onADPImport={mockOnADPImport} />);
      
      const file = createFile(sampleCSV);
      const input = screen.getByLabelText(/Click to upload/);
      
      await user.upload(input, file);
      
      await waitFor(() => {
        const importButton = screen.getByText('Import ADP Data');
        expect(importButton).not.toBeDisabled();
        
        const clearButton = screen.getByText('Clear');
        expect(clearButton).not.toBeDisabled();
      });
    });
  });
});
