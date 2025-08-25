import React, { useState } from 'react'
import { LoadingSpinner } from './LoadingSpinner'

interface RetryButtonProps {
  onRetry: () => Promise<void> | void
  children: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  maxRetries?: number
  retryDelay?: number
  showRetryCount?: boolean
}

export const RetryButton: React.FC<RetryButtonProps> = ({
  onRetry,
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  maxRetries = 3,
  retryDelay = 1000,
  showRetryCount = true
}) => {
  const [loading, setLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const getVariantClasses = () => {
    const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
    
    switch (variant) {
      case 'primary':
        return `${baseClasses} bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 disabled:bg-primary-300`
      case 'secondary':
        return `${baseClasses} bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500 disabled:bg-gray-300`
      case 'outline':
        return `${baseClasses} border border-gray-300 text-gray-700 hover:bg-gray-50 focus:ring-primary-500 disabled:border-gray-200 disabled:text-gray-400`
      case 'ghost':
        return `${baseClasses} text-gray-700 hover:bg-gray-100 focus:ring-primary-500 disabled:text-gray-400`
      default:
        return `${baseClasses} bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500 disabled:bg-primary-300`
    }
  }

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm'
      case 'md':
        return 'px-4 py-2 text-sm'
      case 'lg':
        return 'px-6 py-3 text-base'
      default:
        return 'px-4 py-2 text-sm'
    }
  }

  const handleRetry = async () => {
    if (loading || retryCount >= maxRetries) return

    setLoading(true)
    setError(null)

    try {
      await onRetry()
      // Reset retry count on success
      setRetryCount(0)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      setRetryCount(prev => prev + 1)
      
      // Auto-retry after delay if retries remaining
      if (retryCount + 1 < maxRetries) {
        setTimeout(() => {
          handleRetry()
        }, retryDelay)
      }
    } finally {
      setLoading(false)
    }
  }

  const isMaxRetriesReached = retryCount >= maxRetries
  const isDisabled = disabled || loading || isMaxRetriesReached

  return (
    <div className="space-y-2">
      <button
        onClick={handleRetry}
        disabled={isDisabled}
        className={`${getVariantClasses()} ${getSizeClasses()} ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner size="sm" variant="default" className="mr-2" />
            Retrying...
          </>
        ) : (
          children
        )}
      </button>
      
      {showRetryCount && retryCount > 0 && (
        <div className="text-sm text-gray-600">
          Attempt {retryCount} of {maxRetries}
        </div>
      )}
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
          {!isMaxRetriesReached && (
            <span className="ml-2 text-gray-500">
              Retrying automatically...
            </span>
          )}
        </div>
      )}
      
      {isMaxRetriesReached && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          Maximum retries reached. Please try again later or contact support.
        </div>
      )}
    </div>
  )
}

// Specialized retry button for API calls
export const APIRetryButton: React.FC<{
  apiCall: () => Promise<any>
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  children: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  maxRetries?: number
  retryDelay?: number
}> = ({
  apiCall,
  onSuccess,
  onError,
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  maxRetries = 3,
  retryDelay = 1000
}) => {
  const handleRetry = async () => {
    try {
      const result = await apiCall()
      if (onSuccess) {
        onSuccess(result)
      }
    } catch (error) {
      if (onError && error instanceof Error) {
        onError(error)
      }
      throw error
    }
  }

  return (
    <RetryButton
      onRetry={handleRetry}
      className={className}
      variant={variant}
      size={size}
      disabled={disabled}
      maxRetries={maxRetries}
      retryDelay={retryDelay}
    >
      {children}
    </RetryButton>
  )
}

// Retry button with exponential backoff
export const ExponentialBackoffRetryButton: React.FC<{
  onRetry: () => Promise<void> | void
  children: React.ReactNode
  className?: string
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  disabled?: boolean
  maxRetries?: number
  baseDelay?: number
  maxDelay?: number
}> = ({
  onRetry,
  children,
  className = '',
  variant = 'primary',
  size = 'md',
  disabled = false,
  maxRetries = 3,
  baseDelay = 1000,
  maxDelay = 30000
}) => {
  const [loading, setLoading] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const calculateDelay = (attempt: number) => {
    const delay = baseDelay * Math.pow(2, attempt)
    return Math.min(delay, maxDelay)
  }

  const handleRetry = async () => {
    if (loading || retryCount >= maxRetries) return

    setLoading(true)
    setError(null)

    try {
      await onRetry()
      setRetryCount(0)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      setRetryCount(prev => prev + 1)
      
      // Auto-retry with exponential backoff if retries remaining
      if (retryCount + 1 < maxRetries) {
        const delay = calculateDelay(retryCount)
        setTimeout(() => {
          handleRetry()
        }, delay)
      }
    } finally {
      setLoading(false)
    }
  }

  const isMaxRetriesReached = retryCount >= maxRetries
  const isDisabled = disabled || loading || isMaxRetriesReached

  return (
    <div className="space-y-2">
      <button
        onClick={handleRetry}
        disabled={isDisabled}
        className={`inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${className}`}
      >
        {loading ? (
          <>
            <LoadingSpinner size="sm" variant="default" className="mr-2" />
            Retrying...
          </>
        ) : (
          children
        )}
      </button>
      
      {retryCount > 0 && (
        <div className="text-sm text-gray-600">
          Attempt {retryCount} of {maxRetries}
          {retryCount < maxRetries && (
            <span className="ml-2 text-gray-500">
              Next retry in {Math.round(calculateDelay(retryCount - 1) / 1000)}s
            </span>
          )}
        </div>
      )}
      
      {error && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          {error}
        </div>
      )}
      
      {isMaxRetriesReached && (
        <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
          Maximum retries reached. Please try again later or contact support.
        </div>
      )}
    </div>
  )
}
