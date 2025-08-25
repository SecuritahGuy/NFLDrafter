import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
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

// Mock LoadingSpinner component
vi.mock('../LoadingSpinner', () => ({
  LoadingSpinner: ({ size, variant, className }: any) => (
    <div data-testid="loading-spinner" data-size={size} data-variant={variant} className={className}>
      Loading...
    </div>
  )
}))

// Mock Skeleton component
vi.mock('../Skeleton', () => ({
  SkeletonTable: ({ rows, columns, className }: any) => (
    <div data-testid="skeleton-table" data-rows={rows} data-columns={columns} className={className}>
      Skeleton Table ({rows}x{columns})
    </div>
  )
}))

// Shared mock children for all tests
const mockChildren = <div data-testid="content">Content</div>

describe('LoadingState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders loading state when loading', () => {
      render(<LoadingState loading={true}>{mockChildren}</LoadingState>)
      
      expect(screen.queryByTestId('content')).not.toBeInTheDocument()
      expect(screen.getAllByText('Loading...')).toHaveLength(2) // Spinner + paragraph
    })

    it('renders children when not loading', () => {
      render(<LoadingState loading={false}>{mockChildren}</LoadingState>)
      
      expect(screen.getByTestId('content')).toBeInTheDocument()
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(
        <LoadingState loading={true} className="custom-class">
          {mockChildren}
        </LoadingState>
      )
      
      // Find the main container div that has the className
      const container = screen.getAllByText('Loading...')[0].closest('div')?.parentElement?.parentElement
      expect(container).toHaveClass('custom-class')
    })
  })

  describe('Loading Types', () => {
    it('renders skeleton type', () => {
      render(
        <LoadingState loading={true} type="skeleton">
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.getByTestId('skeleton-table')).toBeInTheDocument()
    })

    it('renders progress type', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          showProgress={true}
          progress={50}
          progressLabel="Progress"
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByTestId('progress-percentage')).toHaveTextContent('50%')
      expect(screen.getByText('Progress')).toBeInTheDocument()
    })

    it('renders dots type', () => {
      render(
        <LoadingState loading={true} type="dots">
          {mockChildren}
        </LoadingState>
      )
      
      const dotsContainer = screen.getByTestId('loading-dots')
      const dots = dotsContainer.querySelectorAll('div[class*="animate-bounce"]')
      expect(dots).toHaveLength(3) // Three dots
    })

    it('renders pulse type', () => {
      render(
        <LoadingState loading={true} type="pulse">
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Loading...')).toBeInTheDocument()
      expect(screen.getByTestId('pulse-animation')).toBeInTheDocument()
    })
  })

  describe('Messages and Sub-messages', () => {
    it('shows custom message', () => {
      render(
        <LoadingState loading={true} message="Custom loading message">
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Custom loading message')).toBeInTheDocument()
    })

    it('shows sub-message when provided', () => {
      render(
        <LoadingState loading={true} subMessage="Additional information">
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Additional information')).toBeInTheDocument()
    })

    it('does not show sub-message when not provided', () => {
      render(<LoadingState loading={true}>{mockChildren}</LoadingState>)
      
      expect(screen.queryByText('Additional information')).not.toBeInTheDocument()
    })
  })

  describe('Progress Display', () => {
    it('shows progress bar when showProgress is true and progress is provided', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          showProgress={true} 
          progress={75}
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('75%')).toBeInTheDocument()
      expect(screen.getByText('Progress')).toBeInTheDocument()
    })

    it('does not show progress when showProgress is false', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          showProgress={false} 
          progress={75}
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.queryByText('75%')).not.toBeInTheDocument()
    })

    it('shows custom progress label', () => {
      render(
        <LoadingState 
          loading={true} 
          type="progress" 
          showProgress={true} 
          progress={50}
          progressLabel="Upload Progress"
        >
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByText('Upload Progress')).toBeInTheDocument()
    })
  })

  describe('Skeleton Configuration', () => {
    it('uses custom skeleton rows and columns', () => {
      render(
        <LoadingState 
          loading={true} 
          type="skeleton" 
          skeletonRows={10} 
          skeletonColumns={6}
        >
          {mockChildren}
        </LoadingState>
      )
      
      const skeletonTable = screen.getByTestId('skeleton-table')
      expect(skeletonTable).toBeInTheDocument()
    })
  })

  describe('Overlay Mode', () => {
    it('renders overlay when overlay is true', () => {
      render(
        <LoadingState loading={true} overlay={true}>
          {mockChildren}
        </LoadingState>
      )
      
      // Find the main container div that has the relative class
      const container = screen.getAllByText('Loading...')[0].closest('div')?.parentElement?.parentElement?.parentElement
      expect(container).toHaveClass('relative')
    })

    it('shows content with reduced opacity in overlay mode', () => {
      render(
        <LoadingState loading={true} overlay={true}>
          {mockChildren}
        </LoadingState>
      )
      
      // The content should be wrapped in a div with opacity-50 and pointer-events-none
      const contentWrapper = screen.getByTestId('content').parentElement
      expect(contentWrapper).toHaveClass('opacity-50', 'pointer-events-none')
    })
  })

  describe('Min Height', () => {
    it('applies custom min height', () => {
      render(
        <LoadingState loading={true} minHeight="500px">
          {mockChildren}
        </LoadingState>
      )
      
      // Find the main container div that has the style
      const container = screen.getAllByText('Loading...')[0].closest('div')?.parentElement?.parentElement
      expect(container).toHaveStyle({ minHeight: '500px' })
    })

    it('uses default min height when not specified', () => {
      render(<LoadingState loading={true}>{mockChildren}</LoadingState>)
      
      // Find the main container div that has the style
      const container = screen.getAllByText('Loading...')[0].closest('div')?.parentElement?.parentElement
      expect(container).toHaveStyle({ minHeight: '200px' })
    })
  })

  describe('Fallback Content', () => {
    it('renders fallback when provided and loading', () => {
      const fallback = <div data-testid="fallback">Fallback content</div>
      render(
        <LoadingState loading={true} fallback={fallback}>
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.getByTestId('fallback')).toBeInTheDocument()
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
    })

    it('does not render fallback when not loading', () => {
      const fallback = <div data-testid="fallback">Fallback content</div>
      render(
        <LoadingState loading={false} fallback={fallback}>
          {mockChildren}
        </LoadingState>
      )
      
      expect(screen.queryByTestId('fallback')).not.toBeInTheDocument()
      expect(screen.getByTestId('content')).toBeInTheDocument()
    })
  })
})

