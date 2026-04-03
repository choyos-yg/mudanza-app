const CACHE_NAME = 'mudanzapp-v1';
const ASSETS = [
  '/mudanza-app/',
  '/mudanza-app/index.html',
  '/mudanza-app/manifest.json',
  '/mudanza-app/icon-192.png',
  '/mudanza-app/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network first, fallback to cache (we need fresh data from Supabase)
  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache successful GET requests for static assets
        if (e.request.method === 'GET' && !e.request.url.includes('supabase.co')) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
