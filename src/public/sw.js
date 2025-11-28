const CACHE_NAME = 'worldstory-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/images/logo.png',
  '/images/badge-icon.png',
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('Some assets failed to cache:', err);
      });
    })
  );
  self.skipWaiting();
});

/**
 * Activate event - cleanup old caches
 */
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

/**
 * Fetch event - implement caching strategies
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome extensions
  if (url.protocol === 'chrome-extension:') {
    return;
  }

  // Skip service worker requests
  if (url.pathname.includes('sw.js') || url.pathname.includes('service-worker')) {
    return;
  }

  // Static assets - cache first
  if (isStaticAsset(url)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // API requests - network first with cache fallback
  if (url.pathname.includes('/api/') || url.pathname.includes('/stories') || url.pathname.includes('/reports')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // HTML - network first but with better error handling
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstStrategyForHTML(request));
    return;
  }
});

/**
 * Network-first strategy
 * Try network first, fall back to cache
 */
async function networkFirstStrategy(request) {
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Network request failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline page if available
    return new Response('Offline - No cached data available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Network-first strategy for HTML files
 * Prevents infinite loops by handling errors gracefully
 */
async function networkFirstStrategyForHTML(request) {
  try {
    // Set a reasonable timeout for network request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const networkResponse = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);

    // Cache successful HTML responses
    if (networkResponse.ok && request.method === 'GET') {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log('Network request failed for HTML, trying cache:', request.url);

    // Try to get cached version
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // If no cache, return a simple loading page instead of error
    // This prevents infinite redirect loops
    return new Response(
      `<!DOCTYPE html>
<html>
<head>
  <title>Loading...</title>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
    div { text-align: center; }
    h1 { color: #333; }
    p { color: #666; }
  </style>
</head>
<body>
  <div>
    <h1>Memuat...</h1>
    <p>Aplikasi sedang memuat. Silakan tunggu atau refresh halaman.</p>
  </div>
  <script>
    // Auto refresh after 3 seconds if still loading
    setTimeout(() => location.reload(), 3000);
  </script>
</body>
</html>`,
      {
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      },
    );
  }
}

/**
 * Cache-first strategy
 * Use cache first, fall back to network
 */
async function cacheFirstStrategy(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }
  
  try {
    const networkResponse = await fetch(request);
    
    // Cache successful responses
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('Cache miss and network unavailable:', request.url);
    return new Response('Offline - Asset not available', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

/**
 * Check if URL is a static asset
 */
function isStaticAsset(url) {
  return /\.(js|css|png|jpg|jpeg|svg|gif|webp|woff|woff2|ttf|eot)(\?.*)?$/.test(url.pathname);
}

self.addEventListener('push', function (event) {
  let notificationData = {};
  try {
    if (event.data) {
      notificationData = event.data.json();
    }
  } catch (e) {
    notificationData = {
      title: 'Notifikasi',
      body: event.data ? event.data.text() : 'Ada notifikasi baru',
    };
  }

  const {
    title = 'WorldStory',
    body = 'Ada notifikasi baru',
    icon = '/images/logo.png',
    badge = '/images/logo.png',
    tag = 'notification',
    data = {},
    actions = [],
  } = notificationData;

  const options = {
    body,
    icon,
    badge,
    tag,
    data,
    actions,
    requireInteraction: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const { action, notification } = event;
  const data = notification.data || {};

  // Jika ada action-specific handling
  if (action === 'open') {
    const url = data.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
    );
  } else {
    // Click pada notifikasi itu sendiri (bukan action)
    const url = data.url || '/';
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      }),
    );
  }
});
