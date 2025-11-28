const CACHE_NAME = 'stories-cache-v1';
const OFFLINE_URL = '/index.html';

const ASSETS_TO_CACHE = [
	'/',
	'/index.html',
	'/manifest.json',
	'/icons/icon-192.png',
	'/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
	console.log('SW installing...');
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(ASSETS_TO_CACHE).catch(() => {
				console.warn('Some assets could not be cached during install');
			});
		})
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	console.log('SW activated');
	event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;

	event.respondWith(
		fetch(event.request)
			.then((response) => {
				const clone = response.clone();
				caches.open(CACHE_NAME).then((cache) => {
					cache.put(event.request, clone);
				});
				return response;
			})
			.catch(() =>
				caches.match(event.request).then((cached) =>
					cached || caches.match(OFFLINE_URL)
				)
			)
	);
});

self.addEventListener('push', (event) => {
	let notificationData = {
		title: 'New Story Added',
		body: 'Check out the latest story on Dicoding',
		data: { url: '/' }
	};

	if (event.data) {
		try {
			notificationData = event.data.json();
		} catch (e) {
			notificationData.body = event.data.text();
		}
	}

	event.waitUntil(
		self.registration.showNotification(notificationData.title, {
			body: notificationData.body,
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-72.png',
			data: notificationData.data
		})
	);
});

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
			for (const client of clientList) {
				if (client.url === '/' && 'focus' in client) {
					return client.focus();
				}
			}
			if (clients.openWindow) {
				return clients.openWindow(event.notification.data.url || '/');
			}
		})
	);
});
