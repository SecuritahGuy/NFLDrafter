import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'
  className?: string
  text?: string
  overlay?: boolean
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  className = '',
  text,
  overlay = false
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'w-4 h-4'
      case 'md':
        return 'w-6 h-6'
      case 'lg':
        return 'w-8 h-8'
      case 'xl':
        return 'w-12 h-12'
      default:
        return 'w-6 h-6'
    }
  }

  const getVariantClasses = () => {
    switch (variant) {
      case 'primary':
        return 'text-primary-600'
      case 'secondary':
        return 'text-gray-600'
      case 'success':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'error':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const spinner = (
    <div className={`flex flex-col items-center justify-center ${className}`}>
      <svg
        className={`animate-spin ${getSizeClasses()} ${getVariantClasses()}`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      {text && (
        <p className="mt-2 text-sm text-gray-600 text-center">{text}</p>
      )}
    </div>
  )

  if (overlay) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        {spinner}
      </div>
    )
  }

  return spinner
}

// Predefined loading components for common use cases
export const LoadingButton: React.FC<{ 
  loading?: boolean
  children: React.ReactNode
  className?: string
  disabled?: boolean
}> = ({ loading = false, children, className = '', disabled = false }) => (
  <button
    className={`relative ${className}`}
    disabled={disabled || loading}
  >
    {loading && (
      <div className="absolute inset-0 flex items-center justify-center">
        <LoadingSpinner size="sm" variant="primary" />
      </div>
    )}
    <span className={loading ? 'opacity-0' : ''}>
      {children}
    </span>
  </button>
)

export const LoadingCard: React.FC<{ 
  loading?: boolean
  children: React.ReactNode
  className?: string
  skeleton?: React.ReactNode
}> = ({ loading = false, children, className = '', skeleton }) => (
  <div className={className}>
    {loading ? (
      skeleton || (
        <div className="p-6 space-y-4">
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-gray-200 rounded-full animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-200 rounded animate-pulse w-1/2" />
            </div>
          </div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-5/6" />
            <div className="h-4 bg-gray-200 rounded animate-pulse w-4/6" />
          </div>
        </div>
      )
    ) : (
      children
    )}
  </div>
)

export const LoadingTable: React.FC<{ 
  loading?: boolean
  children: React.ReactNode
  rows?: number
  columns?: number
  className?: string
}> = ({ loading = false, children, rows = 5, columns = 4, className = '' }) => (
  <div className={className}>
    {loading ? (
      <div className="space-y-3">
        {/* Header skeleton */}
        <div className="flex space-x-4">
          {Array.from({ length: columns }).map((_, i) => (
            <div key={i} className="flex-1 h-6 bg-gray-200 rounded animate-pulse" />
          ))}
        </div>
        
        {/* Row skeletons */}
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div key={rowIndex} className="flex space-x-4">
            {Array.from({ length: columns }).map((_, colIndex) => (
              <div
                key={colIndex}
                className={`h-4 bg-gray-200 rounded animate-pulse ${
                  colIndex === 0 ? 'w-1/3' : 'flex-1'
                }`}
              />
            ))}
          </div>
        ))}
      </div>
    ) : (
      children
    )}
  </div>
)

export const LoadingPage: React.FC<{ 
  text?: string
  className?: string
}> = ({ text = 'Loading...', className = '' }) => (
  <div className={`min-h-screen flex items-center justify-center ${className}`}>
    <LoadingSpinner size="xl" text={text} />
  </div>
)

export const LoadingInline: React.FC<{ 
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'primary' | 'secondary'
  className?: string
}> = ({ size = 'sm', variant = 'default', className = '' }) => (
  <LoadingSpinner size={size} variant={variant} className={`inline-flex ${className}`} />
)
