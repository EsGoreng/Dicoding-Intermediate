
const DB_NAME = 'worldstory_cache';
const DB_VERSION = 1;

const STORES = {
  STORIES: 'stories',
  STORY_DETAIL: 'story_detail',
  COMMENTS: 'comments',
  REPORTS: 'reports',
  REPORT_DETAIL: 'report_detail',
  USER_INFO: 'user_info',
};

class OfflineDataManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  async init() {
    return new Promise((resolve, reject) => {
      if (this.isInitialized) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('IndexedDB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('IndexedDB initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create object stores if they don't exist
        const storeNames = Object.values(STORES);
        storeNames.forEach((storeName) => {
          if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id' });
            // Create indexes for efficient querying
            store.createIndex('timestamp', 'timestamp', { unique: false });
            store.createIndex('endpoint', 'endpoint', { unique: false });
          }
        });

        console.log('IndexedDB schema created');
      };
    });
  }

  /**
   * Save data to IndexedDB
   * @param {string} storeName - Store name (stories, comments, etc)
   * @param {object} data - Data to save
   * @param {string} key - Optional key (default: id from data)
   */
  async saveData(storeName, data, key = null) {
    try {
      if (!this.db) {
        await this.init();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        const dataWithMeta = {
          ...data,
          id: key || data.id || `${Date.now()}_${Math.random()}`,
          timestamp: Date.now(),
          endpoint: data.endpoint || null,
        };

        const request = store.put(dataWithMeta);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(dataWithMeta);
      });
    } catch (error) {
      console.error(`Error saving to ${storeName}:`, error);
      throw error;
    }
  }

  /**
   * Get data from IndexedDB
   * @param {string} storeName - Store name
   * @param {string} key - Data key/id
   */
  async getData(storeName, key) {
    try {
      if (!this.db) {
        await this.init();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || null);
      });
    } catch (error) {
      console.error(`Error getting from ${storeName}:`, error);
      return null;
    }
  }

  /**
   * Get all data from store
   * @param {string} storeName - Store name
   */
  async getAllData(storeName) {
    try {
      if (!this.db) {
        await this.init();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      });
    } catch (error) {
      console.error(`Error getting all from ${storeName}:`, error);
      return [];
    }
  }

  /**
   * Query data by index
   * @param {string} storeName - Store name
   * @param {string} indexName - Index name
   * @param {*} value - Value to search
   */
  async queryByIndex(storeName, indexName, value) {
    try {
      if (!this.db) {
        await this.init();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);
        const request = index.getAll(value);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result || []);
      });
    } catch (error) {
      console.error(`Error querying ${storeName}:`, error);
      return [];
    }
  }

  /**
   * Delete data from IndexedDB
   * @param {string} storeName - Store name
   * @param {string} key - Data key/id
   */
  async deleteData(storeName, key) {
    try {
      if (!this.db) {
        await this.init();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    } catch (error) {
      console.error(`Error deleting from ${storeName}:`, error);
      return false;
    }
  }

  /**
   * Clear all data from store
   * @param {string} storeName - Store name
   */
  async clearStore(storeName) {
    try {
      if (!this.db) {
        await this.init();
      }

      return new Promise((resolve, reject) => {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(true);
      });
    } catch (error) {
      console.error(`Error clearing ${storeName}:`, error);
      return false;
    }
  }

  /**
   * Cleanup old cached data (older than specified days)
   * @param {string} storeName - Store name
   * @param {number} days - Keep data newer than this many days
   */
  async cleanupOldData(storeName, days = 7) {
    try {
      if (!this.db) {
        await this.init();
      }

      const cutoffTime = Date.now() - days * 24 * 60 * 60 * 1000;
      const allData = await this.getAllData(storeName);
      const oldData = allData.filter((item) => item.timestamp < cutoffTime);

      for (const item of oldData) {
        await this.deleteData(storeName, item.id);
      }

      console.log(`Cleaned up ${oldData.length} old items from ${storeName}`);
      return oldData.length;
    } catch (error) {
      console.error(`Error cleaning up ${storeName}:`, error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats() {
    try {
      const stats = {};
      for (const storeName of Object.values(STORES)) {
        const data = await this.getAllData(storeName);
        stats[storeName] = {
          count: data.length,
          size: JSON.stringify(data).length,
        };
      }
      return stats;
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return {};
    }
  }

  /**
   * Clear all cache
   */
  async clearAllCache() {
    try {
      for (const storeName of Object.values(STORES)) {
        await this.clearStore(storeName);
      }
      console.log('All cache cleared');
      return true;
    } catch (error) {
      console.error('Error clearing all cache:', error);
      return false;
    }
  }
}

export const STORE_NAMES = STORES;
export default new OfflineDataManager();
