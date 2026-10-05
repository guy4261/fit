const CACHE = 'fit24-v38';
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
  './exercise-photo.js',
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

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (
    event.request.method !== 'GET' ||
    new URL(event.request.url).origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const responseCopy = response.clone();
          event.waitUntil(
            caches.open(CACHE).then((cache) => cache.put(event.request, responseCopy)),
          );
        }
        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(event.request);
        return cachedResponse || caches.match('./index.html');
      }),
  );
});
