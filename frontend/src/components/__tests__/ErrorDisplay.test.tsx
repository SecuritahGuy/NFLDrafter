import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  ErrorDisplay, 
  NetworkErrorDisplay, 
  ValidationErrorDisplay, 
  PermissionErrorDisplay, 
  ServerErrorDisplay, 
  FormErrorDisplay, 
  APIErrorDisplay 
} from '../ErrorDisplay'

// Mock RetryButton component
vi.mock('../RetryButton', () => ({
  RetryButton: ({ onRetry, children, variant, size, maxRetries, retryDelay }: any) => (
    <button 
      onClick={onRetry} 
      data-testid="retry-button"
      data-variant={variant}
      data-size={size}
      data-max-retries={maxRetries}
      data-retry-delay={retryDelay}
    >
      {children}
    </button>
  )
}))

describe('ErrorDisplay', () => {
  const mockError = {
    title: 'Test Error',
    message: 'This is a test error message',
    severity: 'medium' as const,
    code: 'TEST_ERROR',
    details: 'Technical details about the error',
    suggestions: ['Suggestion 1', 'Suggestion 2'],
    timestamp: new Date('2024-01-01T12:00:00Z'),
    retryable: true,
    onRetry: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders error with all information', () => {
      render(<ErrorDisplay error={mockError} />)
      
      expect(screen.getByText('Test Error')).toBeInTheDocument()
      expect(screen.getByText('This is a test error message')).toBeInTheDocument()
      expect(screen.getByText('TEST_ERROR')).toBeInTheDocument()
      expect(screen.getByText('Technical details about the error')).toBeInTheDocument()
      expect(screen.getByText('Suggestion 1')).toBeInTheDocument()
      expect(screen.getByText('Suggestion 2')).toBeInTheDocument()
    })

    it('renders with minimal error info', () => {
      const minimalError = {
        title: 'Minimal Error',
        message: 'Minimal message',
        severity: 'low' as const
      }
      
      render(<ErrorDisplay error={minimalError} />)
      
      expect(screen.getByText('Minimal Error')).toBeInTheDocument()
      expect(screen.getByText('Minimal message')).toBeInTheDocument()
    })
  })

  describe('Severity Levels', () => {
    it('renders low severity with blue styling', () => {
      const lowError = { ...mockError, severity: 'low' as const }
      render(<ErrorDisplay error={lowError} />)
      
      const container = screen.getByText('Test Error').closest('div')?.parentElement?.parentElement?.parentElement
      expect(container).toHaveClass('bg-blue-50', 'border-blue-200', 'text-blue-800')
    })

    it('renders medium severity with yellow styling', () => {
      const mediumError = { ...mockError, severity: 'medium' as const }
      render(<ErrorDisplay error={mediumError} />)
      
      const container = screen.getByText('Test Error').closest('div')?.parentElement?.parentElement?.parentElement
      expect(container).toHaveClass('bg-yellow-50', 'border-yellow-200', 'text-yellow-800')
    })

    it('renders high severity with orange styling', () => {
      const highError = { ...mockError, severity: 'high' as const }
      render(<ErrorDisplay error={highError} />)
      
      const container = screen.getByText('Test Error').closest('div')?.parentElement?.parentElement?.parentElement
      expect(container).toHaveClass('bg-orange-50', 'border-orange-200', 'text-orange-800')
    })

    it('renders critical severity with red styling', () => {
      const criticalError = { ...mockError, severity: 'critical' as const }
      render(<ErrorDisplay error={criticalError} />)
      
      const container = screen.getByText('Test Error').closest('div')?.parentElement?.parentElement?.parentElement
      expect(container).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800')
    })
  })

  describe('Display Options', () => {
    it('hides code when showCode is false', () => {
      render(<ErrorDisplay error={mockError} showCode={false} />)
      
      expect(screen.queryByText('TEST_ERROR')).not.toBeInTheDocument()
    })

    it('hides timestamp when showTimestamp is false', () => {
      render(<ErrorDisplay error={mockError} showTimestamp={false} />)
      
      expect(screen.queryByText(/Jan 1, 2024/)).not.toBeInTheDocument()
    })

    it('hides details when showDetails is false', () => {
      render(<ErrorDisplay error={mockError} showDetails={false} />)
      
      expect(screen.queryByText('Technical details about the error')).not.toBeInTheDocument()
    })

    it('hides suggestions when showSuggestions is false', () => {
      render(<ErrorDisplay error={mockError} showSuggestions={false} />)
      
      expect(screen.queryByText('Suggestion 1')).not.toBeInTheDocument()
      expect(screen.queryByText('Suggestion 2')).not.toBeInTheDocument()
    })

    it('hides retry button when showRetry is false', () => {
      render(<ErrorDisplay error={mockError} showRetry={false} />)
      
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
    })
  })

  describe('Dismissible Errors', () => {
    it('shows dismiss button when dismissible is true', () => {
      const onDismiss = vi.fn()
      render(<ErrorDisplay error={mockError} dismissible={true} onDismiss={onDismiss} />)
      
      const dismissButton = screen.getByRole('button', { name: 'Dismiss error' })
      expect(dismissButton).toBeInTheDocument()
    })

    it('calls onDismiss when dismiss button is clicked', async () => {
      const user = userEvent.setup()
      const onDismiss = vi.fn()
      render(<ErrorDisplay error={mockError} dismissible={true} onDismiss={onDismiss} />)
      
      const dismissButton = screen.getByRole('button', { name: 'Dismiss error' })
      await user.click(dismissButton)
      
      expect(onDismiss).toHaveBeenCalledTimes(1)
    })

    it('does not show dismiss button when dismissible is false', () => {
      render(<ErrorDisplay error={mockError} dismissible={false} />)
      
      expect(screen.queryByRole('button', { name: 'Dismiss error' })).not.toBeInTheDocument()
    })
  })

  describe('Retry Functionality', () => {
    it('shows retry button when error is retryable and onRetry is provided', () => {
      render(<ErrorDisplay error={mockError} />)
      
      const retryButton = screen.getByTestId('retry-button')
      expect(retryButton).toBeInTheDocument()
      expect(retryButton).toHaveTextContent('Try Again')
    })

    it('does not show retry button when error is not retryable', () => {
      const nonRetryableError = { ...mockError, retryable: false }
      render(<ErrorDisplay error={nonRetryableError} />)
      
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
    })

    it('does not show retry button when onRetry is not provided', () => {
      const errorWithoutRetry = { ...mockError, onRetry: undefined }
      render(<ErrorDisplay error={errorWithoutRetry} />)
      
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
    })

    it('calls onRetry when retry button is clicked', async () => {
      const user = userEvent.setup()
      render(<ErrorDisplay error={mockError} />)
      
      const retryButton = screen.getByTestId('retry-button')
      await user.click(retryButton)
      
      expect(mockError.onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('Details Expansion', () => {
    it('shows details in collapsible section', () => {
      render(<ErrorDisplay error={mockError} />)
      
      const detailsSummary = screen.getByText('Technical Details')
      expect(detailsSummary).toBeInTheDocument()
      
      // Details should be hidden by default
      expect(screen.getByText('Technical details about the error')).not.toBeVisible()
    })

    it('expands details when summary is clicked', async () => {
      const user = userEvent.setup()
      render(<ErrorDisplay error={mockError} />)
      
      const detailsSummary = screen.getByText('Technical Details')
      await user.click(detailsSummary)
      
      // Details should now be visible
      expect(screen.getByText('Technical details about the error')).toBeVisible()
    })
  })

  describe('Timestamp Formatting', () => {
    it('formats timestamp correctly', () => {
      const errorWithTimestamp = { ...mockError, timestamp: new Date('2024-01-01T12:30:45Z') }
      render(<ErrorDisplay error={errorWithTimestamp} />)
      
      expect(screen.getByText(/Jan 1, 2024/)).toBeInTheDocument()
      expect(screen.getByText(/06:30:45 AM/)).toBeInTheDocument()
    })
  })
})

describe('NetworkErrorDisplay', () => {
  const mockError = new Error('Network connection failed')
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders network error with correct styling', () => {
    render(<NetworkErrorDisplay error={mockError} onRetry={mockOnRetry} />)
    
    expect(screen.getByText('Network Error')).toBeInTheDocument()
    expect(screen.getByText('Unable to connect to the server. Please check your internet connection and try again.')).toBeInTheDocument()
    
    const container = screen.getByText('Network Error').closest('div')?.parentElement?.parentElement?.parentElement
    expect(container).toHaveClass('bg-orange-50', 'border-orange-200', 'text-orange-800')
  })

  it('shows network-specific suggestions', () => {
    render(<NetworkErrorDisplay error={mockError} onRetry={mockOnRetry} />)
    
    expect(screen.getByText('Check your internet connection')).toBeInTheDocument()
    expect(screen.getByText('Verify the server is running')).toBeInTheDocument()
    expect(screen.getByText('Try refreshing the page')).toBeInTheDocument()
  })

  it('shows retry button', () => {
    render(<NetworkErrorDisplay error={mockError} onRetry={mockOnRetry} />)
    
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
  })
})

describe('ValidationErrorDisplay', () => {
  const mockErrors = ['Field is required', 'Invalid format']
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders validation error with correct styling', () => {
    render(<ValidationErrorDisplay errors={mockErrors} onRetry={mockOnRetry} />)
    
    expect(screen.getByText('Validation Error')).toBeInTheDocument()
    expect(screen.getByText('Please correct the following issues:')).toBeInTheDocument()
    
    const container = screen.getByText('Validation Error').closest('div')?.parentElement?.parentElement?.parentElement
    expect(container).toHaveClass('bg-yellow-50', 'border-yellow-200', 'text-yellow-800')
  })

  it('shows validation errors as suggestions', () => {
    render(<ValidationErrorDisplay errors={mockErrors} onRetry={mockOnRetry} />)
    
    expect(screen.getByText('Field is required')).toBeInTheDocument()
    expect(screen.getByText('Invalid format')).toBeInTheDocument()
  })

  it('shows retry button when onRetry is provided', () => {
    render(<ValidationErrorDisplay errors={mockErrors} onRetry={mockOnRetry} />)
    
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
  })

  it('does not show retry button when onRetry is not provided', () => {
    render(<ValidationErrorDisplay errors={mockErrors} />)
    
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
  })
})

