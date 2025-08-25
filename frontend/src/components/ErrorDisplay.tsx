import React from 'react'
import { ExclamationTriangleIcon, XCircleIcon, InformationCircleIcon } from '@heroicons/react/24/outline'
import { RetryButton } from './RetryButton'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ErrorInfo {
  title: string
  message: string
  severity: ErrorSeverity
  code?: string
  details?: string
  suggestions?: string[]
  timestamp?: Date
  retryable?: boolean
  onRetry?: () => Promise<void> | void
}

interface ErrorDisplayProps {
  error: ErrorInfo
  className?: string
  showTimestamp?: boolean
  showCode?: boolean
  showDetails?: boolean
  showSuggestions?: boolean
  showRetry?: boolean
  onDismiss?: () => void
  dismissible?: boolean
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  error,
  className = '',
  showTimestamp = true,
  showCode = true,
  showDetails = true,
  showSuggestions = true,
  showRetry = true,
  onDismiss,
  dismissible = false
}) => {
  const getSeverityStyles = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'low':
        return {
          container: 'bg-blue-50 border-blue-200 text-blue-800',
          icon: 'text-blue-500',
          title: 'text-blue-900'
        }
      case 'medium':
        return {
          container: 'bg-yellow-50 border-yellow-200 text-yellow-800',
          icon: 'text-yellow-500',
          title: 'text-yellow-900'
        }
      case 'high':
        return {
          container: 'bg-orange-50 border-orange-200 text-orange-800',
          icon: 'text-orange-500',
          title: 'text-orange-900'
        }
      case 'critical':
        return {
          container: 'bg-red-50 border-red-200 text-red-800',
          icon: 'text-red-500',
          title: 'text-red-900'
        }
      default:
        return {
          container: 'bg-gray-50 border-gray-200 text-gray-800',
          icon: 'text-gray-500',
          title: 'text-gray-900'
        }
    }
  }

  const getSeverityIcon = (severity: ErrorSeverity) => {
    switch (severity) {
      case 'low':
        return <InformationCircleIcon className="w-5 h-5" />
      case 'medium':
        return <ExclamationTriangleIcon className="w-5 h-5" />
      case 'high':
        return <ExclamationTriangleIcon className="w-5 h-5" />
      case 'critical':
        return <XCircleIcon className="w-5 h-5" />
      default:
        return <ExclamationTriangleIcon className="w-5 h-5" />
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const styles = getSeverityStyles(error.severity)

  return (
    <div className={`border rounded-lg p-4 ${styles.container} ${className}`}>
      <div className="flex items-start space-x-3">
        <div className={`flex-shrink-0 ${styles.icon}`}>
          {getSeverityIcon(error.severity)}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <h3 className={`text-sm font-medium ${styles.title}`}>
              {error.title}
            </h3>
            
            {dismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-3 flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Dismiss error"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          
          <p className="mt-1 text-sm">{error.message}</p>
          
          {showCode && error.code && (
            <div className="mt-2">
              <code className="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-gray-100 text-gray-800">
                {error.code}
              </code>
            </div>
          )}
          
          {showTimestamp && error.timestamp && (
            <div className="mt-2 text-xs opacity-75">
              {formatTimestamp(error.timestamp)}
            </div>
          )}
          
          {showDetails && error.details && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium hover:opacity-75 transition-opacity">
                Technical Details
              </summary>
              <div className="mt-2 p-3 bg-white bg-opacity-50 rounded text-sm font-mono whitespace-pre-wrap">
                {error.details}
              </div>
            </details>
          )}
          
          {showSuggestions && error.suggestions && error.suggestions.length > 0 && (
            <div className="mt-3">
              <h4 className="text-sm font-medium mb-2">Suggestions:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {error.suggestions.map((suggestion, index) => (
                  <li key={index}>{suggestion}</li>
                ))}
              </ul>
            </div>
          )}
          
          {showRetry && error.retryable && error.onRetry && (
            <div className="mt-4">
              <RetryButton
                onRetry={error.onRetry}
                variant="outline"
                size="sm"
                maxRetries={3}
                retryDelay={2000}
              >
                Try Again
              </RetryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Specialized error displays for common scenarios
export const NetworkErrorDisplay: React.FC<{
  error: Error
  onRetry?: () => Promise<void> | void
  className?: string
}> = ({ error, onRetry, className = '' }) => {
  const errorInfo: ErrorInfo = {
    title: 'Network Error',
    message: 'Unable to connect to the server. Please check your internet connection and try again.',
    severity: 'high',
    code: 'NETWORK_ERROR',
    details: error.message,
    suggestions: [
      'Check your internet connection',
      'Verify the server is running',
      'Try refreshing the page',
      'Check if there are any firewall restrictions'
    ],
    timestamp: new Date(),
    retryable: true,
    onRetry
  }

  return <ErrorDisplay error={errorInfo} className={className} />
}

export const ValidationErrorDisplay: React.FC<{
  errors: string[]
  onRetry?: () => Promise<void> | void
  className?: string
}> = ({ errors, onRetry, className = '' }) => {
  const errorInfo: ErrorInfo = {
    title: 'Validation Error',
    message: 'Please correct the following issues:',
    severity: 'medium',
    code: 'VALIDATION_ERROR',
    suggestions: errors,
    timestamp: new Date(),
    retryable: !!onRetry,
    onRetry
  }

  return <ErrorDisplay error={errorInfo} className={className} />
}

export const PermissionErrorDisplay: React.FC<{
  error: Error
  onRetry?: () => Promise<void> | void
  className?: string
}> = ({ error, onRetry, className = '' }) => {
  const errorInfo: ErrorInfo = {
    title: 'Permission Denied',
    message: 'You do not have permission to perform this action.',
    severity: 'high',
    code: 'PERMISSION_DENIED',
    details: error.message,
    suggestions: [
      'Check if you are logged in',
      'Verify your account has the required permissions',
      'Contact your administrator if you believe this is an error',
      'Try refreshing the page'
    ],
    timestamp: new Date(),
    retryable: !!onRetry,
    onRetry
  }

  return <ErrorDisplay error={errorInfo} className={className} />
}

export const ServerErrorDisplay: React.FC<{
  error: Error
  onRetry?: () => Promise<void> | void
  className?: string
}> = ({ error, onRetry, className = '' }) => {
  const errorInfo: ErrorInfo = {
    title: 'Server Error',
    message: 'Something went wrong on our end. We are working to fix this issue.',
    severity: 'critical',
    code: 'SERVER_ERROR',
    details: error.message,
    suggestions: [
      'Try again in a few minutes',
      'Check our status page for updates',
      'Contact support if the problem persists',
      'Try refreshing the page'
    ],
    timestamp: new Date(),
    retryable: true,
    onRetry
  }

  return <ErrorDisplay error={errorInfo} className={className} />
}

// Error display for form validation
export const FormErrorDisplay: React.FC<{
  fieldErrors: Record<string, string[]>
  generalErrors?: string[]
  className?: string
}> = ({ fieldErrors, generalErrors = [], className = '' }) => {
  const allErrors = Object.entries(fieldErrors).flatMap(([field, errors]) =>
    errors.map(error => `${field}: ${error}`)
  ).concat(generalErrors)

  if (allErrors.length === 0) return null

  const errorInfo: ErrorInfo = {
    title: 'Form Validation Errors',
    message: 'Please correct the following issues:',
    severity: 'medium',
    code: 'FORM_VALIDATION_ERROR',
    suggestions: allErrors,
    timestamp: new Date(),
    retryable: false
  }

  return <ErrorDisplay error={errorInfo} className={className} />
}

// Error display for API responses
export const APIErrorDisplay: React.FC<{
  status: number
  statusText: string
  message?: string
  onRetry?: () => Promise<void> | void
  className?: string
}> = ({ status, statusText, message, onRetry, className = '' }) => {
  const getSeverity = (status: number): ErrorSeverity => {
    if (status >= 500) return 'critical'
    if (status >= 400) return 'high'
    if (status >= 300) return 'medium'
    return 'low'
  }

  const getTitle = (status: number): string => {
    if (status >= 500) return 'Server Error'
    if (status === 404) return 'Not Found'
    if (status === 403) return 'Forbidden'
    if (status === 401) return 'Unauthorized'
    if (status === 400) return 'Bad Request'
    return 'API Error'
  }

  const getSuggestions = (status: number): string[] => {
    if (status >= 500) {
      return [
        'Try again in a few minutes',
        'Check our status page for updates',
        'Contact support if the problem persists'
      ]
    }
    if (status === 404) {
      return [
        'Check the URL for typos',
        'Navigate back to the previous page',
        'Use the search function to find what you need'
      ]
    }
    if (status === 403) {
      return [
        'Check if you are logged in',
        'Verify your account has the required permissions',
        'Contact your administrator'
      ]
    }
    if (status === 401) {
      return [
        'Check if you are logged in',
        'Try logging out and logging back in',
        'Clear your browser cookies and cache'
      ]
    }
    if (status === 400) {
      return [
        'Check your input for errors',
        'Verify all required fields are filled',
        'Ensure data is in the correct format'
      ]
    }
    return ['Try refreshing the page', 'Contact support if the problem persists']
  }

  const errorInfo: ErrorInfo = {
    title: getTitle(status),
    message: message || `HTTP ${status}: ${statusText}`,
    severity: getSeverity(status),
    code: `HTTP_${status}`,
    details: `Status: ${status} ${statusText}`,
    suggestions: getSuggestions(status),
    timestamp: new Date(),
    retryable: status >= 500 || status === 429,
    onRetry
  }

  return <ErrorDisplay error={errorInfo} className={className} />
}
