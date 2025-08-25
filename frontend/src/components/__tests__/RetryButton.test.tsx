import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RetryButton, APIRetryButton, ExponentialBackoffRetryButton } from '../RetryButton'

// Mock LoadingSpinner component
vi.mock('../LoadingSpinner', () => ({
  LoadingSpinner: ({ size, variant, className }: any) => (
    <div data-testid="loading-spinner" data-size={size} data-variant={variant} className={className}>
      Loading...
    </div>
  )
}))

describe('RetryButton', () => {
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders with default props', () => {
      render(<RetryButton onRetry={mockOnRetry}>Retry</RetryButton>)
      
      expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
      expect(screen.getByRole('button')).not.toBeDisabled()
    })

    it('renders with custom text', () => {
      render(<RetryButton onRetry={mockOnRetry}>Try Again</RetryButton>)
      
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument()
    })

    it('applies custom className', () => {
      render(
        <RetryButton onRetry={mockOnRetry} className="custom-class">
          Retry
        </RetryButton>
      )
      
      expect(screen.getByRole('button')).toHaveClass('custom-class')
    })
  })

  describe('Variants', () => {
    it('renders primary variant by default', () => {
      render(<RetryButton onRetry={mockOnRetry}>Retry</RetryButton>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-primary-600')
    })

    it('renders secondary variant', () => {
      render(
        <RetryButton onRetry={mockOnRetry} variant="secondary">
          Retry
        </RetryButton>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('bg-gray-600')
    })

    it('renders outline variant', () => {
      render(
        <RetryButton onRetry={mockOnRetry} variant="outline">
          Retry
        </RetryButton>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('border-gray-300')
    })

    it('renders ghost variant', () => {
      render(
        <RetryButton onRetry={mockOnRetry} variant="ghost">
          Retry
        </RetryButton>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('text-gray-700')
    })
  })

  describe('Sizes', () => {
    it('renders small size', () => {
      render(
        <RetryButton onRetry={mockOnRetry} size="sm">
          Retry
        </RetryButton>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm')
    })

    it('renders medium size by default', () => {
      render(<RetryButton onRetry={mockOnRetry}>Retry</RetryButton>)
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-4', 'py-2', 'text-sm')
    })

    it('renders large size', () => {
      render(
        <RetryButton onRetry={mockOnRetry} size="lg">
          Retry
        </RetryButton>
      )
      
      const button = screen.getByRole('button')
      expect(button).toHaveClass('px-6', 'py-3', 'text-base')
    })
  })

  describe('Retry Logic', () => {
    it('calls onRetry when clicked', async () => {
      const user = userEvent.setup()
      render(<RetryButton onRetry={mockOnRetry}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      expect(mockOnRetry).toHaveBeenCalledTimes(1)
    })

    it('shows loading state during retry', async () => {
      const user = userEvent.setup()
      const asyncOnRetry = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<RetryButton onRetry={asyncOnRetry}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      expect(screen.getByText('Retrying...')).toBeInTheDocument()
      expect(screen.getByTestId('loading-spinner')).toBeInTheDocument()
    })

    it('disables button during retry', async () => {
      const user = userEvent.setup()
      const asyncOnRetry = vi.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))
      
      render(<RetryButton onRetry={asyncOnRetry}>Retry</RetryButton>)
      
      const button = screen.getByRole('button')
      await user.click(button)
      
      expect(button).toBeDisabled()
    })

    it('resets retry count on success', async () => {
      const user = userEvent.setup()
      const asyncOnRetry = vi.fn().mockResolvedValue(undefined)
      
      render(<RetryButton onRetry={asyncOnRetry}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.queryByText('Attempt 1 of 3')).not.toBeInTheDocument()
      })
    })
  })

  describe('Error Handling', () => {
    it('shows error message on failure', async () => {
      const user = userEvent.setup()
      const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
      
      render(<RetryButton onRetry={errorOnRetry}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument()
      })
    })

    it('increments retry count on failure', async () => {
      const user = userEvent.setup()
      const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
      
      render(<RetryButton onRetry={errorOnRetry}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('Attempt 1 of 3')).toBeInTheDocument()
      })
    })

    it('auto-retries after delay', async () => {
      const user = userEvent.setup()
      const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
      
      render(<RetryButton onRetry={errorOnRetry} retryDelay={100}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      // Wait for auto-retry
      await waitFor(() => {
        expect(errorOnRetry).toHaveBeenCalledTimes(2)
      }, { timeout: 2000 })
    })

    it('stops auto-retrying after max retries', async () => {
      const user = userEvent.setup()
      const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
      
      render(<RetryButton onRetry={errorOnRetry} maxRetries={2} retryDelay={100}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      // Wait for auto-retries
      await waitFor(() => {
        expect(errorOnRetry).toHaveBeenCalledTimes(2)
        expect(screen.getByText('Maximum retries reached. Please try again later or contact support.')).toBeInTheDocument()
      }, { timeout: 2000 })
    })
  })

  describe('Retry Count Display', () => {
    it('shows retry count when showRetryCount is true', async () => {
      const user = userEvent.setup()
      const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
      
      render(<RetryButton onRetry={errorOnRetry} showRetryCount={true}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByText('Attempt 1 of 3')).toBeInTheDocument()
      })
    })

    it('hides retry count when showRetryCount is false', async () => {
      const user = userEvent.setup()
      const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
      
      render(<RetryButton onRetry={errorOnRetry} showRetryCount={false}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.queryByText('Attempt 1 of 3')).not.toBeInTheDocument()
      })
    })
  })

  describe('Disabled State', () => {
    it('disables button when disabled prop is true', () => {
      render(<RetryButton onRetry={mockOnRetry} disabled={true}>Retry</RetryButton>)
      
      expect(screen.getByRole('button')).toBeDisabled()
    })

    it('disables button when max retries reached', async () => {
      const user = userEvent.setup()
      const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
      
      render(<RetryButton onRetry={errorOnRetry} maxRetries={1}>Retry</RetryButton>)
      
      await user.click(screen.getByRole('button'))
      
      await waitFor(() => {
        expect(screen.getByRole('button')).toBeDisabled()
      })
    })
  })
})

