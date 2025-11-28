import { BASE_URL, VAPID_PUBLIC_KEY } from '../config';
import { getAccessToken } from './auth';
import { subscribePushNotification, unsubscribePushNotification } from '../data/api';

class PushNotificationManager {
  constructor() {
    this.registration = null;
    this.subscription = null;
    this.listeners = [];
  }

  subscribe(callback) {
    this.listeners.push(callback);
  }

  notifyListeners() {
    this.listeners.forEach(callback => callback(this.isSubscribed()));
  }

  async init() {
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Worker tidak didukung');
      return false;
    }

    if (!('PushManager' in window)) {
      console.warn('Push Manager tidak didukung');
      return false;
    }

    try {
      this.registration = await navigator.serviceWorker.ready;
      await this.checkSubscription();
      return true;
    } catch (error) {
      console.error('Error initializing push notification:', error);
      return false;
    }
  }

  async checkSubscription() {
    if (!this.registration) return null;

    try {
      this.subscription = await this.registration.pushManager.getSubscription();
      return this.subscription;
    } catch (error) {
      console.error('Error checking subscription:', error);
      return null;
    }
  }

  async requestPermission() {
    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }

  async subscribe() {
    try {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('Notification permission denied');
      }

      if (!this.registration) {
        this.registration = await navigator.serviceWorker.ready;
      }

      const subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });

      // Kirim subscription ke server
      await this.sendSubscriptionToServer(subscription);

      this.subscription = subscription;
      this.saveSubscriptionLocal(subscription);
      this.notifyListeners();
      return subscription;
    } catch (error) {
      console.error('Error subscribing to push:', error);
      throw error;
    }
  }

  async unsubscribe() {
    try {
      if (!this.subscription) {
        this.subscription = await this.checkSubscription();
      }

      if (this.subscription) {
        await this.sendUnsubscribeToServer(this.subscription);
        await this.subscription.unsubscribe();
        this.subscription = null;
        this.clearSubscriptionLocal();
      }

      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('Error unsubscribing from push:', error);
      throw error;
    }
  }

  async sendSubscriptionToServer(subscription) {
    try {
      const subscriptionJson = subscription.toJSON();
      const { endpoint, keys } = subscriptionJson;

      // Use existing API function from api.js
      const response = await subscribePushNotification({
        endpoint,
        keys,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.message || 'Failed to subscribe'}`);
      }

      return response;
    } catch (error) {
      console.error('Error sending subscription to server:', error);
      throw error;
    }
  }

  async sendUnsubscribeToServer(subscription) {
    try {
      const subscriptionJson = subscription.toJSON();
      const { endpoint } = subscriptionJson;

      // Use existing API function from api.js
      const response = await unsubscribePushNotification({
        endpoint,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.message || 'Failed to unsubscribe'}`);
      }

      return response;
    } catch (error) {
      console.error('Error sending unsubscribe to server:', error);
      throw error;
    }
  }

  isSubscribed() {
    return this.subscription !== null;
  }

  urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }

    return outputArray;
  }

  saveSubscriptionLocal(subscription) {
    try {
      localStorage.setItem('pushSubscription', JSON.stringify(subscription.toJSON()));
    } catch (error) {
      console.error('Error saving subscription locally:', error);
    }
  }

  clearSubscriptionLocal() {
    try {
      localStorage.removeItem('pushSubscription');
    } catch (error) {
      console.error('Error clearing local subscription:', error);
    }
  }
}

export default new PushNotificationManager();