describe('PermissionErrorDisplay', () => {
  const mockError = new Error('Access denied')
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders permission error with correct styling', () => {
    render(<PermissionErrorDisplay error={mockError} onRetry={mockOnRetry} />)
    
    expect(screen.getByText('Permission Denied')).toBeInTheDocument()
    expect(screen.getByText('You do not have permission to perform this action.')).toBeInTheDocument()
    
    const container = screen.getByText('Permission Denied').closest('div')?.parentElement?.parentElement?.parentElement
    expect(container).toHaveClass('bg-orange-50', 'border-orange-200', 'text-orange-800')
  })

  it('shows permission-specific suggestions', () => {
    render(<PermissionErrorDisplay error={mockError} onRetry={mockOnRetry} />)
    
    expect(screen.getByText('Check if you are logged in')).toBeInTheDocument()
    expect(screen.getByText('Verify your account has the required permissions')).toBeInTheDocument()
    expect(screen.getByText('Contact your administrator if you believe this is an error')).toBeInTheDocument()
  })
})

describe('ServerErrorDisplay', () => {
  const mockError = new Error('Internal server error')
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders server error with correct styling', () => {
    render(<ServerErrorDisplay error={mockError} onRetry={mockOnRetry} />)
    
    expect(screen.getByText('Server Error')).toBeInTheDocument()
    expect(screen.getByText('Something went wrong on our end. We are working to fix this issue.')).toBeInTheDocument()
    
    const container = screen.getByText('Server Error').closest('div')?.parentElement?.parentElement?.parentElement
    expect(container).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800')
  })

  it('shows server-specific suggestions', () => {
    render(<ServerErrorDisplay error={mockError} onRetry={mockOnRetry} />)
    
    expect(screen.getByText('Try again in a few minutes')).toBeInTheDocument()
    expect(screen.getByText('Check our status page for updates')).toBeInTheDocument()
    expect(screen.getByText('Contact support if the problem persists')).toBeInTheDocument()
  })

  it('shows retry button', () => {
    render(<ServerErrorDisplay error={mockError} onRetry={mockOnRetry} />)
    
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
  })
})

