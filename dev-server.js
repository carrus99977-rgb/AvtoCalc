// Локальный дев-сервер: статика проекта + /api/* теми же функциями, что крутятся на Vercel.
// Нужен, чтобы «🏦 РЫНОК» и «💠 USDT» работали локально без деплоя (браузеру напрямую нельзя:
// банк/биржа не отдают CORS). Запуск: node dev-server.js  (превью-конфиг «avtocalc» делает это сам).
// В прод НЕ деплоится логикой — Vercel игнорирует всё, кроме api/ и статики.
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = __dirname, PORT = 8090;
const MIME = {".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",
  ".css":"text/css; charset=utf-8",".json":"application/json; charset=utf-8",
  ".png":"image/png",".svg":"image/svg+xml",".ico":"image/x-icon",".webmanifest":"application/manifest+json"};
// шим Vercel-хелперов (res.status().json()) поверх голого Node-res
function wrap(res){res.status=c=>{res.statusCode=c;return res};
  res.json=o=>{res.setHeader("Content-Type","application/json; charset=utf-8");res.end(JSON.stringify(o))};
  return res}
const api = {"/api/usdt": require("./api/usdt.js"), "/api/market": require("./api/market.js")};
http.createServer(async (req, res) => {
  const p = new URL(req.url, "http://localhost").pathname;
  if (api[p]) { try { await api[p](req, wrap(res)) } catch (e) { res.statusCode = 500; res.end("proxy error: " + e.message) } return }
  let f;
  // decodeURIComponent кидает URIError на битом %-эскейпе (напр. /%zz, /%) — без catch это
  // валит весь процесс (в async-хендлере = unhandledRejection). Кривой путь → 400, сервер жив.
  try { f = path.normalize(path.join(ROOT, decodeURIComponent(p === "/" ? "/index.html" : p))); }
  catch (_) { res.statusCode = 400; res.end("bad request"); return }
  // граница каталога: сравниваем с ROOT+разделитель, иначе соседняя папка «AvtoCalc-main-backup»
  // прошла бы startsWith(ROOT). Сам ROOT (запрос "/") тоже валиден. Нуль-байт в пути — отсекаем.
  if (f.includes("\0") || (f !== ROOT && !f.startsWith(ROOT + path.sep))) { res.statusCode = 403; res.end(); return }
  fs.readFile(f, (err, data) => {
    if (err) { res.statusCode = 404; res.end("404"); return }
    res.setHeader("Content-Type", MIME[path.extname(f).toLowerCase()] || "application/octet-stream");
    res.end(data) });
}).listen(PORT, "127.0.0.1", () => console.log("AvtoCalc dev server: http://localhost:" + PORT + " (static + /api/usdt + /api/market)"));
