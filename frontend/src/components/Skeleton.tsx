import React from 'react'

interface SkeletonProps {
  className?: string
  width?: string | number
  height?: string | number
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  animated?: boolean
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className = '',
  width,
  height,
  rounded = 'md',
  animated = true
}) => {
  const getRoundedClass = () => {
    switch (rounded) {
      case 'none': return ''
      case 'sm': return 'rounded-sm'
      case 'md': return 'rounded-md'
      case 'lg': return 'rounded-lg'
      case 'full': return 'rounded-full'
      default: return 'rounded-md'
    }
  }

  const getWidthClass = () => {
    if (typeof width === 'number') {
      return `w-${width}`
    }
    if (typeof width === 'string') {
      return width
    }
    return 'w-full'
  }

  const getHeightClass = () => {
    if (typeof height === 'number') {
      return `h-${height}`
    }
    if (typeof height === 'string') {
      return height
    }
    return 'h-4'
  }

  return (
    <div
      className={`
        bg-gray-200 ${getRoundedClass()} ${getWidthClass()} ${getHeightClass()}
        ${animated ? 'animate-pulse' : ''}
        ${className}
      `}
    />
  )
}

// Predefined skeleton components for common use cases
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({
  lines = 1,
  className = ''
}) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton
        key={i}
        height={4}
        className={i === lines - 1 ? 'w-3/4' : 'w-full'}
      />
    ))}
  </div>
)

export const SkeletonAvatar: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClass = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }[size]

  return <Skeleton rounded="full" className={`${sizeClass} ${className}`} />
}

export const SkeletonCard: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`p-4 border border-gray-200 rounded-lg ${className}`}>
    <div className="flex items-center space-x-4 mb-4">
      <SkeletonAvatar size="md" />
      <div className="flex-1">
        <Skeleton height={5} className="w-3/4 mb-2" />
        <Skeleton height={4} className="w-1/2" />
      </div>
    </div>
    <SkeletonText lines={3} />
  </div>
)

export const SkeletonTable: React.FC<{ rows?: number; columns?: number; className?: string }> = ({
  rows = 5,
  columns = 4,
  className = ''
}) => (
  <div className={`space-y-3 ${className}`}>
    {/* Header */}
    <div className="flex space-x-4">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} height={6} className="flex-1" />
      ))}
    </div>
    
    {/* Rows */}
    {Array.from({ length: rows }).map((_, rowIndex) => (
      <div key={rowIndex} className="flex space-x-4">
        {Array.from({ length: columns }).map((_, colIndex) => (
          <Skeleton
            key={colIndex}
            height={4}
            className={colIndex === 0 ? 'w-1/3' : 'flex-1'}
          />
        ))}
      </div>
    ))}
  </div>
)

export const SkeletonPlayerRow: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center space-x-4 p-3 border-b border-gray-100 ${className}`}>
    <SkeletonAvatar size="sm" />
    <div className="flex-1 space-y-2">
      <Skeleton height={4} className="w-1/3" />
      <Skeleton height={3} className="w-1/4" />
    </div>
    <div className="flex space-x-3">
      <Skeleton height={4} width={12} />
      <Skeleton height={4} width={12} />
      <Skeleton height={4} width={12} />
    </div>
  </div>
)

export const SkeletonButton: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = ''
}) => {
  const sizeClass = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-2',
    lg: 'px-6 py-3'
  }[size]

  return (
    <Skeleton
      height={size === 'sm' ? 8 : size === 'md' ? 10 : 12}
      className={`${sizeClass} ${className}`}
    />
  )
}

export const SkeletonInput: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Skeleton height={10} className={`w-full ${className}`} />
)

export const SkeletonBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Skeleton height={6} width={16} className={className} />
)
