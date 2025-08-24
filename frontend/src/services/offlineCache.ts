export interface CacheEntry {
  key: string;
  data: any;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number;
  newestEntry: number;
}

class OfflineCacheService {
  private dbName = 'NFLDrafterCache';
  private dbVersion = 1;
  private storeName = 'queryCache';
  private db: IDBDatabase | null = null;
  private isInitialized = false;

  /**
   * Initialize the IndexedDB connection
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          
          // Create indexes for efficient querying
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('ttl', 'ttl', { unique: false });
        }
      };
    });
  }

  /**
   * Store a cache entry
   */
  async set(key: string, data: any, ttl?: number): Promise<void> {
    await this.ensureInitialized();

    const entry: CacheEntry = {
      key,
      data,
      timestamp: Date.now(),
      ttl: ttl ? Date.now() + ttl : undefined,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entry);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Retrieve a cache entry
   */
  async get(key: string): Promise<any | null> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const entry = request.result as CacheEntry | undefined;
        
        if (!entry) {
          resolve(null);
          return;
        }

        // Check if entry has expired
        if (entry.ttl && Date.now() > entry.ttl) {
          // Entry has expired, remove it and return null
          this.delete(key).catch(console.error);
          resolve(null);
          return;
        }

        resolve(entry.data);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a cache entry
   */
  async delete(key: string): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result as CacheEntry[];
        const now = Date.now();
        
        // Filter out expired entries
        const validEntries = entries.filter(entry => 
          !entry.ttl || now <= entry.ttl
        );

        if (validEntries.length === 0) {
          resolve({
            totalEntries: 0,
            totalSize: 0,
            oldestEntry: 0,
            newestEntry: 0,
          });
          return;
        }

        const timestamps = validEntries.map(e => e.timestamp);
        const totalSize = JSON.stringify(validEntries).length;

        resolve({
          totalEntries: validEntries.length,
          totalSize,
          oldestEntry: Math.min(...timestamps),
          newestEntry: Math.max(...timestamps),
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clean up expired entries
   */
  async cleanup(): Promise<number> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('ttl');
      const now = Date.now();
      
      // Find all expired entries
      const request = index.openCursor(IDBKeyRange.upperBound(now));

      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          if (cursor.value.ttl && cursor.value.ttl <= now) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get all cache keys
   */
  async getKeys(): Promise<string[]> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAllKeys();

      request.onsuccess = () => {
        const keys = request.result as string[];
        resolve(keys);
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if a key exists and is valid
   */
  async has(key: string): Promise<boolean> {
    const data = await this.get(key);
    return data !== null;
  }

  /**
   * Set multiple cache entries in a batch
   */
  async setMultiple(entries: Array<{ key: string; data: any; ttl?: number }>): Promise<void> {
    await this.ensureInitialized();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);

      let completed = 0;
      let hasError = false;

      entries.forEach(({ key, data, ttl }) => {
        const entry: CacheEntry = {
          key,
          data,
          timestamp: Date.now(),
          ttl: ttl ? Date.now() + ttl : undefined,
        };

        const request = store.put(entry);

        request.onsuccess = () => {
          completed++;
          if (completed === entries.length && !hasError) {
            resolve();
          }
        };

        request.onerror = () => {
          if (!hasError) {
            hasError = true;
            reject(request.error);
          }
        };
      });
    });
  }

  /**
   * Get multiple cache entries
   */
  async getMultiple(keys: string[]): Promise<Record<string, any>> {
    await this.ensureInitialized();

    const results: Record<string, any> = {};
    
    await Promise.all(
      keys.map(async (key) => {
        const data = await this.get(key);
        if (data !== null) {
          results[key] = data;
        }
      })
    );

    return results;
  }

  /**
   * Ensure the service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Close the database connection
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.isInitialized = false;
    }
  }
}

// Export singleton instance
export const offlineCache = new OfflineCacheService();

// Export the class for testing
export { OfflineCacheService };