describe('FormErrorDisplay', () => {
  const mockFieldErrors = {
    email: ['Email is required', 'Invalid email format'],
    password: ['Password must be at least 8 characters']
  }
  const mockGeneralErrors = ['Form submission failed']

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders form validation errors', () => {
    render(<FormErrorDisplay fieldErrors={mockFieldErrors} generalErrors={mockGeneralErrors} />)
    
    expect(screen.getByText('Form Validation Errors')).toBeInTheDocument()
    expect(screen.getByText('Please correct the following issues:')).toBeInTheDocument()
  })

  it('shows field-specific errors', () => {
    render(<FormErrorDisplay fieldErrors={mockFieldErrors} generalErrors={mockGeneralErrors} />)
    
    expect(screen.getByText('email: Email is required')).toBeInTheDocument()
    expect(screen.getByText('email: Invalid email format')).toBeInTheDocument()
    expect(screen.getByText('password: Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('shows general errors', () => {
    render(<FormErrorDisplay fieldErrors={mockFieldErrors} generalErrors={mockGeneralErrors} />)
    
    expect(screen.getByText('Form submission failed')).toBeInTheDocument()
  })

  it('renders nothing when no errors', () => {
    const { container } = render(<FormErrorDisplay fieldErrors={{}} generalErrors={[]} />)
    
    expect(container.firstChild).toBeNull()
  })
})

