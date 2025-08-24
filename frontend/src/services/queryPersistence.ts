import { QueryClient } from '@tanstack/react-query';
import { offlineCache } from './offlineCache';

export interface PersistenceOptions {
  /**
   * Maximum number of queries to persist
   */
  maxQueries?: number;
  
  /**
   * Time to live for cached queries in milliseconds
   */
  ttl?: number;
  
  /**
   * Whether to enable automatic cleanup of expired entries
   */
  enableCleanup?: boolean;
  
  /**
   * Cleanup interval in milliseconds
   */
  cleanupInterval?: number;
  
  /**
   * Keys to exclude from persistence
   */
  excludeKeys?: string[];
  
  /**
   * Keys to always include in persistence
   */
  includeKeys?: string[];
}

export class QueryPersistenceAdapter {
  private queryClient: QueryClient;
  private options: Required<PersistenceOptions>;
  private cleanupTimer?: NodeJS.Timeout;
  private isInitialized = false;

  constructor(queryClient: QueryClient, options: PersistenceOptions = {}) {
    this.queryClient = queryClient;
    this.options = {
      maxQueries: 1000,
      ttl: 24 * 60 * 60 * 1000, // 24 hours default
      enableCleanup: true,
      cleanupInterval: 60 * 60 * 1000, // 1 hour
      excludeKeys: [],
      includeKeys: [],
      ...options,
    };
  }

