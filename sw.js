// АвтоКальк — service worker: приложение работает без интернета
const CACHE = "avtokalk-v5";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/core.js",
  "./js/cloud.js",
  "./js/calc.js",
  "./js/warehouse.js",
  "./js/stats.js",
  "./js/receipt.js",
  "./js/main.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сначала сеть (чтобы подтянуть обновления), при отсутствии интернета — кэш
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(e.request).then(r => r || caches.match("./index.html")))
  );
});
