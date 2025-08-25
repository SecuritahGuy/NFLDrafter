import '@testing-library/jest-dom'
import { vi } from 'vitest'
import React from 'react'

// Mock IndexedDB
const indexedDB = {
  open: vi.fn(),
  deleteDatabase: vi.fn(),
  databases: vi.fn(),
}

Object.defineProperty(window, 'indexedDB', {
  value: indexedDB,
  writable: true,
})

// Mock IDBRequest
class MockIDBRequest {
  result: any = null
  error: any = null
  onsuccess: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onupgradeneeded: ((event: any) => void) | null = null
  readyState: string = 'done'
  source: any = null
  transaction: any = null
}

// Mock IDBObjectStore
class MockIDBObjectStore {
  name: string = 'test'
  keyPath: string | string[] = 'id'
  indexNames: DOMStringList = [] as any
  transaction: any = null
  autoIncrement: boolean = false

  createIndex(name: string, keyPath: string | string[], options?: IDBIndexParameters): IDBIndex {
    return {} as IDBIndex
  }

  deleteIndex(name: string): void {}
  add(value: any, key?: any): IDBRequest {
    return new MockIDBRequest() as any
  }
  put(value: any, key?: any): IDBRequest {
    return new MockIDBRequest() as any
  }
  delete(key: any): IDBRequest {
    return new MockIDBRequest() as any
  }
  get(key: any): IDBRequest {
    return new MockIDBRequest() as any
  }
  getAll(query?: any, count?: number): IDBRequest {
    return new MockIDBRequest() as any
  }
  openCursor(query?: any, direction?: IDBCursorDirection): IDBRequest {
    return new MockIDBRequest() as any
  }
  clear(): IDBRequest {
    return new MockIDBRequest() as any
  }
}

// Mock IDBDatabase
class MockIDBDatabase {
  name: string = 'test'
  version: number = 1
  objectStoreNames: DOMStringList = [] as any
  onclose: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onversionchange: ((event: any) => void) | null = null

  close(): void {}
  createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore {
    return new MockIDBObjectStore() as any
  }
  deleteObjectStore(name: string): void {}
  transaction(storeNames: string | string[], mode?: IDBTransactionMode): IDBTransaction {
    return {} as IDBTransaction
  }
}

// Mock IDBOpenDBRequest
class MockIDBOpenDBRequest extends MockIDBRequest {
  onblocked: ((event: any) => void) | null = null
  onupgradeneeded: ((event: any) => void) | null = null
}

// Mock IDBTransaction
class MockIDBTransaction {
  objectStoreNames: DOMStringList = [] as any
  mode: IDBTransactionMode = 'readonly'
  oncomplete: ((event: any) => void) | null = null
  onerror: ((event: any) => void) | null = null
  onabort: ((event: any) => void) | null = null

  objectStore(name: string): IDBObjectStore {
    return new MockIDBObjectStore() as any
  }
  commit(): void {}
  abort(): void {}
}

// Mock IDBCursor
class MockIDBCursor {
  value: any = null
  key: any = null
  primaryKey: any = null
  direction: IDBCursorDirection = 'next'
  source: any = null

  continue(key?: any): void {}
  continuePrimaryKey(key: any, primaryKey: any): void {}
  advance(count: number): void {}
  delete(): IDBRequest {
    return new MockIDBRequest() as any
  }
  update(value: any): IDBRequest {
    return new MockIDBRequest() as any
  }
}

// Mock IDBIndex
class MockIDBIndex {
  name: string = 'test'
  objectStore: IDBObjectStore = new MockIDBObjectStore() as any
  keyPath: string | string[] = 'id'
  multiEntry: boolean = false
  unique: boolean = false

  get(key: any): IDBRequest {
    return new MockIDBRequest() as any
  }
  getKey(key: any): IDBRequest {
    return new MockIDBRequest() as any
  }
  getAll(query?: any, count?: number): IDBRequest {
    return new MockIDBRequest() as any
  }
  getAllKeys(query?: any, count?: number): IDBRequest {
    return new MockIDBRequest() as any
  }
  openCursor(query?: any, direction?: IDBCursorDirection): IDBRequest {
    return new MockIDBRequest() as any
  }
  openKeyCursor(query?: any, direction?: IDBCursorDirection): IDBRequest {
    return new MockIDBRequest() as any
  }
  count(query?: any): IDBRequest {
    return new MockIDBRequest() as any
  }
}

// Mock IDBKeyRange
class MockIDBKeyRange {
  lower: any = null
  upper: any = null
  lowerOpen: boolean = false
  upperOpen: boolean = false

  static bound(lower: any, upper: any, lowerOpen?: boolean, upperOpen?: boolean): IDBKeyRange {
    return new MockIDBKeyRange() as any
  }
  static lowerBound(lower: any, open?: boolean): IDBKeyRange {
    return new MockIDBKeyRange() as any
  }
  static upperBound(upper: any, open?: boolean): IDBKeyRange {
    return new MockIDBKeyRange() as any
  }
  static only(value: any): IDBKeyRange {
    return new MockIDBKeyRange() as any
  }
}