  /**
   * Initialize the persistence adapter
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Initialize the offline cache
      await offlineCache.initialize();
      
      // Restore queries from cache
      await this.restoreQueries();
      
      // Set up automatic persistence
      this.setupPersistence();
      
      // Set up cleanup if enabled
      if (this.options.enableCleanup) {
        this.setupCleanup();
      }
      
      this.isInitialized = true;
      console.log('Query persistence adapter initialized successfully');
    } catch (error) {
      console.error('Failed to initialize query persistence adapter:', error);
      throw error;
    }
  }

  /**
   * Set up automatic persistence of queries
   */
  private setupPersistence(): void {
    // Listen to query cache changes
    this.queryClient.getQueryCache().subscribe((event) => {
      if (event.type === 'updated' && event.query.state.status === 'success') {
        this.persistQuery(event.query.queryKey, event.query.state.data);
      }
    });

    // Listen to mutation cache changes
    this.queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.mutation.state.status === 'success') {
        // Invalidate related queries when mutations succeed
        this.invalidateRelatedQueries(event.mutation.options.mutationKey);
      }
    });
  }

  /**
   * Set up automatic cleanup of expired entries
   */
  private setupCleanup(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        const deletedCount = await offlineCache.cleanup();
        if (deletedCount > 0) {
          console.log(`Cleaned up ${deletedCount} expired cache entries`);
        }
      } catch (error) {
        console.error('Failed to cleanup expired cache entries:', error);
      }
    }, this.options.cleanupInterval);
  }

  /**
   * Persist a single query to cache
   */
  private async persistQuery(queryKey: any[], data: any): Promise<void> {
    try {
      const key = this.serializeQueryKey(queryKey);
      
      // Check if we should exclude this key
      if (this.shouldExcludeKey(key)) {
        return;
      }
      
      // Check if we should always include this key
      if (this.shouldIncludeKey(key)) {
        await offlineCache.set(key, data, this.options.ttl);
        return;
      }
      
      // Check if we've reached the maximum number of queries
      const stats = await offlineCache.getStats();
      if (stats.totalEntries >= this.options.maxQueries) {
        // Remove oldest entries to make room
        await this.removeOldestQueries(stats.totalEntries - this.options.maxQueries + 1);
      }
      
      await offlineCache.set(key, data, this.options.ttl);
    } catch (error) {
      console.error('Failed to persist query:', error);
    }
  }

  /**
   * Restore all queries from cache
   */
  private async restoreQueries(): Promise<void> {
    try {
      const keys = await offlineCache.getKeys();
      const restoredCount = 0;
      
      for (const key of keys) {
        try {
          const data = await offlineCache.get(key);
          if (data !== null) {
            const queryKey = this.deserializeQueryKey(key);
            if (queryKey) {
              // Set the query data in the cache
              this.queryClient.setQueryData(queryKey, data);
              restoredCount++;
            }
          }
        } catch (error) {
          console.error(`Failed to restore query with key ${key}:`, error);
        }
      }
      
      console.log(`Restored ${restoredCount} queries from cache`);
    } catch (error) {
      console.error('Failed to restore queries from cache:', error);
    }
  }

  /**
   * Remove oldest queries to make room for new ones
   */
  private async removeOldestQueries(count: number): Promise<void> {
    try {
      const stats = await offlineCache.getStats();
      if (stats.totalEntries === 0) return;

      // Get all entries and sort by timestamp
      const keys = await offlineCache.getKeys();
      const entries = await Promise.all(
        keys.map(async (key) => {
          const data = await offlineCache.get(key);
          return { key, timestamp: Date.now() };
        })
      );

      // Sort by timestamp (oldest first) and remove the specified count
      const sortedEntries = entries
        .filter(entry => entry.timestamp > 0)
        .sort((a, b) => a.timestamp - b.timestamp);

      const keysToRemove = sortedEntries
        .slice(0, count)
        .map(entry => entry.key);

      await Promise.all(
        keysToRemove.map(key => offlineCache.delete(key))
      );

      console.log(`Removed ${keysToRemove.length} oldest queries to make room`);
    } catch (error) {
      console.error('Failed to remove oldest queries:', error);
    }
  }

  /**
   * Invalidate related queries when mutations succeed
   */
  private async invalidateRelatedQueries(mutationKey: any[] | undefined): Promise<void> {
    if (!mutationKey) return;

    try {
      const keys = await offlineCache.getKeys();
      const keysToInvalidate: string[] = [];

      for (const key of keys) {
        if (this.isRelatedQuery(key, mutationKey)) {
          keysToInvalidate.push(key);
        }
      }

      // Remove invalidated queries from cache
      await Promise.all(
        keysToInvalidate.map(key => offlineCache.delete(key))
      );

      if (keysToInvalidate.length > 0) {
        console.log(`Invalidated ${keysToInvalidate.length} related queries`);
      }
    } catch (error) {
      console.error('Failed to invalidate related queries:', error);
    }
  }

  /**
   * Check if a query key should be excluded from persistence
   */
  private shouldExcludeKey(key: string): boolean {
    return this.options.excludeKeys.some(excludeKey => 
      key.includes(excludeKey)
    );
  }

  /**
   * Check if a query key should always be included in persistence
   */
  private shouldIncludeKey(key: string): boolean {
    return this.options.includeKeys.some(includeKey => 
      key.includes(includeKey)
    );
  }

  /**
   * Check if a query is related to a mutation
   */
  private isRelatedQuery(queryKey: string, mutationKey: any[]): boolean {
    const queryKeyStr = JSON.stringify(mutationKey);
    return queryKey.includes(queryKeyStr);
  }

  /**
   * Serialize a query key to a string for storage
   */
  private serializeQueryKey(queryKey: any[]): string {
    return JSON.stringify(queryKey);
  }

  /**
   * Deserialize a query key from a string
   */
  private deserializeQueryKey(key: string): any[] | null {
    try {
      return JSON.parse(key);
    } catch {
      return null;
    }
  }

  /**
   * Manually persist a specific query
   */
  async persistQueryManually(queryKey: any[], data: any, ttl?: number): Promise<void> {
    const key = this.serializeQueryKey(queryKey);
    await offlineCache.set(key, data, ttl || this.options.ttl);
  }

  /**
   * Manually restore a specific query
   */
  async restoreQueryManually(queryKey: any[]): Promise<any | null> {
    const key = this.serializeQueryKey(queryKey);
    return await offlineCache.get(key);
  }

  /**
   * Clear all persisted queries
   */
  async clearPersistedQueries(): Promise<void> {
    await offlineCache.clear();
  }

  /**
   * Get statistics about persisted queries
   */
  async getPersistenceStats(): Promise<{
    cacheStats: any;
    queryCacheSize: number;
  }> {
    const cacheStats = await offlineCache.getStats();
    const queryCacheSize = this.queryClient.getQueryCache().getAll().length;
    
    return {
      cacheStats,
      queryCacheSize,
    };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    offlineCache.close();
    this.isInitialized = false;
  }
}

/**
 * Create and configure a QueryClient with persistence
 */
export function createPersistentQueryClient(options: PersistenceOptions = {}): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
        retry: 3,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 1,
      },
    },
  });

  // Create persistence adapter
  const persistenceAdapter = new QueryPersistenceAdapter(queryClient, options);
  
  // Initialize persistence
  persistenceAdapter.initialize().catch(console.error);

  // Store adapter reference for cleanup
  (queryClient as any)._persistenceAdapter = persistenceAdapter;

  return queryClient;
}

/**
 * Get the persistence adapter from a QueryClient
 */
export function getPersistenceAdapter(queryClient: QueryClient): QueryPersistenceAdapter | null {
  return (queryClient as any)._persistenceAdapter || null;
}
