import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { ErrorDisplay, NetworkErrorDisplay, ValidationErrorDisplay, PermissionErrorDisplay, ServerErrorDisplay, FormErrorDisplay, APIErrorDisplay } from '../ErrorDisplay'
import { RetryButton } from '../RetryButton'

// Mock RetryButton component
vi.mock('../RetryButton', () => ({
  RetryButton: ({ children, onRetry }: { children: React.ReactNode; onRetry: () => void }) => (
    <button onClick={onRetry} data-testid="retry-button">
      {children}
    </button>
  )
}))

describe('ErrorDisplay', () => {
  const mockError = {
    title: 'Test Error',
    message: 'This is a test error message',
    severity: 'high' as const,
    code: 'TEST_ERROR',
    details: 'Technical details about the error',
    suggestions: ['Try again', 'Check your input'],
    timestamp: new Date('2024-01-01T12:00:00Z'),
    retryable: true,
    onRetry: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders basic error information', () => {
    render(<ErrorDisplay error={mockError} />)
    
    expect(screen.getByText('Test Error')).toBeInTheDocument()
    expect(screen.getByText('This is a test error message')).toBeInTheDocument()
    expect(screen.getByText('TEST_ERROR')).toBeInTheDocument()
  })

  it('applies correct severity styles', () => {
    const { rerender } = render(<ErrorDisplay error={mockError} />)
    
    // High severity should have orange styling
    const container = screen.getByText('Test Error').closest('div')
    expect(container).toHaveClass('bg-orange-50', 'border-orange-200', 'text-orange-800')
    
    // Test critical severity
    const criticalError = { ...mockError, severity: 'critical' as const }
    rerender(<ErrorDisplay error={criticalError} />)
    
    const criticalContainer = screen.getByText('Test Error').closest('div')
    expect(criticalContainer).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800')
  })

  it('shows timestamp when enabled', () => {
    render(<ErrorDisplay error={mockError} showTimestamp={true} />)
    
    expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument()
  })

  it('hides timestamp when disabled', () => {
    render(<ErrorDisplay error={mockError} showTimestamp={false} />)
    
    expect(screen.queryByText(/Jan 1, 2024/)).not.toBeInTheDocument()
  })

  it('shows code when enabled', () => {
    render(<ErrorDisplay error={mockError} showCode={true} />)
    
    expect(screen.getByText('TEST_ERROR')).toBeInTheDocument()
  })

  it('hides code when disabled', () => {
    render(<ErrorDisplay error={mockError} showCode={false} />)
    
    expect(screen.queryByText('TEST_ERROR')).not.toBeInTheDocument()
  })

  it('shows details when enabled', () => {
    render(<ErrorDisplay error={mockError} showDetails={true} />)
    
    expect(screen.getByText('Technical Details')).toBeInTheDocument()
    expect(screen.getByText('Technical details about the error')).toBeInTheDocument()
  })

  it('hides details when disabled', () => {
    render(<ErrorDisplay error={mockError} showDetails={false} />)
    
    expect(screen.queryByText('Technical Details')).not.toBeInTheDocument()
  })

  it('shows suggestions when enabled', () => {
    render(<ErrorDisplay error={mockError} showSuggestions={true} />)
    
    expect(screen.getByText('Suggestions:')).toBeInTheDocument()
    expect(screen.getByText('Try again')).toBeInTheDocument()
    expect(screen.getByText('Check your input')).toBeInTheDocument()
  })

  it('hides suggestions when disabled', () => {
    render(<ErrorDisplay error={mockError} showSuggestions={false} />)
    
    expect(screen.queryByText('Suggestions:')).not.toBeInTheDocument()
  })

  it('shows retry button when retryable and onRetry provided', () => {
    render(<ErrorDisplay error={mockError} showRetry={true} />)
    
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    expect(screen.getByText('Try Again')).toBeInTheDocument()
  })

  it('hides retry button when not retryable', () => {
    const nonRetryableError = { ...mockError, retryable: false }
    render(<ErrorDisplay error={nonRetryableError} showRetry={true} />)
    
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
  })

  it('hides retry button when onRetry not provided', () => {
    const errorWithoutRetry = { ...mockError, onRetry: undefined }
    render(<ErrorDisplay error={errorWithoutRetry} showRetry={true} />)
    
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    render(<ErrorDisplay error={mockError} showRetry={true} />)
    
    const retryButton = screen.getByTestId('retry-button')
    fireEvent.click(retryButton)
    
    await waitFor(() => {
      expect(mockError.onRetry).toHaveBeenCalledTimes(1)
    })
  })

  it('shows dismiss button when dismissible and onDismiss provided', () => {
    const onDismiss = vi.fn()
    render(<ErrorDisplay error={mockError} dismissible={true} onDismiss={onDismiss} />)
    
    const dismissButton = screen.getByLabelText('Dismiss error')
    expect(dismissButton).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button is clicked', async () => {
    const onDismiss = vi.fn()
    render(<ErrorDisplay error={mockError} dismissible={true} onDismiss={onDismiss} />)
    
    const dismissButton = screen.getByLabelText('Dismiss error')
    fireEvent.click(dismissButton)
    
    await waitFor(() => {
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })
  })

  it('applies custom className', () => {
    render(<ErrorDisplay error={mockError} className="custom-class" />)
    
    const container = screen.getByText('Test Error').closest('div')
    expect(container).toHaveClass('custom-class')
  })

  it('handles missing optional fields gracefully', () => {
    const minimalError = {
      title: 'Minimal Error',
      message: 'Basic error message',
      severity: 'medium' as const
    }
    
    render(<ErrorDisplay error={minimalError} />)
    
    expect(screen.getByText('Minimal Error')).toBeInTheDocument()
    expect(screen.getByText('Basic error message')).toBeInTheDocument()
    expect(screen.queryByText('Suggestions:')).not.toBeInTheDocument()
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
  })
})

