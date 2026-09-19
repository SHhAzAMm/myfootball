const CACHE_NAME = 'boxes-cache-v1';

// Файлы, которые кэшируем сразу (оболочка приложения)
const CORE_ASSETS = [
  '/',
  '/index.html',
  // Добавьте сюда пути к вашим PNG-картинкам, если хотите их кэшировать
  // '/elements/fire.png',
  // '/stones/diamond.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Для API-запросов используем сеть, а при неудаче — кэш (Network First)
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Для остальных запросов сначала ищем в кэше, потом в сети (Cache First)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});