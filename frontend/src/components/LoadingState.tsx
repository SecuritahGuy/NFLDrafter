import React from 'react'
import { LoadingSpinner } from './LoadingSpinner'
import { Skeleton, SkeletonTable } from './Skeleton'

export type LoadingType = 'spinner' | 'skeleton' | 'progress' | 'dots' | 'pulse'

export interface LoadingStateProps {
  loading: boolean
  children: React.ReactNode
  type?: LoadingType
  message?: string
  subMessage?: string
  className?: string
  overlay?: boolean
  minHeight?: string
  showProgress?: boolean
  progress?: number
  progressLabel?: string
  skeletonRows?: number
  skeletonColumns?: number
  fallback?: React.ReactNode
  error?: Error | null
  onRetry?: () => void
  retryLabel?: string
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  loading,
  children,
  type = 'spinner',
  message = 'Loading...',
  subMessage,
  className = '',
  overlay = false,
  minHeight = '200px',
  showProgress = false,
  progress,
  progressLabel,
  skeletonRows = 5,
  skeletonColumns = 4,
  fallback,
  error,
  onRetry,
  retryLabel = 'Try Again'
}) => {
  if (error) {
    return (
      <div className={`text-center py-8 ${className}`}>
        <div className="text-red-600 mb-4">
          <svg className="mx-auto h-12 w-12 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
        <p className="text-gray-600 mb-4">{error.message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="btn btn-primary"
          >
            {retryLabel}
          </button>
        )}
      </div>
    )
  }

  if (!loading) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  const renderLoadingContent = () => {
    switch (type) {
      case 'spinner':
        return (
          <div className="text-center">
            <LoadingSpinner size="lg" variant="primary" />
            <p className="mt-4 text-gray-600">{message}</p>
            {subMessage && (
              <p className="mt-2 text-sm text-gray-500">{subMessage}</p>
            )}
          </div>
        )
      
      case 'skeleton':
        return (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-gray-600">{message}</p>
              {subMessage && (
                <p className="text-sm text-gray-500">{subMessage}</p>
              )}
            </div>
            <SkeletonTable rows={skeletonRows} columns={skeletonColumns} />
          </div>
        )
      
      case 'progress':
        return (
          <div className="text-center">
            <div className="w-full max-w-md mx-auto">
              <div className="mb-4">
                <p className="text-gray-600">{message}</p>
                {subMessage && (
                  <p className="text-sm text-gray-500">{subMessage}</p>
                )}
              </div>
              
              {showProgress && progress !== undefined && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>{progressLabel || 'Progress'}</span>
                    <span data-testid="progress-percentage">{Math.round(progress)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}
              
              <LoadingSpinner size="md" variant="primary" />
            </div>
          </div>
        )
      
      case 'dots':
        return (
          <div className="text-center">
            <div className="flex justify-center space-x-1 mb-4" data-testid="loading-dots">
              <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <p className="text-gray-600">{message}</p>
            {subMessage && (
              <p className="text-sm text-gray-500">{subMessage}</p>
            )}
          </div>
        )
      
      case 'pulse':
        return (
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-600 rounded-full mx-auto mb-4 animate-pulse" data-testid="pulse-animation" />
            <p className="text-gray-600">{message}</p>
            {subMessage && (
              <p className="text-sm text-gray-500">{subMessage}</p>
            )}
          </div>
        )
      
      default:
        return (
          <div className="text-center">
            <LoadingSpinner size="lg" variant="primary" />
            <p className="mt-4 text-gray-600">{message}</p>
            {subMessage && (
              <p className="text-sm text-gray-500">{subMessage}</p>
            )}
          </div>
        )
    }
  }

  if (overlay) {
    return (
      <div className={`relative ${className}`}>
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          {renderLoadingContent()}
        </div>
        <div className="opacity-50 pointer-events-none">
          {children}
        </div>
      </div>
    )
  }

  return (
    <div 
      className={`flex items-center justify-center ${className}`}
      style={{ minHeight }}
    >
      {renderLoadingContent()}
    </div>
  )
}

// Specialized loading states for common scenarios
export const TableLoadingState: React.FC<{
  loading: boolean
  children: React.ReactNode
  rows?: number
  columns?: number
  message?: string
  className?: string
}> = ({ loading, children, rows = 5, columns = 4, message = 'Loading data...', className = '' }) => (
  <LoadingState
    loading={loading}
    type="skeleton"
    message={message}
    skeletonRows={rows}
    skeletonColumns={columns}
    className={className}
  >
    {children}
  </LoadingState>
)

export const CardLoadingState: React.FC<{
  loading: boolean
  children: React.ReactNode
  message?: string
  className?: string
}> = ({ loading, children, message = 'Loading...', className = '' }) => (
  <LoadingState
    loading={loading}
    type="spinner"
    message={message}
    className={className}
    minHeight="300px"
  >
    {children}
  </LoadingState>
)

export const PageLoadingState: React.FC<{
  loading: boolean
  children: React.ReactNode
  message?: string
  subMessage?: string
  className?: string
}> = ({ loading, children, message = 'Loading page...', subMessage, className = '' }) => (
  <LoadingState
    loading={loading}
    type="spinner"
    message={message}
    subMessage={subMessage}
    className={className}
    minHeight="400px"
  >
    {children}
  </LoadingState>
)

export const InlineLoadingState: React.FC<{
  loading: boolean
  children: React.ReactNode
  message?: string
  className?: string
}> = ({ loading, children, message = 'Loading...', className = '' }) => (
  <LoadingState
    loading={loading}
    type="dots"
    message={message}
    className={className}
    minHeight="auto"
  >
    {children}
  </LoadingState>
)

export const ProgressLoadingState: React.FC<{
  loading: boolean
  children: React.ReactNode
  progress: number
  message?: string
  progressLabel?: string
  className?: string
}> = ({ loading, children, progress, message = 'Processing...', progressLabel, className = '' }) => (
  <LoadingState
    loading={loading}
    type="progress"
    message={message}
    showProgress={true}
    progress={progress}
    progressLabel={progressLabel}
    className={className}
    minHeight="200px"
  >
    {children}
  </LoadingState>
)

// Loading state with error boundary
export const LoadingStateWithError: React.FC<{
  loading: boolean
  children: React.ReactNode
  error: Error | null
  onRetry: () => void
  type?: LoadingType
  message?: string
  subMessage?: string
  className?: string
  retryLabel?: string
}> = ({ 
  loading, 
  children, 
  error, 
  onRetry, 
  type = 'spinner', 
  message = 'Loading...', 
  subMessage, 
  className = '', 
  retryLabel = 'Try Again' 
}) => (
  <LoadingState
    loading={loading}
    error={error}
    onRetry={onRetry}
    type={type}
    message={message}
    subMessage={subMessage}
    className={className}
    retryLabel={retryLabel}
  >
    {children}
  </LoadingState>
)

// Loading state with custom fallback
export const LoadingStateWithFallback: React.FC<{
  loading: boolean
  children: React.ReactNode
  fallback: React.ReactNode
  className?: string
}> = ({ loading, children, fallback, className = '' }) => (
  <LoadingState
    loading={loading}
    fallback={fallback}
    className={className}
  >
    {children}
  </LoadingState>
)
