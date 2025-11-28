/**
 * Network Request Interceptor
 * Implements caching strategy: Network-First, Cache-Fallback
 */

import offlineDataManager, { STORE_NAMES } from './offline-data-manager';

const CACHE_STRATEGY = {
  NETWORK_FIRST: 'network-first', // Try network first, fall back to cache
  CACHE_FIRST: 'cache-first', // Use cache first, fall back to network
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate', // Return cache, update in background
};

const ENDPOINTS = {
  // Network-first (live data is important)
  [CACHE_STRATEGY.NETWORK_FIRST]: [
    '/stories',
    '/reports',
    '/users',
  ],
  // Cache-first (less frequent updates)
  [CACHE_STRATEGY.CACHE_FIRST]: [
    '/login',
    '/register',
  ],
  // Stale-while-revalidate (good UX, eventual consistency)
  [CACHE_STRATEGY.STALE_WHILE_REVALIDATE]: [
    '/stories',
  ],
};

class NetworkInterceptor {
  constructor() {
    this.isOnline = navigator.onLine;
    this.setupEventListeners();
  }

  setupEventListeners() {
    window.addEventListener('online', () => {
      console.log('App is online');
      this.isOnline = true;
    });

    window.addEventListener('offline', () => {
      console.log('App is offline');
      this.isOnline = false;
    });
  }

  /**
   * Determine caching strategy for endpoint
   */
  getStrategy(url) {
    for (const [strategy, endpoints] of Object.entries(ENDPOINTS)) {
      for (const endpoint of endpoints) {
        if (url.includes(endpoint)) {
          return strategy;
        }
      }
    }
    // Default to network-first
    return CACHE_STRATEGY.NETWORK_FIRST;
  }

  /**
   * Get cache key for URL
   */
  getCacheKey(url) {
    return url.split('?')[0]; // Remove query params
  }

  /**
   * Save response to cache
   */
  async cacheResponse(url, response, storeName) {
    try {
      const data = await response.clone().json();
      const cacheKey = this.getCacheKey(url);

      await offlineDataManager.saveData(
        storeName,
        {
          ...data,
          endpoint: cacheKey,
        },
        cacheKey
      );

      console.log(`Cached: ${url}`);
      return data;
    } catch (error) {
      console.error('Error caching response:', error);
      return null;
    }
  }

  /**
   * Get cached response
   */
  async getCachedResponse(url, storeName) {
    try {
      const cacheKey = this.getCacheKey(url);
      const cachedData = await offlineDataManager.getData(storeName, cacheKey);
      
      if (cachedData) {
        console.log(`Retrieved from cache: ${url}`);
        return cachedData;
      }
      return null;
    } catch (error) {
      console.error('Error getting cached response:', error);
      return null;
    }
  }

  /**
   * Determine store name from URL
   */
  getStoreNameFromUrl(url) {
    if (url.includes('/stories') && url.match(/\/stories\/\d+/)) {
      return STORE_NAMES.STORY_DETAIL;
    }
    if (url.includes('/stories')) {
      return STORE_NAMES.STORIES;
    }
    if (url.includes('/reports') && url.match(/\/reports\/\d+/)) {
      return STORE_NAMES.REPORT_DETAIL;
    }
    if (url.includes('/reports')) {
      return STORE_NAMES.REPORTS;
    }
    if (url.includes('/comments')) {
      return STORE_NAMES.COMMENTS;
    }
    if (url.includes('/users')) {
      return STORE_NAMES.USER_INFO;
    }
    return null;
  }

  /**
   * Network-First Strategy
   * Try to get from network, fall back to cache if offline
   */
  async networkFirst(url, fetchFn, storeName) {
    try {
      // Try network first
      if (this.isOnline) {
        const response = await fetchFn();
        if (response.ok) {
          // Cache successful response
          if (storeName) {
            await this.cacheResponse(url, response.clone(), storeName);
          }
          return response;
        }
      }
    } catch (error) {
      console.warn('Network request failed:', error);
    }

    // Fall back to cache
    if (storeName) {
      const cachedData = await this.getCachedResponse(url, storeName);
      if (cachedData) {
        return new Response(JSON.stringify(cachedData), {
          status: 200,
          statusText: 'OK (from cache)',
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    throw new Error('Network request failed and no cache available');
  }

  /**
   * Cache-First Strategy
   * Check cache first, only use network if cache miss
   */
  async cacheFirst(url, fetchFn, storeName) {
    // Check cache first
    if (storeName) {
      const cachedData = await this.getCachedResponse(url, storeName);
      if (cachedData) {
        return new Response(JSON.stringify(cachedData), {
          status: 200,
          statusText: 'OK (from cache)',
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    // Fall back to network
    if (this.isOnline) {
      try {
        const response = await fetchFn();
        if (response.ok) {
          // Cache for future use
          if (storeName) {
            await this.cacheResponse(url, response.clone(), storeName);
          }
          return response;
        }
      } catch (error) {
        console.error('Network request failed:', error);
      }
    }

    throw new Error('Cache miss and network unavailable');
  }

  /**
   * Stale-While-Revalidate Strategy
   * Return cache immediately, update in background
   */
  async staleWhileRevalidate(url, fetchFn, storeName) {
    const cachePromise = this.getCachedResponse(url, storeName);

    const networkPromise = (async () => {
      if (this.isOnline) {
        try {
          const response = await fetchFn();
          if (response.ok) {
            if (storeName) {
              await this.cacheResponse(url, response.clone(), storeName);
            }
            return response;
          }
        } catch (error) {
          console.warn('Background network update failed:', error);
        }
      }
      return null;
    })();

    // Return cache immediately if available
    const cachedData = await cachePromise;
    if (cachedData) {
      // Still try to update in background
      networkPromise.catch(console.error);
      
      return new Response(JSON.stringify(cachedData), {
        status: 200,
        statusText: 'OK (from cache, updating)',
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // No cache, wait for network
    const networkResponse = await networkPromise;
    if (networkResponse) {
      return networkResponse;
    }

    throw new Error('No cache and network request failed');
  }

  /**
   * Main intercept method
   */
  async intercept(url, fetchFn) {
    const strategy = this.getStrategy(url);
    const storeName = this.getStoreNameFromUrl(url);

    try {
      switch (strategy) {
        case CACHE_STRATEGY.CACHE_FIRST:
          return await this.cacheFirst(url, fetchFn, storeName);

        case CACHE_STRATEGY.STALE_WHILE_REVALIDATE:
          return await this.staleWhileRevalidate(url, fetchFn, storeName);

        case CACHE_STRATEGY.NETWORK_FIRST:
        default:
          return await this.networkFirst(url, fetchFn, storeName);
      }
    } catch (error) {
      console.error(`Intercept failed for ${url}:`, error);
      throw error;
    }
  }
}

export default new NetworkInterceptor();
