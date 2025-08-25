import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { 
  LoadingState, 
  TableLoadingState, 
  CardLoadingState, 
  PageLoadingState, 
  InlineLoadingState, 
  ProgressLoadingState,
  LoadingStateWithError,
  LoadingStateWithFallback
} from '../LoadingState'
import { LoadingSpinner } from '../LoadingSpinner'
import { Skeleton, SkeletonTable } from '../Skeleton'

// Mock LoadingSpinner component
vi.mock('../LoadingSpinner', () => ({
  LoadingSpinner: ({ size, variant }: { size: string; variant: string }) => (
    <div data-testid="loading-spinner" data-size={size} data-variant={variant}>
      Loading Spinner
    </div>
  )
}))

// Mock Skeleton components
vi.mock('../Skeleton', () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className}>Skeleton</div>
  ),
  SkeletonTable: ({ rows, columns }: { rows: number; columns: number }) => (
    <div data-testid="skeleton-table" data-rows={rows} data-columns={columns}>
      Skeleton Table
    </div>
  )
}))

describe('LoadingState', () => {
  const mockChildren = <div data-testid="content">Content</div>
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders children when not loading', () => {
      render(<LoadingState loading={false}>{mockChildren}</LoadingState>)
      
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })

    it('renders loading content when loading', () => {
      render(<LoadingState loading={true}>{mockChildren}</LoadingState>)
      
      expect(screen.queryByTestId('content')).not.toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders fallback when provided', () => {
      const fallback = <div data-testid="fallback">Fallback Content</div>
      render(
        <LoadingState loading={true} fallback={fallback}>
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByTestId('fallback')).toBeInTheDocument()
      expect(screen.queryByTestId('content')).not.toBeInTheDocument()
    })
  })

  describe('Loading Types', () => {
    it('renders spinner type by default', () => {
      render(<LoadingState loading={true}>{mockChildren}</LoadingState>)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toHaveAttribute('data-size', 'lg')
      expect(screen.getByTestId('loading-spinner')).toHaveAttribute('data-variant', 'primary')
    })

    it('renders skeleton type correctly', () => {
      render(
        <LoadingState 
          loading={true} 
          type="skeleton" 
          skeletonRows={3} 
          skeletonColumns={2}
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByTestId('skeleton-table')).toBeInTheDocument()
      expect(screen.getByTestId('skeleton-table')).toHaveAttribute('data-rows', '3')
      expect(screen.getByTestId('skeleton-table')).toHaveAttribute('data-columns', '2')
    })

    it('renders progress type correctly', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          progress={75} 
          progressLabel="Upload Progress"
          showProgress={true}
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByText('Upload Progress')).toBeInTheDocument()
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('75%')
    })

    it('renders dots type correctly', () => {
      render(<LoadingState loading={true} type="dots">{mockChildren}</LoadingState>)
      
      expect(screen.getByTestId('loading-dots')).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })

    it('renders pulse type correctly', () => {
      render(<LoadingState loading={true} type="pulse">{mockChildren}</LoadingState>)
      
      expect(screen.getByTestId('pulse-animation')).toBeInTheDocument()
      expect(screen.getByText('Loading...')).toBeInTheDocument()
    })
  })

  describe('Messages and Labels', () => {
    it('displays custom message', () => {
      render(
        <LoadingState loading={true} message="Custom loading message">
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Custom loading message')).toBeInTheDocument()
    })

    it('displays sub message when provided', () => {
      render(
        <LoadingState 
          loading={true} 
          message="Loading..." 
          subMessage="Please wait while we process your request"
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.getByText('Please wait while we process your request')).toBeInTheDocument()
    })

    it('displays progress label when provided', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          progress={50} 
          progressLabel="Download Progress"
          showProgress={true}
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Download Progress')).toBeInTheDocument()
    })
  })

  describe('Progress Bar', () => {
    it('renders progress bar when showProgress is true', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          progress={60} 
          showProgress={true}
        >
          {mockChildren}
        </LoadingState>
      )
      
      const progressBar = screen.getByTestId('progress-percentage')
      expect(progressBar).toBeInTheDocument()
      expect(progressBar).toHaveTextContent('60%')
    })

    it('does not render progress bar when showProgress is false', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          progress={60} 
          showProgress={false}
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.queryByTestId('progress-percentage')).not.toBeInTheDocument()
    })

    it('handles undefined progress gracefully', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          showProgress={true}
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('NaN%')
    })
  })

  describe('Overlay Mode', () => {
    it('renders overlay when overlay is true', () => {
      render(
        <LoadingState loading={true} overlay={true}>
          {mockChildren}
        </LoadingState>
      )
      
      const overlay = screen.getByText('Loading...').closest('div')
      expect(overlay).toHaveClass('absolute', 'inset-0', 'bg-white', 'bg-opacity-75')
    })

    it('renders content with reduced opacity in overlay mode', () => {
      render(
        <LoadingState loading={true} overlay={true}>
          {mockChildren}
        </LoadingState>
      )
      
      const content = screen.getByTestId('content')
      expect(content).toHaveClass('opacity-50', 'pointer-events-none')
    })

    it('does not render overlay when overlay is false', () => {
      render(
        <LoadingState loading={true} overlay={false}>
          {mockChildren}
        </LoadingState>
      )
      
      const container = screen.getByText('Loading...').closest('div')
      expect(container).not.toHaveClass('absolute', 'inset-0')
    })
  })

  describe('Styling and Layout', () => {
    it('applies custom className', () => {
      render(
        <LoadingState loading={true} className="custom-loading-class">
          {mockChildren}
        </LoadingState>
      )
      
      const container = screen.getByText('Loading...').closest('div')
      expect(container).toHaveClass('custom-loading-class')
    })

    it('applies minHeight style', () => {
      render(
        <LoadingState loading={true} minHeight="500px">
          {mockChildren}
        </LoadingState>
      )
      
      const container = screen.getByText('Loading...').closest('div')
      expect(container).toHaveStyle({ minHeight: '500px' })
    })

    it('centers content by default', () => {
      render(<LoadingState loading={true}>{mockChildren}</LoadingState>)
      
      const container = screen.getByText('Loading...').closest('div')
      expect(container).toHaveClass('flex', 'items-center', 'justify-center')
    })
  })

  describe('Error Handling', () => {
    it('renders error state when error is provided', () => {
      const error = new Error('Something went wrong')
      render(
        <LoadingState 
          loading={false} 
          error={error} 
          onRetry={mockOnRetry}
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Something went wrong')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    it('calls onRetry when retry button is clicked', async () => {
      const error = new Error('Something went wrong')
      render(
        <LoadingState 
          loading={false} 
          error={error} 
          onRetry={mockOnRetry}
        >
          {mockChildren}
        </LoadingState>
      )
      
      const retryButton = screen.getByText('Try Again')
      fireEvent.click(retryButton)
      
      await waitFor(() => {
        expect(mockOnRetry).toHaveBeenCalledTimes(1)
      })
    })

    it('uses custom retry label when provided', () => {
      const error = new Error('Something went wrong')
      render(
        <LoadingState 
          loading={false} 
          error={error} 
          onRetry={mockOnRetry}
          retryLabel="Retry Operation"
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Retry Operation')).toBeInTheDocument()
    })
  })
})

