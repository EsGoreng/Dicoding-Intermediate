import PushNotificationManager from '../utils/push-notification';

class PushNotificationToggle {
  constructor(containerId = 'push-notification-tools') {
    this.containerId = containerId;
    this.container = null;
    this.toggleButton = null;
    this.init();
  }

  async init() {
    this.container = document.getElementById(this.containerId);
    if (!this.container) {
      console.warn(`Container ${this.containerId} not found`);
      return;
    }

    await PushNotificationManager.init();
    
    // Subscribe to state changes
    PushNotificationManager.subscribe(() => {
      this.updateButtonState();
    });

    this.render();
    this.attachEventListeners();
    await this.updateButtonState();
  }

  render() {
    const isSubscribed = PushNotificationManager.isSubscribed();
    
    this.container.innerHTML = `
      <button 
        id="push-notification-toggle" 
        class="push-notification-navbar-btn ${isSubscribed ? 'active' : ''}"
        aria-label="Toggle push notification"
        title="Push Notification"
      >
        <i class="fas fa-bell"></i>
        <span class="push-status-indicator ${isSubscribed ? 'active' : ''}"></span>
      </button>
    `;

    this.toggleButton = document.getElementById('push-notification-toggle');
  }

  attachEventListeners() {
    if (this.toggleButton) {
      this.toggleButton.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleToggle();
      });
    }
  }

  async handleToggle() {
    this.toggleButton.disabled = true;

    try {
      if (PushNotificationManager.isSubscribed()) {
        await PushNotificationManager.unsubscribe();
      } else {
        await PushNotificationManager.subscribe();
      }
    } catch (error) {
      console.error('Error toggling push notification:', error);
      this.showToast('Error: ' + error.message);
    } finally {
      this.toggleButton.disabled = false;
    }
  }

  async updateButtonState() {
    if (!this.toggleButton) return;

    const isSubscribed = PushNotificationManager.isSubscribed();

    if (isSubscribed) {
      this.toggleButton.classList.add('active');
      this.toggleButton.title = 'Push Notification (Active)';
    } else {
      this.toggleButton.classList.remove('active');
      this.toggleButton.title = 'Push Notification (Inactive)';
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'push-notification-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  reinitialize() {
    this.init();
  }
}

export default PushNotificationToggle;
