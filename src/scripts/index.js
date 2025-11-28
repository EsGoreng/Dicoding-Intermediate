import '../styles/styles.css';
import '../styles/responsives.css';
import '../styles/push-notification.css';
import '../styles/offline-operations.css';
import 'tiny-slider/dist/tiny-slider.css';
import 'leaflet/dist/leaflet.css';

import App from './pages/app';
import Camera from './utils/camera';
import syncEngine from './utils/sync-engine';

document.addEventListener('DOMContentLoaded', async () => {
  // Register Service Worker
  if ('serviceWorker' in navigator) {
    try {
      // Try both paths for compatibility
      let registered = false;
      try {
        await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered from /sw.js');
        registered = true;
      } catch (e1) {
        try {
          await navigator.serviceWorker.register('/public/sw.js');
          console.log('Service Worker registered from /public/sw.js');
          registered = true;
        } catch (e2) {
          console.error('Service Worker registration failed:', e2);
        }
      }

      if (registered) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        console.log(`Active Service Workers: ${registrations.length}`);
      }
    } catch (error) {
      console.error('Service Worker setup failed:', error);
    }
  }

  const app = new App({
    content: document.getElementById('main-content'),
    drawerButton: document.getElementById('drawer-button'),
    drawerNavigation: document.getElementById('navigation-drawer'),
    skipLinkButton: document.getElementById('skip-link'),
  });

  // Initialize sync engine for offline operations
  try {
    await syncEngine.init();
    console.log('Sync Engine initialized');
  } catch (error) {
    console.error('Failed to initialize sync engine:', error);
  }

  await app.renderPage();

  window.addEventListener('hashchange', async () => {
    await app.renderPage();

    Camera.stopAllStreams();
  });
});