describe('APIRetryButton', () => {
  const mockApiCall = vi.fn()
  const mockOnSuccess = vi.fn()
  const mockOnError = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls onSuccess when API call succeeds', async () => {
    const user = userEvent.setup()
    const mockData = { id: 1, name: 'Test' }
    mockApiCall.mockResolvedValue(mockData)
    
    render(
      <APIRetryButton
        apiCall={mockApiCall}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      >
        API Retry
      </APIRetryButton>
    )
    
    await user.click(screen.getByRole('button', { name: 'API Retry' }))
    
    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalledWith(mockData)
      expect(mockOnError).not.toHaveBeenCalled()
    })
  })

  it('calls onError when API call fails', async () => {
    const user = userEvent.setup()
    const mockError = new Error('API Error')
    mockApiCall.mockRejectedValue(mockError)
    
    render(
      <APIRetryButton
        apiCall={mockApiCall}
        onSuccess={mockOnSuccess}
        onError={mockOnError}
      >
        API Retry
      </APIRetryButton>
    )
    
    await user.click(screen.getByRole('button', { name: 'API Retry' }))
    
    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(mockError)
      expect(mockOnSuccess).not.toHaveBeenCalled()
    })
  })
})

describe('ExponentialBackoffRetryButton', () => {
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with exponential backoff functionality', async () => {
    const user = userEvent.setup()
    const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
    
    render(
      <ExponentialBackoffRetryButton
        onRetry={errorOnRetry}
        baseDelay={100}
        maxDelay={1000}
      >
        Exponential Retry
      </ExponentialBackoffRetryButton>
    )
    
    await user.click(screen.getByRole('button'))
    
    // Should show error and retry count
    expect(screen.getByText('Network error')).toBeInTheDocument()
    expect(screen.getByText(/Attempt 1 of 3/)).toBeInTheDocument()
  })

  it('respects max retries limit', async () => {
    const user = userEvent.setup()
    const errorOnRetry = vi.fn().mockRejectedValue(new Error('Network error'))
    
    render(
      <ExponentialBackoffRetryButton
        onRetry={errorOnRetry}
        baseDelay={100}
        maxDelay={300}
        maxRetries={2}
      >
        Exponential Retry
      </ExponentialBackoffRetryButton>
    )
    
    await user.click(screen.getByRole('button'))
    
    // Wait for max retries to be reached
    await waitFor(() => {
      expect(screen.getByText('Maximum retries reached. Please try again later or contact support.')).toBeInTheDocument()
    }, { timeout: 2000 })
    
    // Button should be disabled
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
