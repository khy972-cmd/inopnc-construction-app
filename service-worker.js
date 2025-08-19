/* INOPNC PWA Service Worker */
const CACHE_VERSION = 'inopnc-pwa-20250819_0214';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',                 // 루트
  '/index.html',       // SPA 엔트리 (서버 설정에 따라 무시될 수 있음)
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PRECACHE_URLS);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.map((name) => {
      if (!name.includes(CACHE_VERSION)) return caches.delete(name);
    }));
    await self.clients.claim();
  })());
});

// 도메인 구분
const sameOrigin = (url) => new URL(url).origin === self.location.origin;

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // GET 이외는 네트워크 우선
  if (request.method !== 'GET') return;

  // 내비게이션 요청: 네트워크 우선, 실패시 캐시 → offline.html
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put('/', fresh.clone());
        return fresh;
      } catch (err) {
        const cacheStatic = await caches.open(STATIC_CACHE);
        const cached = await cacheStatic.match('/index.html') || await cacheStatic.match('/');
        return cached || await cacheStatic.match('/offline.html');
      }
    })());
    return;
  }

  // 정적/동일 출처: Stale-While-Revalidate
  if (sameOrigin(request.url)) {
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      const fetchPromise = fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => null);
      return cached || fetchPromise || caches.match('/offline.html');
    })());
    return;
  }

  // 외부 리소스(글꼴/CDN 등): Cache-First
  event.respondWith((async () => {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const fresh = await fetch(request, { mode: 'cors', credentials: 'omit' });
      if (fresh && fresh.status === 200) {
        cache.put(request, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return caches.match('/offline.html');
    }
  })());
});

// 즉시 업데이트 적용
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
