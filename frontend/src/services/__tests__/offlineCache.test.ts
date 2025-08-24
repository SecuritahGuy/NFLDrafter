import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OfflineCacheService, type CacheEntry } from '../offlineCache';

// Mock IndexedDB
const mockIndexedDB = {
  open: vi.fn(),
};

// Mock global indexedDB
Object.defineProperty(global, 'indexedDB', {
  value: mockIndexedDB,
  writable: true,
});

describe('OfflineCacheService', () => {
  let cacheService: OfflineCacheService;
  let mockDB: any;
  let mockTransaction: any;
  let mockStore: any;
  let mockIndex: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset mock IndexedDB
    mockIndexedDB.open.mockReset();
    
    // Create fresh service instance
    cacheService = new OfflineCacheService();
    
    // Mock database structure
    mockDB = {
      objectStoreNames: {
        contains: vi.fn().mockReturnValue(false),
      },
      createObjectStore: vi.fn(),
      transaction: vi.fn(),
      close: vi.fn(),
    };
    
    mockTransaction = {
      objectStore: vi.fn(),
    };
    
    mockStore = {
      put: vi.fn(),
      get: vi.fn(),
      delete: vi.fn(),
      clear: vi.fn(),
      getAll: vi.fn(),
      getAllKeys: vi.fn(),
      index: vi.fn(),
    };
    
    mockIndex = {
      openCursor: vi.fn(),
    };
    
    // Set up mock chain
    mockTransaction.objectStore.mockReturnValue(mockStore);
    mockStore.index.mockReturnValue(mockIndex);
    mockDB.transaction.mockReturnValue(mockTransaction);
  });

  afterEach(() => {
    cacheService.close();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      // Simulate successful initialization
      setTimeout(() => {
        mockRequest.onsuccess?.();
      }, 0);
      
      await cacheService.initialize();
      
      expect(mockIndexedDB.open).toHaveBeenCalledWith('NFLDrafterCache', 1);
    });

    it('should handle initialization errors', async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        error: new Error('Database error'),
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      // Simulate error
      setTimeout(() => {
        mockRequest.onerror?.();
      }, 0);
      
      await expect(cacheService.initialize()).rejects.toThrow('Database error');
    });

    it('should create object store on upgrade', async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      // Simulate upgrade needed
      setTimeout(() => {
        mockRequest.onupgradeneeded?.({ target: { result: mockDB } });
        mockRequest.onsuccess?.();
      }, 0);
      
      await cacheService.initialize();
      
      expect(mockDB.createObjectStore).toHaveBeenCalledWith('queryCache', { keyPath: 'key' });
    });
  });

  describe('Basic Operations', () => {
    beforeEach(async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      setTimeout(() => {
        mockRequest.onsuccess?.();
      }, 0);
      
      await cacheService.initialize();
    });

    it('should set and get cache entries', async () => {
      const testData = { test: 'data' };
      const testKey = 'test-key';
      
      // Mock successful set operation
      const mockSetRequest = {
        onsuccess: null,
        onerror: null,
      };
      mockStore.put.mockReturnValue(mockSetRequest);
      
      setTimeout(() => {
        mockSetRequest.onsuccess?.();
      }, 0);
      
      await cacheService.set(testKey, testData);
      
      expect(mockStore.put).toHaveBeenCalledWith({
        key: testKey,
        data: testData,
        timestamp: expect.any(Number),
        ttl: undefined,
      });
      
      // Mock successful get operation
      const mockGetRequest = {
        onsuccess: null,
        onerror: null,
        result: {
          key: testKey,
          data: testData,
          timestamp: Date.now(),
          ttl: undefined,
        },
      };
      mockStore.get.mockReturnValue(mockGetRequest);
      
      setTimeout(() => {
        mockGetRequest.onsuccess?.();
      }, 0);
      
      const result = await cacheService.get(testKey);
      
      expect(result).toEqual(testData);
      expect(mockStore.get).toHaveBeenCalledWith(testKey);
    });

    it('should handle TTL expiration', async () => {
      const testData = { test: 'data' };
      const testKey = 'test-key';
      const ttl = 1000; // 1 second
      
      // Mock successful set operation
      const mockSetRequest = {
        onsuccess: null,
        onerror: null,
      };
      mockStore.put.mockReturnValue(mockSetRequest);
      
      setTimeout(() => {
        mockSetRequest.onsuccess?.();
      }, 0);
      
      await cacheService.set(testKey, testData, ttl);
      
      // Mock successful get operation with expired TTL
      const mockGetRequest = {
        onsuccess: null,
        onerror: null,
        result: {
          key: testKey,
          data: testData,
          timestamp: Date.now() - 2000, // 2 seconds ago
          ttl: Date.now() - 1000, // Expired 1 second ago
        },
      };
      mockStore.get.mockReturnValue(mockGetRequest);
      
      // Mock successful delete operation
      const mockDeleteRequest = {
        onsuccess: null,
        onerror: null,
      };
      mockStore.delete.mockReturnValue(mockDeleteRequest);
      
      setTimeout(() => {
        mockGetRequest.onsuccess?.();
        mockDeleteRequest.onsuccess?.();
      }, 0);
      
      const result = await cacheService.get(testKey);
      
      expect(result).toBeNull();
      expect(mockStore.delete).toHaveBeenCalledWith(testKey);
    });

    it('should delete cache entries', async () => {
      const testKey = 'test-key';
      
      // Mock successful delete operation
      const mockDeleteRequest = {
        onsuccess: null,
        onerror: null,
      };
      mockStore.delete.mockReturnValue(mockDeleteRequest);
      
      setTimeout(() => {
        mockDeleteRequest.onsuccess?.();
      }, 0);
      
      await cacheService.delete(testKey);
      
      expect(mockStore.delete).toHaveBeenCalledWith(testKey);
    });

    it('should clear all cache entries', async () => {
      // Mock successful clear operation
      const mockClearRequest = {
        onsuccess: null,
        onerror: null,
      };
      mockStore.clear.mockReturnValue(mockClearRequest);
      
      setTimeout(() => {
        mockClearRequest.onsuccess?.();
      }, 0);
      
      await cacheService.clear();
      
      expect(mockStore.clear).toHaveBeenCalled();
    });
  });

  describe('Advanced Operations', () => {
    beforeEach(async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      setTimeout(() => {
        mockRequest.onsuccess?.();
      }, 0);
      
      await cacheService.initialize();
    });

    it('should get cache statistics', async () => {
      const mockEntries: CacheEntry[] = [
        {
          key: 'key1',
          data: { test: 'data1' },
          timestamp: Date.now() - 1000,
          ttl: undefined,
        },
        {
          key: 'key2',
          data: { test: 'data2' },
          timestamp: Date.now(),
          ttl: undefined,
        },
      ];
      
      // Mock successful getAll operation
      const mockGetAllRequest = {
        onsuccess: null,
        onerror: null,
        result: mockEntries,
      };
      mockStore.getAll.mockReturnValue(mockGetAllRequest);
      
      setTimeout(() => {
        mockGetAllRequest.onsuccess?.();
      }, 0);
      
      const stats = await cacheService.getStats();
      
      expect(stats.totalEntries).toBe(2);
      expect(stats.totalSize).toBeGreaterThan(0);
      expect(stats.oldestEntry).toBeLessThan(stats.newestEntry);
    });

    it('should get all cache keys', async () => {
      const mockKeys = ['key1', 'key2', 'key3'];
      
      // Mock successful getAllKeys operation
      const mockGetAllKeysRequest = {
        onsuccess: null,
        onerror: null,
        result: mockKeys,
      };
      mockStore.getAllKeys.mockReturnValue(mockGetAllKeysRequest);
      
      setTimeout(() => {
        mockGetAllKeysRequest.onsuccess?.();
      }, 0);
      
      const keys = await cacheService.getKeys();
      
      expect(keys).toEqual(mockKeys);
    });

    it('should check if key exists', async () => {
      const testKey = 'test-key';
      
      // Mock successful get operation
      const mockGetRequest = {
        onsuccess: null,
        onerror: null,
        result: {
          key: testKey,
          data: { test: 'data' },
          timestamp: Date.now(),
          ttl: undefined,
        },
      };
      mockStore.get.mockReturnValue(mockGetRequest);
      
      setTimeout(() => {
        mockGetRequest.onsuccess?.();
      }, 0);
      
      const exists = await cacheService.has(testKey);
      
      expect(exists).toBe(true);
    });

    it('should handle non-existent keys', async () => {
      const testKey = 'non-existent-key';
      
      // Mock successful get operation with no result
      const mockGetRequest = {
        onsuccess: null,
        onerror: null,
        result: undefined,
      };
      mockStore.get.mockReturnValue(mockGetRequest);
      
      setTimeout(() => {
        mockGetRequest.onsuccess?.();
      }, 0);
      
      const exists = await cacheService.has(testKey);
      
      expect(exists).toBe(false);
    });
  });

  describe('Batch Operations', () => {
    beforeEach(async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      setTimeout(() => {
        mockRequest.onsuccess?.();
      }, 0);
      
      await cacheService.initialize();
    });

    it('should set multiple entries', async () => {
      const entries = [
        { key: 'key1', data: { test: 'data1' }, ttl: 1000 },
        { key: 'key2', data: { test: 'data2' }, ttl: 2000 },
      ];
      
      // Mock successful put operations
      const mockPutRequest = {
        onsuccess: null,
        onerror: null,
      };
      mockStore.put.mockReturnValue(mockPutRequest);
      
      setTimeout(() => {
        mockPutRequest.onsuccess?.();
        mockPutRequest.onsuccess?.();
      }, 0);
      
      await cacheService.setMultiple(entries);
      
      expect(mockStore.put).toHaveBeenCalledTimes(2);
    });

    it('should get multiple entries', async () => {
      const keys = ['key1', 'key2'];
      const mockData = { test: 'data' };
      
      // Mock successful get operations
      const mockGetRequest = {
        onsuccess: null,
        onerror: null,
        result: {
          key: 'key1',
          data: mockData,
          timestamp: Date.now(),
          ttl: undefined,
        },
      };
      mockStore.get.mockReturnValue(mockGetRequest);
      
      setTimeout(() => {
        mockGetRequest.onsuccess?.();
        mockGetRequest.onsuccess?.();
      }, 0);
      
      const results = await cacheService.getMultiple(keys);
      
      expect(Object.keys(results)).toHaveLength(2);
      expect(results.key1).toEqual(mockData);
      expect(results.key2).toEqual(mockData);
    });
  });

  describe('Cleanup Operations', () => {
    beforeEach(async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      setTimeout(() => {
        mockRequest.onsuccess?.();
      }, 0);
      
      await cacheService.initialize();
    });

    it('should cleanup expired entries', async () => {
      const mockCursor = {
        value: {
          key: 'expired-key',
          data: { test: 'data' },
          timestamp: Date.now() - 2000,
          ttl: Date.now() - 1000, // Expired
        },
        delete: vi.fn(),
        continue: vi.fn(),
      };
      
      // Mock successful cursor operation
      const mockCursorRequest = {
        onsuccess: null,
        onerror: null,
        result: mockCursor,
      };
      mockIndex.openCursor.mockReturnValue(mockCursorRequest);
      
      setTimeout(() => {
        mockCursorRequest.onsuccess?.();
        // Simulate cursor completion
        mockCursor.continue();
        mockCursorRequest.onsuccess?.();
        mockCursorRequest.result = null; // End of cursor
      }, 0);
      
      const deletedCount = await cacheService.cleanup();
      
      expect(deletedCount).toBe(1);
      expect(mockCursor.delete).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      setTimeout(() => {
        mockRequest.onsuccess?.();
      }, 0);
      
      await cacheService.initialize();
    });

    it('should handle set operation errors', async () => {
      const testKey = 'test-key';
      const testData = { test: 'data' };
      
      // Mock failed put operation
      const mockPutRequest = {
        onsuccess: null,
        onerror: null,
        error: new Error('Put failed'),
      };
      mockStore.put.mockReturnValue(mockPutRequest);
      
      setTimeout(() => {
        mockPutRequest.onerror?.();
      }, 0);
      
      await expect(cacheService.set(testKey, testData)).rejects.toThrow('Put failed');
    });

    it('should handle get operation errors', async () => {
      const testKey = 'test-key';
      
      // Mock failed get operation
      const mockGetRequest = {
        onsuccess: null,
        onerror: null,
        error: new Error('Get failed'),
      };
      mockStore.get.mockReturnValue(mockGetRequest);
      
      setTimeout(() => {
        mockGetRequest.onerror?.();
      }, 0);
      
      await expect(cacheService.get(testKey)).rejects.toThrow('Get failed');
    });

    it('should handle delete operation errors', async () => {
      const testKey = 'test-key';
      
      // Mock failed delete operation
      const mockDeleteRequest = {
        onsuccess: null,
        onerror: null,
        error: new Error('Delete failed'),
      };
      mockStore.delete.mockReturnValue(mockDeleteRequest);
      
      setTimeout(() => {
        mockDeleteRequest.onerror?.();
      }, 0);
      
      await expect(cacheService.delete(testKey)).rejects.toThrow('Delete failed');
    });
  });

  describe('Lifecycle Management', () => {
    it('should close database connection', () => {
      cacheService.close();
      
      // The close method should not throw errors
      expect(() => cacheService.close()).not.toThrow();
    });

    it('should handle multiple initializations gracefully', async () => {
      const mockRequest = {
        onerror: null,
        onsuccess: null,
        onupgradeneeded: null,
        result: mockDB,
      };
      
      mockIndexedDB.open.mockReturnValue(mockRequest);
      
      setTimeout(() => {
        mockRequest.onsuccess?.();
      }, 0);
      
      await cacheService.initialize();
      await cacheService.initialize(); // Should not throw
      
      expect(mockIndexedDB.open).toHaveBeenCalledTimes(1); // Should only initialize once
    });
  });
});
