/**
 * Offline Synchronization Engine
 * Handles syncing pending operations with the server
 */

import offlineSyncManager, { SYNC_STATUS, OPERATION_TYPES } from './offline-sync-manager';
import { getAccessToken } from './auth';

const SYNC_INTERVAL = 5000; // 5 seconds
const SYNC_TIMEOUT = 30000; // 30 seconds per operation

class SyncEngine {
  constructor() {
    this.isOnline = navigator.onLine;
    this.isSyncing = false;
    this.syncIntervalId = null;
    this.lastSyncTime = null;
  }

  /**
   * Initialize sync engine
   */
  async init() {
    await offlineSyncManager.init();

    // Listen for online/offline events
    window.addEventListener('online', () => this.onOnline());
    window.addEventListener('offline', () => this.onOffline());

    // Auto sync if online
    if (this.isOnline) {
      this.startAutoSync();
    }

    console.log('Sync Engine initialized');
  }

  /**
   * Called when device comes online
   */
  onOnline() {
    console.log('Device is online - starting sync');
    this.isOnline = true;
    this.startAutoSync();
  }

  /**
   * Called when device goes offline
   */
  onOffline() {
    console.log('Device is offline');
    this.isOnline = false;
    this.stopAutoSync();
  }

  /**
   * Start automatic sync interval
   */
  startAutoSync() {
    if (this.syncIntervalId) {
      return; // Already running
    }

    console.log('Starting auto sync...');
    this.syncAll(); // Sync immediately

    this.syncIntervalId = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncAll().catch(error => {
          console.error('Auto sync error:', error);
        });
      }
    }, SYNC_INTERVAL);
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
      console.log('Auto sync stopped');
    }
  }

  /**
   * Sync all pending operations
   */
  async syncAll() {
    if (this.isSyncing || !this.isOnline) {
      return;
    }

    this.isSyncing = true;
    offlineSyncManager.notifySyncStatusChange({
      isSyncing: true,
      pendingCount: 0,
    });

    try {
      const pendingOps = await offlineSyncManager.getPendingOperations({
        status: SYNC_STATUS.PENDING,
      });

      console.log(`Syncing ${pendingOps.length} pending operations...`);

      for (const operation of pendingOps) {
        try {
          await this.syncOperation(operation);
        } catch (error) {
          console.error(`Failed to sync operation ${operation.id}:`, error);
        }
      }

      this.lastSyncTime = Date.now();
      console.log('Sync complete');

      // Notify about sync completion
      const stats = await offlineSyncManager.getStats();
      offlineSyncManager.notifySyncStatusChange({
        isSyncing: false,
        pendingCount: stats.totalPending,
        lastSyncTime: this.lastSyncTime,
      });
    } catch (error) {
      console.error('Sync all error:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync single operation
   */
  async syncOperation(operation) {
    console.log(`Syncing ${operation.operationType} to ${operation.endpoint}`);

    await offlineSyncManager.updateOperationStatus(
      operation.id,
      SYNC_STATUS.SYNCING
    );

    try {
      const response = await this.executeOperation(operation);

      // Mark as synced
      await offlineSyncManager.updateOperationStatus(
        operation.id,
        SYNC_STATUS.SYNCED
      );

      // Log success
      await offlineSyncManager.logSync(
        operation.id,
        SYNC_STATUS.SYNCED,
        response
      );

      // Delete operation after successful sync
      await offlineSyncManager.deleteOperation(operation.id);

      console.log(`Operation ${operation.id} synced successfully`);

      // Notify listeners
      offlineSyncManager.notifySyncStatusChange({
        operationId: operation.id,
        status: SYNC_STATUS.SYNCED,
      });

      return response;
    } catch (error) {
      console.error(`Sync operation ${operation.id} failed:`, error);

      // Update retry count
      operation.retries = (operation.retries || 0) + 1;

      if (operation.retries >= operation.maxRetries) {
        // Mark as failed after max retries
        await offlineSyncManager.updateOperationStatus(
          operation.id,
          SYNC_STATUS.FAILED,
          error.message
        );

        await offlineSyncManager.logSync(
          operation.id,
          SYNC_STATUS.FAILED,
          null,
          error
        );

        console.error(`Operation ${operation.id} marked as failed (max retries reached)`);

        // Notify listeners
        offlineSyncManager.notifySyncStatusChange({
          operationId: operation.id,
          status: SYNC_STATUS.FAILED,
          error: error.message,
        });
      } else {
        // Keep as pending for retry
        await offlineSyncManager.updateOperationStatus(
          operation.id,
          SYNC_STATUS.PENDING,
          null
        );
      }

      throw error;
    }
  }

  /**
   * Execute operation on server
   */
  async executeOperation(operation) {
    const token = getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    let url = operation.endpoint;
    let method = 'POST';
    let body = null;

    switch (operation.operationType) {
      case OPERATION_TYPES.CREATE:
        method = 'POST';
        body = JSON.stringify(operation.payload);
        break;

      case OPERATION_TYPES.UPDATE:
        method = 'PUT';
        if (operation.payload.id) {
          url = `${url}/${operation.payload.id}`;
        }
        body = JSON.stringify(operation.payload);
        break;

      case OPERATION_TYPES.DELETE:
        method = 'DELETE';
        if (operation.payload.id) {
          url = `${url}/${operation.payload.id}`;
        }
        break;

      default:
        throw new Error(`Unknown operation type: ${operation.operationType}`);
    }

    // Execute with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SYNC_TIMEOUT);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(
          `Server error: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === 'AbortError') {
        throw new Error('Sync timeout');
      }

      throw error;
    }
  }

  /**
   * Get sync status
   */
  async getStatus() {
    const stats = await offlineSyncManager.getStats();

    return {
      isOnline: this.isOnline,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      pendingCount: stats.totalPending,
      byStatus: stats.byStatus,
      byOperation: stats.byOperation,
    };
  }

  /**
   * Retry failed operations
   */
  async retryFailed() {
    const failedOps = await offlineSyncManager.getPendingOperations({
      status: SYNC_STATUS.FAILED,
    });

    console.log(`Retrying ${failedOps.length} failed operations...`);

    for (const operation of failedOps) {
      operation.retries = 0; // Reset retries
      await offlineSyncManager.updateOperationStatus(
        operation.id,
        SYNC_STATUS.PENDING
      );
    }

    // Start sync
    this.syncAll();
  }
}

// Export singleton
const syncEngine = new SyncEngine();
export default syncEngine;
