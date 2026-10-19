// App shell cache so the app works courtside without signal.
const CACHE = 'court-cam-v6';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'geometry.js', 'data.js', 'sensor.js',
  'view3d.js', 'vendor/three.module.min.js', 'vendor/OrbitControls.js',
  'manifest.webmanifest', 'icon.svg', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Network first so updates show up, falling back to cache when offline. 'no-cache'
// makes the browser revalidate instead of serving a stale HTTP-cached copy, which
// otherwise mixes new and old files after a deploy.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const fresh = e.request.mode === 'navigate'
    ? fetch(e.request.url, { cache: 'no-cache' })
    : fetch(e.request, { cache: 'no-cache' });
  e.respondWith(
    fresh
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
