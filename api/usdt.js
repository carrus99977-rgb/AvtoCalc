// Vercel serverless: курс USDT/₽ с биржи ABCEX (публичный, без ключа) — цена последней сделки
// по паре USDTRUB. Перекуп покупает USDT за ₽, платит им за машины → это его эффективный курс доллара.
// Источник: hub.abcex.io/api/v2/exchange/public/... (тот же публичный API, что использует сайт биржи).
// Контракт ответа: {usdt, src, tradeAt, ts} — клиент (js/cbr.js) кладёт usdt в поле USD.
const ABCEX_URL = "https://hub.abcex.io/api/v2/exchange/public/trade/spot/list/recent?instrumentCode=USDTRUB&limit=1";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // курс публичный — работает и с GitHub Pages
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).end(); return; }
  // Легитимный клиент дёргает чистый /api/usdt без параметров. Любой query — обход CDN-кэша: отклоняем.
  const qs = (req.url || "").indexOf("?");
  if (qs !== -1 && req.url.length > qs + 1) {
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(400).json({ error: "no query params allowed" });
    return;
  }
  try {
    // ABCEX блокирует часть серверных IP (US-регион Vercel отдавал 403 — функция вынесена в fra1/EU).
    // Браузерные заголовки — на случай, если анти-бот смотрит IP+UA вместе.
    const r = await fetch(ABCEX_URL, {
      signal: AbortSignal.timeout(12000),
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept": "application/json, text/plain, */*",
        "Origin": "https://abcex.io",
        "Referer": "https://abcex.io/",
      },
    });
    if (!r.ok) throw new Error("abcex http " + r.status);
    const data = await r.json();
    const t = Array.isArray(data) && data[0] ? data[0] : null;
    const v = t ? parseFloat(String(t.price).replace(",", ".")) : 0;
    // границы — страховка от смены формата/семантики ответа биржи (не фильтр «мусора»)
    if (!(v > 20 && v < 1000)) throw new Error("no usdt price");
    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=600");
    res.status(200).json({
      usdt: Math.round(v * 10000) / 10000,
      src: "ABCEX (USDT/₽)",
      tradeAt: t.updatedAt || null, // время последней сделки — клиент может показать/предупредить о давности
      ts: Date.now(),
    });
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=30"); // ошибку кэшируем кратко
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
