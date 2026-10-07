// WorldHub - Service Worker (PWA / offline support)
//
// Strategy:
// - Page navigations: network first, cached copy only when offline. The old
//   cache-first index.html pinned visitors to a build whose hashed assets no
//   longer exist after a redeploy (blank page).
// - /assets/*: cache first — Vite gives every build new file names.
// - /api/* and cross-origin requests: never touched (always live data).
//
// Bump CACHE_NAME whenever this strategy changes: activate() drops old caches.
const CACHE_NAME = 'meteoradar-v2';
const SHELL = ['/', '/manifest.json', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL))
      .catch(() => {
        // Precaching is best effort; the app works online without it.
      })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => caches.match('/').then((cached) => cached || Response.error()))
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return response;
          })
      )
    );
    return;
  }

  // Everything else (manifest, icon, …): network, falling back to cache offline.
  event.respondWith(fetch(request).catch(() => caches.match(request).then((cached) => cached || Response.error())));
});
