/* INOPNC PWA Service Worker */
const CACHE_VERSION = 'inopnc-pwa-20250127_003';
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

// 캐시 전략: 네트워크 우선, 실패시 캐시
const NETWORK_FIRST_STRATEGY = async (request) => {
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(request);
    return cached || caches.match('/offline.html');
  }
};

// 캐시 전략: 캐시 우선, 실패시 네트워크
const CACHE_FIRST_STRATEGY = async (request) => {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  
  try {
    const response = await fetch(request);
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return caches.match('/offline.html');
  }
};

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
    event.respondWith(NETWORK_FIRST_STRATEGY(request));
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
  event.respondWith(CACHE_FIRST_STRATEGY(request));
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
  
  // 클라이언트들에게 동기화 알림
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'BACKGROUND_SYNC',
      timestamp: Date.now()
    });
  });
}

// 푸시 알림 처리 (선택적)
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body || '새로운 알림이 있습니다.',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      vibrate: [200, 100, 200],
      data: {
        url: data.url || '/'
      }
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'INOPNC', options)
    );
  }
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientList => {
      // 이미 열린 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // 새 창 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(event.notification.data.url);
      }
    })
  );
});
