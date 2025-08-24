import React from 'react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  text?: string
  className?: string
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text = 'Loading...',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  }

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  }

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      <div className={`${sizeClasses[size]} animate-spin rounded-full border-4 border-gray-200 border-t-primary-600`}></div>
      {text && (
        <p className={`${textSizes[size]} text-gray-600 font-medium`}>
          {text}
        </p>
      )}
    </div>
  )
}

export const LoadingSkeleton: React.FC<{ 
  rows?: number
  className?: string 
}> = ({ rows = 3, className = '' }) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton skeleton-text"></div>
      ))}
    </div>
  )
}

export const LoadingCard: React.FC<{ 
  title?: string
  className?: string 
}> = ({ title = 'Loading...', className = '' }) => {
  return (
    <div className={`card ${className}`}>
      <div className="card-header">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="card-body">
        <LoadingSpinner size="lg" text="Loading data..." />
      </div>
    </div>
  )
}
