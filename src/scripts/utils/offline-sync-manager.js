
const DB_NAME = 'worldstory_offline_sync';
const DB_VERSION = 1;

const STORES = {
  PENDING_OPERATIONS: 'pending_operations',
  SYNC_LOG: 'sync_log',
  LOCAL_DRAFTS: 'local_drafts',
};

const OPERATION_TYPES = {
  CREATE: 'CREATE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
};

const SYNC_STATUS = {
  PENDING: 'pending',
  SYNCING: 'syncing',
  SYNCED: 'synced',
  FAILED: 'failed',
};

class OfflineSyncManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.isSyncing = false;
    this.syncCallbacks = [];
  }

  /**
   * Initialize IndexedDB for offline sync
   */
  async init() {
    return new Promise((resolve, reject) => {
      if (this.isInitialized) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Offline Sync DB error:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('Offline Sync Manager initialized');
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store untuk pending operations
        if (!db.objectStoreNames.contains(STORES.PENDING_OPERATIONS)) {
          const pendingStore = db.createObjectStore(
            STORES.PENDING_OPERATIONS,
            { keyPath: 'id', autoIncrement: true }
          );
          pendingStore.createIndex('status', 'status', { unique: false });
          pendingStore.createIndex('endpoint', 'endpoint', { unique: false });
          pendingStore.createIndex('timestamp', 'timestamp', { unique: false });
          console.log('Created pending operations store');
        }

        // Store untuk sync log
        if (!db.objectStoreNames.contains(STORES.SYNC_LOG)) {
          const syncLogStore = db.createObjectStore(
            STORES.SYNC_LOG,
            { keyPath: 'id', autoIncrement: true }
          );
          syncLogStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncLogStore.createIndex('status', 'status', { unique: false });
          console.log('Created sync log store');
        }

        // Store untuk local drafts
        if (!db.objectStoreNames.contains(STORES.LOCAL_DRAFTS)) {
          db.createObjectStore(
            STORES.LOCAL_DRAFTS,
            { keyPath: 'id' }
          );
          console.log('Created local drafts store');
        }
      };
    });
  }

  /**
   * Add pending operation (create, update, or delete)
   */
  async addPendingOperation(
    operationType,
    endpoint,
    payload,
    options = {}
  ) {
    await this.init();

    const operation = {
      operationType, // CREATE, UPDATE, DELETE
      endpoint,
      payload,
      status: SYNC_STATUS.PENDING,
      timestamp: Date.now(),
      retries: 0,
      maxRetries: options.maxRetries || 3,
      localId: options.localId || null, // For tracking local creation
      serverId: options.serverId || null, // For tracking on server
      error: null,
      ...options,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.PENDING_OPERATIONS],
        'readwrite'
      );
      const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
      const request = store.add(operation);

      request.onerror = () => {
        console.error('Failed to add pending operation:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        console.log('Pending operation added:', operation.operationType, operation.endpoint);
        resolve(request.result);
      };
    });
  }

  /**
   * Get all pending operations
   */
  async getPendingOperations(filter = {}) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.PENDING_OPERATIONS],
        'readonly'
      );
      const store = transaction.objectStore(STORES.PENDING_OPERATIONS);

      let query = store.getAll();

      if (filter.status) {
        query = store.index('status').getAll(filter.status);
      }

      query.onerror = () => {
        console.error('Failed to get pending operations:', query.error);
        reject(query.error);
      };

      query.onsuccess = () => {
        const operations = query.result || [];
        resolve(operations);
      };
    });
  }

  /**
   * Update operation status
   */
  async updateOperationStatus(operationId, status, error = null) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.PENDING_OPERATIONS],
        'readwrite'
      );
      const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
      const getRequest = store.get(operationId);

      getRequest.onsuccess = () => {
        const operation = getRequest.result;
        if (operation) {
          operation.status = status;
          operation.error = error;
          operation.updatedAt = Date.now();

          const updateRequest = store.put(operation);
          updateRequest.onerror = () => reject(updateRequest.error);
          updateRequest.onsuccess = () => resolve(operation);
        } else {
          reject(new Error('Operation not found'));
        }
      };

      getRequest.onerror = () => reject(getRequest.error);
    });
  }

  /**
   * Delete operation (after successful sync)
   */
  async deleteOperation(operationId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.PENDING_OPERATIONS],
        'readwrite'
      );
      const store = transaction.objectStore(STORES.PENDING_OPERATIONS);
      const request = store.delete(operationId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        console.log('Operation deleted:', operationId);
        resolve();
      };
    });
  }

  /**
   * Log sync activity
   */
  async logSync(operationId, status, response = null, error = null) {
    await this.init();

    const logEntry = {
      operationId,
      status,
      timestamp: Date.now(),
      response,
      error: error ? error.toString() : null,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.SYNC_LOG],
        'readwrite'
      );
      const store = transaction.objectStore(STORES.SYNC_LOG);
      const request = store.add(logEntry);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(logEntry);
    });
  }

  /**
   * Get sync log
   */
  async getSyncLog(limit = 50) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.SYNC_LOG],
        'readonly'
      );
      const store = transaction.objectStore(STORES.SYNC_LOG);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev');

      const logs = [];
      let count = 0;

      request.onerror = () => reject(request.error);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && count < limit) {
          logs.push(cursor.value);
          count++;
          cursor.continue();
        } else {
          resolve(logs);
        }
      };
    });
  }

  /**
   * Save local draft (for optimistic UI)
   */
  async saveDraft(draftId, data) {
    await this.init();

    const draft = {
      id: draftId,
      data,
      savedAt: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.LOCAL_DRAFTS],
        'readwrite'
      );
      const store = transaction.objectStore(STORES.LOCAL_DRAFTS);
      const request = store.put(draft);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(draft);
    });
  }

  /**
   * Get draft
   */
  async getDraft(draftId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.LOCAL_DRAFTS],
        'readonly'
      );
      const store = transaction.objectStore(STORES.LOCAL_DRAFTS);
      const request = store.get(draftId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  /**
   * Delete draft
   */
  async deleteDraft(draftId) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [STORES.LOCAL_DRAFTS],
        'readwrite'
      );
      const store = transaction.objectStore(STORES.LOCAL_DRAFTS);
      const request = store.delete(draftId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Register callback for sync events
   */
  onSyncStatusChange(callback) {
    this.syncCallbacks.push(callback);
    return () => {
      this.syncCallbacks = this.syncCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Notify all listeners of sync status change
   */
  notifySyncStatusChange(data) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error('Sync callback error:', error);
      }
    });
  }

  /**
   * Get stats
   */
  async getStats() {
    const pendingOps = await this.getPendingOperations();
    const syncLog = await this.getSyncLog(100);

    const stats = {
      totalPending: pendingOps.length,
      byStatus: {
        pending: 0,
        syncing: 0,
        synced: 0,
        failed: 0,
      },
      byOperation: {
        CREATE: 0,
        UPDATE: 0,
        DELETE: 0,
      },
      recentSync: syncLog.slice(0, 5),
    };

    pendingOps.forEach(op => {
      stats.byStatus[op.status]++;
      stats.byOperation[op.operationType]++;
    });

    return stats;
  }

  /**
   * Clear all data (for testing)
   */
  async clearAll() {
    await this.init();

    const stores = [
      STORES.PENDING_OPERATIONS,
      STORES.SYNC_LOG,
      STORES.LOCAL_DRAFTS,
    ];

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(stores, 'readwrite');

      stores.forEach(storeName => {
        const store = transaction.objectStore(storeName);
        store.clear();
      });

      transaction.onerror = () => reject(transaction.error);
      transaction.oncomplete = () => {
        console.log('All offline sync data cleared');
        resolve();
      };
    });
  }
}

// Export singleton instance
const offlineSyncManager = new OfflineSyncManager();
export { offlineSyncManager, OPERATION_TYPES, SYNC_STATUS };
export default offlineSyncManager;
