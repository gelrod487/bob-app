// Minimal service worker: just enough for "Add to Home Screen" installability and a
// usable offline app shell. Deliberately does NOT cache /api/* — this app shows live
// financial data, and a stale cached response there would be actively misleading.
const CACHE_NAME = 'bob-shell-v1';
const SHELL_ASSETS = [
  '/app.html',
  '/login.html',
  '/css/bob.css',
  '/js/api.js',
  '/js/mascot.js',
  '/js/supabaseClient.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  // Network-first so a shell update is picked up as soon as it's reachable; falls back
  // to the cached copy when offline.
  event.respondWith(
    fetch(request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return res;
      })
      .catch(() => caches.match(request))
  );
});
