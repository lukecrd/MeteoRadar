// MeteoRadar 3D & Storm Track - Service Worker for Android PWA
const CACHE_NAME = 'meteoradar-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
  '/src/main.tsx',
  '/src/App.tsx',
  '/src/index.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch(() => {
        // Fallback gracefully if some resources are dynamic
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Pass through external API calls and tile servers dynamically
  if (
    event.request.url.includes('api.open-meteo.com') ||
    event.request.url.includes('tile.openstreetmap.org') ||
    event.request.url.includes('arcgisonline.com') ||
    event.request.url.includes('cartocdn.com') ||
    event.request.url.includes('google')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).catch(() => {
        // Offline fallback if needed
        return caches.match('/');
      });
    })
  );
});