describe('APIErrorDisplay', () => {
  const mockOnRetry = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('HTTP Status Codes', () => {
    it('renders 400 error correctly', () => {
      render(<APIErrorDisplay status={400} statusText="Bad Request" onRetry={mockOnRetry} />)
      
      expect(screen.getByText('Bad Request')).toBeInTheDocument()
      expect(screen.getByText('HTTP 400: Bad Request')).toBeInTheDocument()
      
      const container = screen.getByText('Bad Request').closest('div')?.parentElement?.parentElement?.parentElement
      expect(container).toHaveClass('bg-orange-50', 'border-orange-200', 'text-orange-800')
    })

    it('renders 401 error correctly', () => {
      render(<APIErrorDisplay status={401} statusText="Unauthorized" onRetry={mockOnRetry} />)
      
      expect(screen.getByText('Unauthorized')).toBeInTheDocument()
      expect(screen.getByText('Check if you are logged in')).toBeInTheDocument()
    })

    it('renders 403 error correctly', () => {
      render(<APIErrorDisplay status={403} statusText="Forbidden" onRetry={mockOnRetry} />)
      
      expect(screen.getByText('Forbidden')).toBeInTheDocument()
      expect(screen.getByText('Check if you are logged in')).toBeInTheDocument()
      expect(screen.getByText('Verify your account has the required permissions')).toBeInTheDocument()
    })

    it('renders 404 error correctly', () => {
      render(<APIErrorDisplay status={404} statusText="Not Found" onRetry={mockOnRetry} />)
      
      expect(screen.getByText('Not Found')).toBeInTheDocument()
      expect(screen.getByText('Check the URL for typos')).toBeInTheDocument()
    })

    it('renders 500 error correctly', () => {
      render(<APIErrorDisplay status={500} statusText="Internal Server Error" onRetry={mockOnRetry} />)
      
      expect(screen.getByText('Server Error')).toBeInTheDocument()
      expect(screen.getByText('Try again in a few minutes')).toBeInTheDocument()
      
      const container = screen.getByText('Server Error').closest('div')?.parentElement?.parentElement?.parentElement
      expect(container).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800')
    })
  })

  describe('Retry Logic', () => {
    it('shows retry button for 5xx errors', () => {
      render(<APIErrorDisplay status={500} statusText="Internal Server Error" onRetry={mockOnRetry} />)
      
      expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    })

    it('shows retry button for 429 errors', () => {
      render(<APIErrorDisplay status={429} statusText="Too Many Requests" onRetry={mockOnRetry} />)
      
      expect(screen.getByTestId('retry-button')).toBeInTheDocument()
    })

    it('does not show retry button for 4xx errors', () => {
      render(<APIErrorDisplay status={400} statusText="Bad Request" onRetry={mockOnRetry} />)
      
      expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
    })
  })

  describe('Custom Messages', () => {
    it('uses custom message when provided', () => {
      render(
        <APIErrorDisplay 
          status={400} 
          statusText="Bad Request" 
          message="Custom error message"
          onRetry={mockOnRetry} 
        />
      )
      
      expect(screen.getByText('Custom error message')).toBeInTheDocument()
    })

    it('falls back to default message when custom message is not provided', () => {
      render(<APIErrorDisplay status={400} statusText="Bad Request" onRetry={mockOnRetry} />)
      
      expect(screen.getByText('HTTP 400: Bad Request')).toBeInTheDocument()
    })
  })
})
