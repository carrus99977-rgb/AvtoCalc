// АвтоКальк — service worker: приложение работает без интернета.
// V — версия релиза: при каждом обновлении меняется здесь и в ?v=N в index.html.
const V = "42";
const CACHE = "avtokalk-v" + V;
const FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png",
  ...[
    "styles.css",
    "js/core.js",
    "js/cbr.js",
    "js/export.js",
    "js/cloud.js",
    "js/calc.js",
    "js/warehouse.js",
    "js/charts.js",
    "js/stats.js",
    "js/receipt.js",
    "js/main.js"
  ].map(f => "./" + f + "?v=" + V)
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
  const u = new URL(e.request.url);
  // Cross-origin (курсы ЦБ, Supabase, CDN, шрифты) — мимо кэша: живая сеть,
  // при ошибке падают честно, не подменяются протухшим кэшем со статусом 200.
  if (u.origin !== self.location.origin) return;
  // Серверные функции (/api/market) — тоже мимо кэша: офлайн курс должен
  // падать честно, а не отдаваться вчерашним со статусом 200 и свежей подписью.
  if (u.pathname.includes("/api/")) return;
  e.respondWith(
    // cache:"no-cache" — всегда сверяем файл с сервером (ETag/304), чтобы
    // HTTP-кэш браузера не подсовывал устаревшие js/css после обновления
    fetch(e.request, { cache: "no-cache" }).then(resp => {
      // в кэш только успешные ответы (resp.ok=false и для 404/500, и для opaque),
      // чтобы страница ошибки не затёрла рабочий файл app shell
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match(e.request).then(r => {
      if (r) return r;
      if (e.request.mode === "navigate") return caches.match("./index.html");
      return Response.error();
    }))
  );
});
