// Vercel serverless: рыночный курс ПРОДАЖИ доллара и евро за рубли (сколько ₽ дают за 1 $/€).
// Источник: официальный BestChange API v2 (HTTPS, JSON). Ключ — в переменной окружения
// BESTCHANGE_KEY (в репозиторий не коммитим, он публичный).
// Все направления → СБП ₽ (21). В этом направлении rate = валюта за 1 ₽, поэтому
// ₽ за 1 единицу = 1/rate. Курс = медиана офферов (типичный). USD — ликвидный USDT (одно
// направление); EUR раздроблён по способам — объединяем офферы нескольких в одну медиану.
const USD_PAIR = "10-21"; // USDT TRC20 → СБП RUB
// EUR-способы → СБП: SEPA, банк.карта, банк.счёт, Volet, Capitalist, Revolut, Wise, Skrill
const EUR_PAIRS = ["171-21", "65-21", "70-21", "120-21", "226-21", "193-21", "242-21", "123-21"];
const ALL_PAIRS = [USD_PAIR, ...EUR_PAIRS].join("+");

function median(xs) { xs.sort((a, b) => a - b); return xs.length ? xs[Math.floor(xs.length / 2)] : 0; }
// собрать ₽-за-единицу из офферов направления (rate = валюта за ₽ → ₽/единица = 1/rate), фильтр мусора
function ppuFrom(arr, lo, hi) {
  const out = [];
  for (const o of arr || []) {
    const rate = parseFloat(o && o.rate);
    if (!(rate > 0)) continue;
    const v = 1 / rate;
    if (v > lo && v < hi) out.push(v);
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // курс публичный — работает и с GitHub Pages
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).end(); return; }
  // Легитимный клиент дёргает чистый /api/market без параметров. Любой query (?cb=…) —
  // это обход CDN-кэша: отклоняем СРАЗУ (не тратим приватный ключ и лимит BestChange).
  // Ответ кэшируем надолго, чтобы спам одинаковых «мусорных» URL тоже гасил CDN.
  const qs = (req.url || "").indexOf("?");
  if (qs !== -1 && req.url.length > qs + 1) {
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(400).json({ error: "no query params allowed" });
    return;
  }
  try {
    const key = process.env.BESTCHANGE_KEY;
    if (!key) throw new Error("BESTCHANGE_KEY not set");
    const r = await fetch(`https://bestchange.app/v2/${key}/rates/${ALL_PAIRS}`, {
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "AvtoCalc/1.0 (+https://avto-calc.vercel.app)" },
    });
    if (!r.ok) throw new Error("bestchange v2 http " + r.status);
    const data = await r.json();
    const rates = (data && data.rates) || {};
    // USD — одно ликвидное направление (USDT→СБП)
    const usdPpu = ppuFrom(rates[USD_PAIR], 50, 250);
    if (!usdPpu.length) throw new Error("no usd offers");
    const usd = median(usdPpu);
    // EUR — объединяем офферы всех способов в одну медиану (может отсутствовать — не критично)
    let eurAll = [];
    for (const p of EUR_PAIRS) eurAll = eurAll.concat(ppuFrom(rates[p], 50, 300));
    const eur = median(eurAll);
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    const out = {
      usd: Math.round(usd * 10000) / 10000,
      offers: usdPpu.length,
      src: "BestChange: продажа",
      ts: Date.now(),
    };
    if (eur > 0) { out.eur = Math.round(eur * 10000) / 10000; out.eurOffers = eurAll.length; }
    res.status(200).json(out);
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=30"); // ошибку кэшируем кратко
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
