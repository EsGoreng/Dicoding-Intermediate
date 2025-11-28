/**
 * Offline Operations Demo Page
 * Shows how to create, read, delete operations offline with sync
 */

import { getAccessToken } from '../../utils/auth';
import offlineSyncManager, { OPERATION_TYPES, SYNC_STATUS } from '../../utils/offline-sync-manager';
import syncEngine from '../../utils/sync-engine';

class OfflineOperationsPage {
  constructor() {
    this.operations = [];
    this.syncUnsubscribe = null;
  }

  async render() {
    await offlineSyncManager.init();
    await syncEngine.init();

    this.operations = await offlineSyncManager.getPendingOperations();

    const status = await syncEngine.getStatus();

    return `
      <div class="offline-operations-page">
        <div class="page-header">
          <h1>📋 Offline Operations Demo</h1>
          <p>Create, read, and delete operations offline. Auto-sync when online.</p>
        </div>

        <!-- Status Panel -->
        <div class="status-panel ${status.isOnline ? 'online' : 'offline'}">
          <div class="status-indicator">
            <span class="status-dot ${status.isOnline ? 'online' : 'offline'}"></span>
            <span class="status-text">${status.isOnline ? 'Online' : 'Offline'}</span>
          </div>
          ${status.isSyncing ? `
            <div class="sync-status">
              <span class="spinner"></span>
              Syncing... (${status.byStatus.syncing} operations)
            </div>
          ` : `
            <div class="sync-status">
              ${status.pendingCount > 0 ? `
                ${status.pendingCount} pending operations
                ${status.lastSyncTime ? `(Last sync: ${new Date(status.lastSyncTime).toLocaleTimeString()})` : ''}
              ` : `
                All synced ✓
              `}
            </div>
          `}
        </div>

        <!-- Control Panel -->
        <div class="control-panel">
          <div class="control-group">
            <h3>Create New Operation</h3>
            <div class="form-group">
              <input 
                type="text" 
                id="operation-name" 
                placeholder="Enter operation name"
                class="form-input"
              />
            </div>
            <div class="form-group">
              <select id="operation-type" class="form-input">
                <option value="CREATE">Create Story</option>
                <option value="UPDATE">Update Story</option>
                <option value="DELETE">Delete Story</option>
              </select>
            </div>
            <button id="create-operation-btn" class="btn btn-primary">
              Create Operation
            </button>
          </div>

          <div class="control-group">
            <button id="sync-now-btn" class="btn btn-secondary" ${!status.isOnline || status.isSyncing ? 'disabled' : ''}>
              Sync Now
            </button>
            <button id="retry-failed-btn" class="btn btn-warning" ${status.byStatus.failed === 0 ? 'disabled' : ''}>
              Retry Failed (${status.byStatus.failed})
            </button>
          </div>

          <div class="control-group">
            <button id="view-logs-btn" class="btn btn-info">
              View Sync Log
            </button>
            <button id="clear-operations-btn" class="btn btn-danger">
              Clear All
            </button>
          </div>
        </div>

        <!-- Statistics -->
        <div class="stats-panel">
          <h3>📊 Operation Statistics</h3>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-value">${this.operations.length}</div>
              <div class="stat-label">Total Operations</div>
            </div>
            <div class="stat-card pending">
              <div class="stat-value">${status.byStatus.pending}</div>
              <div class="stat-label">Pending</div>
            </div>
            <div class="stat-card syncing">
              <div class="stat-value">${status.byStatus.syncing}</div>
              <div class="stat-label">Syncing</div>
            </div>
            <div class="stat-card synced">
              <div class="stat-value">${status.byStatus.synced}</div>
              <div class="stat-label">Synced</div>
            </div>
            <div class="stat-card failed">
              <div class="stat-value">${status.byStatus.failed}</div>
              <div class="stat-label">Failed</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${status.byOperation.CREATE}</div>
              <div class="stat-label">Creates</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${status.byOperation.UPDATE}</div>
              <div class="stat-label">Updates</div>
            </div>
            <div class="stat-card">
              <div class="stat-value">${status.byOperation.DELETE}</div>
              <div class="stat-label">Deletes</div>
            </div>
          </div>
        </div>

        <!-- Operations List -->
        <div class="operations-panel">
          <h3>📝 Pending Operations</h3>
          ${this.operations.length === 0 ? `
            <div class="empty-state">
              <p>No pending operations</p>
            </div>
          ` : `
            <div class="operations-list">
              ${this.operations.map(op => `
                <div class="operation-card status-${op.status}">
                  <div class="operation-header">
                    <span class="operation-type">${op.operationType}</span>
                    <span class="operation-endpoint">${op.endpoint}</span>
                    <span class="operation-status">${op.status}</span>
                  </div>
                  <div class="operation-body">
                    <small class="timestamp">${new Date(op.timestamp).toLocaleString()}</small>
                    <pre class="payload">${JSON.stringify(op.payload, null, 2)}</pre>
                  </div>
                  <div class="operation-actions">
                    <button class="btn-small delete-operation" data-id="${op.id}">Delete</button>
                    ${op.status === SYNC_STATUS.FAILED ? `
                      <button class="btn-small retry-operation" data-id="${op.id}">Retry</button>
                    ` : ''}
                  </div>
                  ${op.error ? `
                    <div class="operation-error">
                      Error: ${op.error}
                    </div>
                  ` : ''}
                </div>
              `).join('')}
            </div>
          `}
        </div>

        <!-- Sync Log -->
        <div class="sync-log-panel" id="sync-log-panel" style="display: none;">
          <h3>📜 Sync Log</h3>
          <div class="sync-log" id="sync-log-content"></div>
        </div>
      </div>
    `;
  }