describe('Specialized Loading States', () => {
  const mockChildren = <div data-testid="content">Content</div>

  describe('TableLoadingState', () => {
    it('renders with skeleton table by default', () => {
      render(<TableLoadingState loading={true}>{mockChildren}</TableLoadingState>)
      
      expect(screen.getByTestId('skeleton-table')).toBeInTheDocument()
      expect(screen.getByTestId('skeleton-table')).toHaveAttribute('data-rows', '5')
      expect(screen.getByTestId('skeleton-table')).toHaveAttribute('data-columns', '4')
    })

    it('allows custom rows and columns', () => {
      render(
        <TableLoadingState loading={true} rows={10} columns={6}>
          {mockChildren}
        </TableLoadingState>
      )
      
      expect(screen.getByTestId('skeleton-table')).toHaveAttribute('data-rows', '10')
      expect(screen.getByTestId('skeleton-table')).toHaveAttribute('data-columns', '6')
    })

    it('allows custom message', () => {
      render(
        <TableLoadingState loading={true} message="Loading table data...">
          {mockChildren}
        </TableLoadingState>
      )
      
      expect(screen.getByText('Loading table data...')).toBeInTheDocument()
    })
  })

  describe('CardLoadingState', () => {
    it('renders with spinner by default', () => {
      render(<CardLoadingState loading={true}>{mockChildren}</CardLoadingState>)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toHaveAttribute('data-size', 'lg')
    })

    it('applies card-specific styling', () => {
      render(<CardLoadingState loading={true}>{mockChildren}</CardLoadingState>)
      
      const container = screen.getByText('Loading...').closest('div')
      expect(container).toHaveStyle({ minHeight: '300px' })
    })
  })

  describe('PageLoadingState', () => {
    it('renders with spinner by default', () => {
      render(<PageLoadingState loading={true}>{mockChildren}</PageLoadingState>)
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toHaveAttribute('data-size', 'lg')
    })

    it('applies page-specific styling', () => {
      render(<PageLoadingState loading={true}>{mockChildren}</PageLoadingState>)
      
      const container = screen.getByText('Loading page...').closest('div')
      expect(container).toHaveStyle({ minHeight: '400px' })
    })

    it('allows custom sub message', () => {
      render(
        <PageLoadingState 
          loading={true} 
          subMessage="Please wait while we load your dashboard"
        >
          {mockChildren}
        </PageLoadingState>
      )
      
      expect(screen.getByText('Please wait while we load your dashboard')).toBeInTheDocument()
    })
  })

  describe('InlineLoadingState', () => {
    it('renders with dots by default', () => {
      render(<InlineLoadingState loading={true}>{mockChildren}</InlineLoadingState>)
      
      expect(screen.getByTestId('loading-dots')).toBeInTheDocument()
    })

    it('applies inline-specific styling', () => {
      render(<InlineLoadingState loading={true}>{mockChildren}</InlineLoadingState>)
      
      const container = screen.getByText('Loading...').closest('div')
      expect(container).toHaveStyle({ minHeight: 'auto' })
    })
  })

  describe('ProgressLoadingState', () => {
    it('renders with progress type', () => {
      render(
        <ProgressLoadingState loading={true} progress={25}>
          {mockChildren}
        </ProgressLoadingState>
      )
      
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('25%')
    })

    it('allows custom progress label', () => {
      render(
        <ProgressLoadingState 
          loading={true} 
          progress={50} 
          progressLabel="Processing Files"
        >
          {mockChildren}
        </ProgressLoadingState>
      )
      
      expect(screen.getByText('Processing Files')).toBeInTheDocument()
    })
  })

  describe('LoadingStateWithError', () => {
    it('renders with error handling', () => {
      const error = new Error('Test error')
      const onRetry = vi.fn()
      
      render(
        <LoadingStateWithError 
          loading={false} 
          error={error} 
          onRetry={onRetry}
        >
          {mockChildren}
        </LoadingStateWithError>
      )
      
      expect(screen.getByText('Test error')).toBeInTheDocument()
      expect(screen.getByText('Try Again')).toBeInTheDocument()
    })

    it('allows custom retry label', () => {
      const error = new Error('Test error')
      const onRetry = vi.fn()
      
      render(
        <LoadingStateWithError 
          loading={false} 
          error={error} 
          onRetry={onRetry}
          retryLabel="Retry"
        >
          {mockChildren}
        </LoadingStateWithError>
      )
      
      expect(screen.getByText('Retry')).toBeInTheDocument()
    })
  })

  describe('LoadingStateWithFallback', () => {
    it('renders fallback when loading', () => {
      const fallback = <div data-testid="fallback">Fallback</div>
      
      render(
        <LoadingStateWithFallback 
          loading={true} 
          fallback={fallback}
        >
          {mockChildren}
        </LoadingStateWithFallback>
      )
      
      expect(screen.getByTestId('fallback')).toBeInTheDocument()
      expect(screen.queryByTestId('content')).not.toBeInTheDocument()
    })

    it('renders children when not loading', () => {
      const fallback = <div data-testid="fallback">Fallback</div>
      
      render(
        <LoadingStateWithFallback 
          loading={false} 
          fallback={fallback}
        >
          {mockChildren}
        </LoadingStateWithFallback>
      )
      
      expect(screen.getByTestId('content')).toBeInTheDocument()
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument()
    })
  })
})

