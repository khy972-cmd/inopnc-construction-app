/* INOPNC PWA Service Worker */
const CACHE_VERSION = 'inopnc-pwa-20250127_002';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  '/',                 // 루트
  '/index.html',       // SPA 엔트리
  '/offline.html',
  '/manifest.webmanifest',
  '/icon-192x192.png',
  '/icon-512x512.png'
];

// 외부 CDN 리소스
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800;900&family=Inter:wght@400;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.39.7/dist/umd/supabase.min.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PRECACHE_URLS);
    
    // 외부 리소스도 프리캐시
    try {
      await cache.addAll(EXTERNAL_RESOURCES);
    } catch (err) {
      console.log('Some external resources failed to cache:', err);
    }
    
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

// 백그라운드 동기화 (선택적)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // 백그라운드에서 데이터 동기화 로직
  console.log('Background sync triggered');
}