describe('NetworkErrorDisplay', () => {
  const mockError = new Error('Network timeout')

  it('renders network error with correct information', () => {
    render(<NetworkErrorDisplay error={mockError} />)
    
    expect(screen.getByText('Network Error')).toBeInTheDocument()
    expect(screen.getByText('Unable to connect to the server. Please check your internet connection and try again.')).toBeInTheDocument()
    expect(screen.getByText('NETWORK_ERROR')).toBeInTheDocument()
    expect(screen.getByText('Check your internet connection')).toBeInTheDocument()
  })

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<NetworkErrorDisplay error={mockError} onRetry={onRetry} />)
    
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
  })
})

describe('ValidationErrorDisplay', () => {
  const mockErrors = ['Name is required', 'Email is invalid']

  it('renders validation errors with correct information', () => {
    render(<ValidationErrorDisplay errors={mockErrors} />)
    
    expect(screen.getByText('Validation Error')).toBeInTheDocument()
    expect(screen.getByText('Please correct the following issues:')).toBeInTheDocument()
    expect(screen.getByText('Name is required')).toBeInTheDocument()
    expect(screen.getByText('Email is invalid')).toBeInTheDocument()
  })

  it('shows retry button when onRetry provided', () => {
    const onRetry = vi.fn()
    render(<ValidationErrorDisplay errors={mockErrors} onRetry={onRetry} />)
    
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
  })
})

describe('PermissionErrorDisplay', () => {
  const mockError = new Error('Access denied')

  it('renders permission error with correct information', () => {
    render(<PermissionErrorDisplay error={mockError} />)
    
    expect(screen.getByText('Permission Denied')).toBeInTheDocument()
    expect(screen.getByText('You do not have permission to perform this action.')).toBeInTheDocument()
    expect(screen.getByText('PERMISSION_DENIED')).toBeInTheDocument()
    expect(screen.getByText('Check if you are logged in')).toBeInTheDocument()
  })
})

describe('ServerErrorDisplay', () => {
  const mockError = new Error('Internal server error')

  it('renders server error with correct information', () => {
    render(<ServerErrorDisplay error={mockError} />)
    
    expect(screen.getByText('Server Error')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong on our end. We are working to fix this issue.')).toBeInTheDocument()
    expect(screen.getByText('SERVER_ERROR')).toBeInTheDocument()
    expect(screen.getByText('Try again in a few minutes')).toBeInTheDocument()
  })
})

describe('FormErrorDisplay', () => {
  const mockFieldErrors = {
    name: ['Name is required'],
    email: ['Email is invalid', 'Email must be unique']
  }
  const mockGeneralErrors = ['Form submission failed']

  it('renders form errors with correct information', () => {
    render(<FormErrorDisplay fieldErrors={mockFieldErrors} generalErrors={mockGeneralErrors} />)
    
    expect(screen.getByText('Form Validation Errors')).toBeInTheDocument()
    expect(screen.getByText('Please correct the following issues:')).toBeInTheDocument()
    expect(screen.getByText('name: Name is required')).toBeInTheDocument()
    expect(screen.getByText('email: Email is invalid')).toBeInTheDocument()
    expect(screen.getByText('email: Email must be unique')).toBeInTheDocument()
    expect(screen.getByText('Form submission failed')).toBeInTheDocument()
  })

  it('renders only field errors when no general errors', () => {
    render(<FormErrorDisplay fieldErrors={mockFieldErrors} />)
    
    expect(screen.getByText('Form Validation Errors')).toBeInTheDocument()
    expect(screen.queryByText('Form submission failed')).not.toBeInTheDocument()
  })

  it('renders nothing when no errors', () => {
    const { container } = render(<FormErrorDisplay fieldErrors={{}} />)
    
    expect(container.firstChild).toBeNull()
  })
})

describe('APIErrorDisplay', () => {
  it('renders 404 error correctly', () => {
    render(<APIErrorDisplay status={404} statusText="Not Found" />)
    
    expect(screen.getByText('Not Found')).toBeInTheDocument()
    expect(screen.getByText('HTTP 404: Not Found')).toBeInTheDocument()
    expect(screen.getByText('Check the URL for typos')).toBeInTheDocument()
  })

  it('renders 500 error correctly', () => {
    render(<APIErrorDisplay status={500} statusText="Internal Server Error" />)
    
    expect(screen.getByText('Server Error')).toBeInTheDocument()
    expect(screen.getByText('HTTP 500: Internal Server Error')).toBeInTheDocument()
    expect(screen.getByText('Try again in a few minutes')).toBeInTheDocument()
  })

  it('renders 403 error correctly', () => {
    render(<APIErrorDisplay status={403} statusText="Forbidden" />)
    
    expect(screen.getByText('Forbidden')).toBeInTheDocument()
    expect(screen.getByText('HTTP 403: Forbidden')).toBeInTheDocument()
    expect(screen.getByText('Check if you are logged in')).toBeInTheDocument()
  })

  it('shows retry button for retryable errors', () => {
    const onRetry = vi.fn()
    render(<APIErrorDisplay status={500} statusText="Internal Server Error" onRetry={onRetry} />)
    
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
  })

  it('does not show retry button for non-retryable errors', () => {
    const onRetry = vi.fn()
    render(<APIErrorDisplay status={400} statusText="Bad Request" onRetry={onRetry} />)
    
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
  })
})
