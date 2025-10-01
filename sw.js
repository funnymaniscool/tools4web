// Very simple offline caching for the template shell.
self.addEventListener('install', (evt) => {
  evt.waitUntil((async () => {
    const cache = await caches.open('ppsspp-web-tpl-v1');
    await cache.addAll(['./','./index.html','./styles.css','./app.js','./loader.js','./manifest.webmanifest']);
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (evt) => {
  evt.respondWith((async () => {
    try {
      const res = await fetch(evt.request);
      const cache = await caches.open('ppsspp-web-tpl-v1');
      cache.put(evt.request, res.clone());
      return res;
    } catch (_) {
      const cached = await caches.match(evt.request);
      return cached || Response.error();
    }
  })());
});