describe('TableLoadingState', () => {
  const mockChildren = <div data-testid="table-content">Table Content</div>

  it('renders skeleton loading for tables', () => {
    render(
      <TableLoadingState loading={true} rows={8} columns={5}>
        {mockChildren}
      </TableLoadingState>
    )
    
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
    expect(screen.getByTestId('skeleton-table')).toBeInTheDocument()
  })

  it('shows default message for table loading', () => {
    render(<TableLoadingState loading={true}>{mockChildren}</TableLoadingState>)
    
    expect(screen.getByText('Loading data...')).toBeInTheDocument()
  })

  it('renders children when not loading', () => {
    render(<TableLoadingState loading={false}>{mockChildren}</TableLoadingState>)
    
    expect(screen.getByTestId('table-content')).toBeInTheDocument()
  })
})

describe('CardLoadingState', () => {
  const mockChildren = <div data-testid="card-content">Card Content</div>

  it('renders spinner loading for cards', () => {
    render(<CardLoadingState loading={true}>{mockChildren}</CardLoadingState>)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toHaveAttribute('data-size', 'lg')
  })

  it('shows default message for card loading', () => {
    render(<CardLoadingState loading={true}>{mockChildren}</CardLoadingState>)
    
    expect(screen.getAllByText('Loading...')).toHaveLength(2)
  })

  it('uses appropriate min height for cards', () => {
    render(<CardLoadingState loading={true}>{mockChildren}</CardLoadingState>)
    
    // Find the main container div that has the style
    const container = screen.getAllByText('Loading...')[0].closest('div')?.parentElement?.parentElement
    expect(container).toHaveStyle({ minHeight: '300px' })
  })
})

describe('PageLoadingState', () => {
  const mockChildren = <div data-testid="page-content">Page Content</div>

  it('renders spinner loading for pages', () => {
    render(<PageLoadingState loading={true}>{mockChildren}</PageLoadingState>)
    
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    expect(screen.getByTestId('loading-spinner')).toHaveAttribute('data-size', 'lg')
  })

  it('shows default message for page loading', () => {
    render(<PageLoadingState loading={true}>{mockChildren}</PageLoadingState>)
    
    expect(screen.getAllByText('Loading page...')).toHaveLength(1)
  })

  it('shows sub-message when provided', () => {
    render(
      <PageLoadingState loading={true} subMessage="Please wait while we load your data">
        {mockChildren}
      </PageLoadingState>
    )
    
    expect(screen.getByText('Please wait while we load your data')).toBeInTheDocument()
  })

  it('uses appropriate min height for pages', () => {
    render(<PageLoadingState loading={true}>{mockChildren}</PageLoadingState>)
    
    const container = screen.getByText('Loading page...').closest('div')?.parentElement
    expect(container).toHaveStyle({ minHeight: '400px' })
  })
})

