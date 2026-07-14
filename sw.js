const CACHE_NAME = 'huaban-mobile-shell-v12-recruit';
const APP_SHELL = [
  '/',
  '/index.html',
  '/official.html',
  '/recruit.html',
  '/ai.html',
  '/manifest.json',
  '/assets/brand/huaban-logo-v1.png',
  '/assets/brand/apple-touch-icon.png',
  '/assets/brand/icon-192.png',
  '/assets/brand/icon-512.png',
  '/assets/brand/huaban-qr-logo.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname === '/admin' || url.pathname === '/admin.html' || url.pathname.startsWith('/admin/')) {
    event.respondWith(fetch(request, { cache: 'no-store' }));
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(url.pathname, copy));
          return response;
        })
        .catch(() => caches.match(url.pathname).then(cached => cached || caches.match('/index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
