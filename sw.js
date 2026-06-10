// АвтоКальк — service worker: приложение работает без интернета
const CACHE = "avtokalk-v6";
const FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./js/core.js",
  "./js/cbr.js",
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

// Сначала сеть (чтобы подтянуть обновления), при отсутствии интернета — кэш.
// Фолбэк на index.html — только для навигации: API-запросы (курсы ЦБ, Supabase)
// при ошибке должны падать честно, а не получать HTML со статусом 200.
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match(e.request).then(r => {
      if (r) return r;
      if (e.request.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    }))
  );
});