// Mock IDBFactory
class MockIDBFactory {
  open(name: string, version?: number): IDBOpenDBRequest {
    const request = new MockIDBOpenDBRequest()
    // Simulate successful database creation
    setTimeout(() => {
      if (request.onsuccess) {
        request.result = new MockIDBDatabase()
        request.onsuccess({ target: request } as any)
      }
    }, 0)
    return request as any
  }
  deleteDatabase(name: string): IDBOpenDBRequest {
    const request = new MockIDBOpenDBRequest()
    setTimeout(() => {
      if (request.onsuccess) {
        request.onsuccess({ target: request } as any)
      }
    }, 0)
    return request as any
  }
  databases(): Promise<IDBDatabaseInfo[]> {
    return Promise.resolve([])
  }
}

// Mock IDBDatabaseInfo
interface IDBDatabaseInfo {
  name: string
  version: number
}

// Mock DOMStringList
class MockDOMStringList extends Array<string> {
  contains(value: string): boolean {
    return this.includes(value)
  }
  item(index: number): string | null {
    return this[index] || null
  }
  get length(): number {
    return this.length
  }
}

// Set up the mocks
Object.defineProperty(window, 'indexedDB', {
  value: new MockIDBFactory(),
  writable: true,
})

// Mock all the IDB classes
Object.defineProperty(window, 'IDBRequest', {
  value: MockIDBRequest,
  writable: true,
})

Object.defineProperty(window, 'IDBOpenDBRequest', {
  value: MockIDBOpenDBRequest,
  writable: true,
})

Object.defineProperty(window, 'IDBDatabase', {
  value: MockIDBDatabase,
  writable: true,
})

Object.defineProperty(window, 'IDBObjectStore', {
  value: MockIDBObjectStore,
  writable: true,
})

Object.defineProperty(window, 'IDBTransaction', {
  value: MockIDBTransaction,
  writable: true,
})

Object.defineProperty(window, 'IDBCursor', {
  value: MockIDBCursor,
  writable: true,
})

Object.defineProperty(window, 'IDBIndex', {
  value: MockIDBIndex,
  writable: true,
})

Object.defineProperty(window, 'IDBKeyRange', {
  value: MockIDBKeyRange,
  writable: true,
})

Object.defineProperty(window, 'DOMStringList', {
  value: MockDOMStringList,
  writable: true,
})

// Mock ResizeObserver
window.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))

// Mock IntersectionObserver
window.IntersectionObserver = vi.fn().mockImplementation(() => ({
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
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock console methods to reduce noise in tests
window.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
  log: vi.fn(),
  debug: vi.fn(),
  info: vi.fn(),
}

// Mock all Heroicons used in the application
vi.mock('@heroicons/react/24/outline', () => {
  const createMockIcon = (testId: string) => ({ className }: { className?: string }) => (
    <svg className={className} data-testid={testId} />
  )

  return {
    // Navigation and UI
    ChevronDownIcon: createMockIcon('chevron-down-icon'),
    ChevronUpIcon: createMockIcon('chevron-up-icon'),
    ChevronRightIcon: createMockIcon('chevron-right-icon'),
    ChevronLeftIcon: createMockIcon('chevron-left-icon'),
    
    // Icons
    StarIcon: createMockIcon('star-icon'),
    ChartBarIcon: createMockIcon('chart-bar-icon'),
    UserIcon: createMockIcon('user-icon'),
    MagnifyingGlassIcon: createMockIcon('magnifying-glass-icon'),
    FunnelIcon: createMockIcon('funnel-icon'),
    EyeIcon: createMockIcon('eye-icon'),
    PlusIcon: createMockIcon('plus-icon'),
    MinusIcon: createMockIcon('minus-icon'),
    FireIcon: createMockIcon('fire-icon'),
    TrashIcon: createMockIcon('trash-icon'),
    AdjustmentsHorizontalIcon: createMockIcon('adjustments-horizontal-icon'),
    ArrowTrendingUpIcon: createMockIcon('arrow-trending-up-icon'),
    ArrowTrendingDownIcon: createMockIcon('arrow-trending-down-icon'),
    ArrowDownTrayIcon: createMockIcon('arrow-down-tray-icon'),
    XMarkIcon: createMockIcon('x-mark-icon'),
    CloudArrowUpIcon: createMockIcon('cloud-arrow-up-icon'),
    NewspaperIcon: createMockIcon('newspaper-icon'),
    UserGroupIcon: createMockIcon('user-group-icon'),
    PencilIcon: createMockIcon('pencil-icon'),
    InformationCircleIcon: createMockIcon('information-circle-icon'),
    XCircleIcon: createMockIcon('x-circle-icon'),
    ExclamationTriangleIcon: createMockIcon('exclamation-triangle-icon'),
    CheckCircleIcon: createMockIcon('check-circle-icon'),
    TrophyIcon: createMockIcon('trophy-icon'),
    CalendarIcon: createMockIcon('calendar-icon'),
    ExclamationCircleIcon: createMockIcon('exclamation-circle-icon'),
    HomeIcon: createMockIcon('home-icon'),
    Cog6ToothIcon: createMockIcon('cog-6-tooth-icon'),
    SignalIcon: createMockIcon('signal-icon'),
    WifiIcon: createMockIcon('wifi-icon'),
  }
})
