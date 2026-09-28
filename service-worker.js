const CACHE = 'fit24-v32';
const FILES = [
  './',
  './index.html',
  './about.html',
  './favicon.png',
  './fit24-qr.svg',
  './icons/github.svg',
  './icons/share.svg',
  './style.css',
  './app.js',
  './images/body.png',
  './images/plates.png',
  './images/barbell.png',
  './images/dumbbell.png',
  './images/kettlebell.png',
  './images/stamp.png',
  './manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    new URL(event.request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request)
        .then((response) => {
          if (response.ok) {
            caches
              .open(CACHE)
              .then((cache) => cache.put(event.request, response.clone()));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    }),
  );
});