  async afterRender() {
    // Register event listeners
    document.getElementById('create-operation-btn')?.addEventListener('click', () => {
      this.createOperation();
    });

    document.getElementById('sync-now-btn')?.addEventListener('click', () => {
      this.syncNow();
    });

    document.getElementById('retry-failed-btn')?.addEventListener('click', () => {
      this.retryFailed();
    });

    document.getElementById('view-logs-btn')?.addEventListener('click', () => {
      this.toggleLogs();
    });

    document.getElementById('clear-operations-btn')?.addEventListener('click', () => {
      this.clearOperations();
    });

    // Delete operations
    document.querySelectorAll('.delete-operation').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.deleteOperation(id);
      });
    });

    // Retry operations
    document.querySelectorAll('.retry-operation').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        this.retryOperation(id);
      });
    });

    // Listen for sync status changes
    this.syncUnsubscribe = offlineSyncManager.onSyncStatusChange(() => {
      this.refreshPage();
    });
  }

  async createOperation() {
    const name = document.getElementById('operation-name')?.value;
    const type = document.getElementById('operation-type')?.value;

    if (!name) {
      alert('Please enter operation name');
      return;
    }

    try {
      const payload = {
        title: name,
        description: `Operation: ${name}`,
        timestamp: Date.now(),
      };

      const endpoint = '/api/stories'; // Example endpoint
      
      await offlineSyncManager.addPendingOperation(
        type,
        endpoint,
        payload,
        {
          localId: `local_${Date.now()}`,
        }
      );

      // Clear input
      document.getElementById('operation-name').value = '';

      // Show success message
      this.showMessage(`Operation created: ${name}`, 'success');

      // Refresh and attempt sync if online
      this.refreshPage();

      if (navigator.onLine) {
        setTimeout(() => syncEngine.syncAll(), 1000);
      }
    } catch (error) {
      console.error('Error creating operation:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    }
  }

  async deleteOperation(operationId) {
    if (confirm('Delete this operation?')) {
      try {
        await offlineSyncManager.deleteOperation(operationId);
        this.showMessage('Operation deleted', 'success');
        this.refreshPage();
      } catch (error) {
        console.error('Error deleting operation:', error);
        this.showMessage(`Error: ${error.message}`, 'error');
      }
    }
  }

  async syncNow() {
    try {
      await syncEngine.syncAll();
      this.showMessage('Sync started', 'info');
      this.refreshPage();
    } catch (error) {
      console.error('Error syncing:', error);
      this.showMessage(`Sync error: ${error.message}`, 'error');
    }
  }

  async retryFailed() {
    try {
      await syncEngine.retryFailed();
      this.showMessage('Retrying failed operations...', 'info');
      this.refreshPage();
    } catch (error) {
      console.error('Error retrying:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    }
  }

  async retryOperation(operationId) {
    try {
      const operation = await offlineSyncManager.updateOperationStatus(
        operationId,
        SYNC_STATUS.PENDING
      );
      this.showMessage('Operation reset to pending', 'success');
      this.refreshPage();

      if (navigator.onLine) {
        setTimeout(() => syncEngine.syncAll(), 1000);
      }
    } catch (error) {
      console.error('Error retrying operation:', error);
      this.showMessage(`Error: ${error.message}`, 'error');
    }
  }

  async toggleLogs() {
    const logPanel = document.getElementById('sync-log-panel');
    if (logPanel.style.display === 'none') {
      logPanel.style.display = 'block';
      await this.loadLogs();
    } else {
      logPanel.style.display = 'none';
    }
  }

  async loadLogs() {
    try {
      const logs = await offlineSyncManager.getSyncLog(20);
      const logContent = document.getElementById('sync-log-content');

      if (logs.length === 0) {
        logContent.innerHTML = '<p class="empty-state">No sync log entries</p>';
        return;
      }

      logContent.innerHTML = logs.map(log => `
        <div class="log-entry">
          <span class="log-timestamp">${new Date(log.timestamp).toLocaleString()}</span>
          <span class="log-status">${log.status}</span>
          <span class="log-operation">Operation #${log.operationId}</span>
          ${log.error ? `<span class="log-error">${log.error}</span>` : ''}
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading logs:', error);
    }
  }

  async clearOperations() {
    if (confirm('Clear all pending operations? This cannot be undone.')) {
      try {
        await offlineSyncManager.clearAll();
        this.showMessage('All operations cleared', 'success');
        this.refreshPage();
      } catch (error) {
        console.error('Error clearing operations:', error);
        this.showMessage(`Error: ${error.message}`, 'error');
      }
    }
  }

  showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `toast ${type}`;
    messageDiv.textContent = message;
    messageDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
      color: white;
      border-radius: 4px;
      z-index: 1000;
      animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 3000);
  }

  refreshPage() {
    // Trigger page re-render
    window.dispatchEvent(new Event('hashchange'));
  }
}

export default OfflineOperationsPage;
