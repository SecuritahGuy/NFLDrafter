import '@testing-library/jest-dom'

// Mock Heroicons
vi.mock('@heroicons/react/24/outline', () => ({
  MagnifyingGlassIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="magnifying-glass-icon" {...props} />
  ),
  FunnelIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="funnel-icon" {...props} />
  ),
  EyeIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="eye-icon" {...props} />
  ),
  PlusIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="plus-icon" {...props} />
  ),
  MinusIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="minus-icon" {...props} />
  ),
  ChartBarIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="chart-bar-icon" {...props} />
  ),
  UserIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="user-icon" {...props} />
  ),
  FireIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="fire-icon" {...props} />
  ),
  StarIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="star-icon" {...props} />
  ),
  ArrowUpIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="arrow-up-icon" {...props} />
  ),
  ArrowDownIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="arrow-down-icon" {...props} />
  ),
  ChevronUpIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="chevron-up-icon" {...props} />
  ),
  ChevronDownIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="chevron-down-icon" {...props} />
  ),
  ChevronRightIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="chevron-right-icon" {...props} />
  ),
  ExclamationTriangleIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="exclamation-triangle-icon" {...props} />
  ),
  CheckCircleIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="check-circle-icon" {...props} />
  ),
  ClockIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="clock-icon" {...props} />
  ),
  AdjustmentsHorizontalIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="adjustments-horizontal-icon" {...props} />
  ),
  ArrowTrendingUpIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="arrow-trending-up-icon" {...props} />
  ),
  ArrowTrendingDownIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="arrow-trending-down-icon" {...props} />
  ),
  TrashIcon: ({ className, ...props }: any) => (
    <svg className={className} data-testid="trash-icon" {...props} />
  ),
}))

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
}

const mockIDBRequest = {
  result: null,
  error: null,
  onsuccess: null,
  onerror: null,
  onupgradeneeded: null,
}

const mockIDBTransaction = {
  objectStore: vi.fn(),
  oncomplete: null,
  onerror: null,
}

const mockIDBObjectStore = {
  createIndex: vi.fn(),
  add: vi.fn(),
  put: vi.fn(),
  get: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  openCursor: vi.fn(),
  index: vi.fn(),
}

const mockIDBIndex = {
  openCursor: vi.fn(),
  get: vi.fn(),
}

const mockIDBCursor = {
  value: null,
  continue: vi.fn(),
  delete: vi.fn(),
}

// Global mocks
Object.defineProperty(window, 'indexedDB', {
  writable: true,
  value: mockIndexedDB,
})

Object.defineProperty(window, 'IDBKeyRange', {
  writable: true,
  value: {
    upperBound: vi.fn(),
    lowerBound: vi.fn(),
    bound: vi.fn(),
    only: vi.fn(),
  },
})

// Mock implementation
mockIndexedDB.open.mockImplementation(() => {
  const request = { ...mockIDBRequest }
  
  // Simulate async behavior
  setTimeout(() => {
    if (request.onupgradeneeded) {
      const event = {
        target: {
          result: {
            createObjectStore: vi.fn().mockReturnValue(mockIDBObjectStore),
            objectStoreNames: [],
          },
        },
      }
      request.onupgradeneeded(event)
    }
    
    if (request.onsuccess) {
      const event = {
        target: {
          result: {
            transaction: vi.fn().mockReturnValue(mockIDBTransaction),
            objectStore: vi.fn().mockReturnValue(mockIDBObjectStore),
            close: vi.fn(),
          },
        },
      }
      request.onsuccess(event)
    }
  }, 0)
  
  return request
})

mockIDBTransaction.objectStore.mockReturnValue(mockIDBObjectStore)
mockIDBObjectStore.index.mockReturnValue(mockIDBIndex)
mockIDBObjectStore.openCursor.mockReturnValue(mockIDBRequest)
mockIDBIndex.openCursor.mockReturnValue(mockIDBRequest)

// Mock fetch for API calls
global.fetch = vi.fn()

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
}
