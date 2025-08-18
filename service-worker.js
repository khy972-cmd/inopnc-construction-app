// service-worker.js
const CACHE_VERSION = 'inopnc-pwa-v1.0.0';
const STATIC_CACHE = `static-${CACHE_VERSION}`;

const CORE_ASSETS = [
  '/',                 // 루트가 index.html을 바로 서빙하지 않으면 이 줄 삭제
  '/index.html',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(CORE_ASSETS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== STATIC_CACHE).map(k => caches.delete(k)));
    self.clients.claim();
  })());
});

async function handleNavigate(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const cachedIndex = await cache.match('/index.html');
    return cachedIndex || Response.error();
  }
}

async function cacheFirst(event) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(event.request);
  const fetchPromise = fetch(event.request).then((res) => {
    if (res && res.status === 200) cache.put(event.request, res.clone());
    return res;
  }).catch(() => null);
  return cached || fetchPromise || Response.error();
}

async function networkFirst(event) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const res = await fetch(event.request, { mode: 'cors' });
    if (res && res.status === 200) cache.put(event.request, res.clone());
    return res;
  } catch {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    return cached || Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (req.mode === 'navigate') {
    event.respondWith(handleNavigate(req));
    return;
  }
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(event));
  } else {
    event.respondWith(networkFirst(event));
  }
});