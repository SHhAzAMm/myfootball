const CACHE_NAME = 'boxes-cache-v2';

// Кешируем только статику. HTML (index.html) НЕ кешируем —
// его всегда тянем с сети, чтобы правки подхватывались мгновенно.
const STATIC_ASSETS = [
  '/manifest.json',
  // Сюда можно добавлять картинки, если хочешь их офлайн-кеш:
  // '/icons/icon-192.png',
  // '/icons/icon-512.png',
];

// ─── Установка: кешируем статику и сразу активируемся ───
self.addEventListener('install', (event) => {
  self.skipWaiting(); // не ждём закрытия всех вкладок
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
});

// ─── Активация: удаляем старые кеши ───
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Забираем контроль над уже открытыми вкладками
      self.clients.claim(),
      // Чистим старые версии кеша
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      ),
    ])
  );
});

// ─── Fetch ───
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. API — только сеть, без кеша. Если упало — отдаём ошибку,
  //    а не старый ответ (иначе можно получить неконсистентные данные).
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // 2. HTML (index.html, /, любые .html) — Network First.
  //    Всегда тянем свежий, кеш только как fallback при офлайне.
  const isHtml =
    event.request.mode === 'navigate' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    (event.request.headers.get('accept') || '').includes('text/html');

  if (isHtml) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Не кешируем HTML — пусть каждый раз тянется с сервера
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 3. Всё остальное (картинки, шрифты, manifest) — Cache First.
  //    Это ок, потому что такие файлы меняются редко.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          // Кешируем только успешные GET-запросы того же origin
          if (
            event.request.method === 'GET' &&
            response.status === 200 &&
            url.origin === self.location.origin
          ) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
      );
    })
  );
});