const CACHE_NAME = 'boxes-cache-v3';
const STATIC_PREFIXES = ['/icons/', '/elements/', '/stones/', '/weapons/'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      ),
    ])
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Не трогаем другие origin
  if (url.origin !== self.location.origin) return;

  // HTML, навигация и API — не перехватываем вообще.
  // Браузер обработает их стандартно (HTTP-кеш Pages + сеть).
  if (event.request.mode === 'navigate') return;
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname === '/' || url.pathname.endsWith('.html')) return;

  // Кэшируем только статичные ассеты (картинки, манифест)
  const isStatic =
    STATIC_PREFIXES.some((p) => url.pathname.startsWith(p)) ||
    url.pathname === '/manifest.json';

  if (!isStatic) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});