describe('InlineLoadingState', () => {
  const mockChildren = <div data-testid="inline-content">Inline Content</div>

  it('renders dots loading for inline content', () => {
    render(<InlineLoadingState loading={true}>{mockChildren}</InlineLoadingState>)
    
    const dotsContainer = screen.getByTestId('loading-dots')
    const dots = dotsContainer.querySelectorAll('div[class*="animate-bounce"]')
    expect(dots).toHaveLength(3) // Three dots
  })

  it('shows default message for inline loading', () => {
    render(<InlineLoadingState loading={true}>{mockChildren}</InlineLoadingState>)
    
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('uses auto min height for inline content', () => {
    render(<InlineLoadingState loading={true}>{mockChildren}</InlineLoadingState>)
    
    const container = screen.getByText('Loading...').closest('div')?.parentElement
    expect(container).toHaveStyle({ minHeight: 'auto' })
  })
})

describe('ProgressLoadingState', () => {
  const mockChildren = <div data-testid="progress-content">Progress Content</div>

  it('renders progress loading with progress bar', () => {
    render(
      <ProgressLoadingState 
        loading={true} 
        progress={75}
      >
        {mockChildren}
      </ProgressLoadingState>
    )
    
    expect(screen.getByTestId('progress-percentage')).toHaveTextContent('75%')
  })

  it('shows custom progress label', () => {
    render(
      <ProgressLoadingState 
        loading={true} 
        progress={50}
        progressLabel="Processing"
      >
        {mockChildren}
      </ProgressLoadingState>
    )
    
    expect(screen.getByText('Processing')).toBeInTheDocument()
  })

  it('uses appropriate min height for progress loading', () => {
    render(
      <ProgressLoadingState loading={true} progress={25}>
        {mockChildren}
      </ProgressLoadingState>
    )
    
    // Find the main container div that has the style - need to go up more levels
    const container = screen.getByText('Processing...').closest('div')?.parentElement?.parentElement?.parentElement
    expect(container).toHaveStyle({ minHeight: '200px' })
  })
})

describe('LoadingStateWithError', () => {
  // Use the outer mockChildren from the parent describe block
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders error state when error is provided', () => {
    const mockError = new Error('Something went wrong')
    render(
      <LoadingStateWithError 
        loading={false} 
        error={mockError} 
        onRetry={mockOnRetry}
      >
        {mockChildren}
      </LoadingStateWithError>
    )
    
    expect(screen.getAllByText('Something went wrong')).toHaveLength(2) // Title + message
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('renders loading state when loading and no error', () => {
    render(
      <LoadingStateWithError 
        loading={true} 
        error={null} 
        onRetry={mockOnRetry}
      >
        {mockChildren}
      </LoadingStateWithError>
    )
    
    expect(screen.getAllByText('Loading...')).toHaveLength(2)
  })

  it('renders children when not loading and no error', () => {
    render(
      <LoadingStateWithError 
        loading={false} 
        error={null} 
        onRetry={mockOnRetry}
      >
        {mockChildren}
      </LoadingStateWithError>
    )
    
    // The children should be rendered directly when not loading and no error
    expect(screen.getByTestId('content')).toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup()
    const mockError = new Error('Something went wrong')
    
    render(
      <LoadingStateWithError 
        loading={false} 
        error={mockError}
        onRetry={mockOnRetry}
      >
        {mockChildren}
      </LoadingStateWithError>
    )
    
    const retryButton = screen.getByText('Try Again')
    await user.click(retryButton)
    
    expect(mockOnRetry).toHaveBeenCalledTimes(1)
  })

  it('uses custom retry label', () => {
    const mockError = new Error('Something went wrong')
    render(
      <LoadingStateWithError 
        loading={false} 
        error={mockError}
        onRetry={mockOnRetry}
        retryLabel="Retry Operation"
      >
        {mockChildren}
      </LoadingStateWithError>
    )
    
    expect(screen.getByText('Retry Operation')).toBeInTheDocument()
  })
})

describe('LoadingStateWithFallback', () => {
  const mockChildren = <div data-testid="fallback-content">Fallback Content</div>
  const mockFallback = <div data-testid="custom-fallback">Custom Fallback</div>

  it('renders fallback when loading', () => {
    render(
      <LoadingStateWithFallback 
        loading={true} 
        fallback={mockFallback}
      >
        {mockChildren}
      </LoadingStateWithFallback>
    )
    
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument()
    expect(screen.queryByTestId('fallback-content')).not.toBeInTheDocument()
  })

  it('renders children when not loading', () => {
    render(
      <LoadingStateWithFallback 
        loading={false} 
        fallback={mockFallback}
      >
        {mockChildren}
      </LoadingStateWithFallback>
    )
    
    expect(screen.getByTestId('fallback-content')).toBeInTheDocument()
    expect(screen.queryByTestId('custom-fallback')).not.toBeInTheDocument()
  })
})
