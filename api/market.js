// Vercel serverless: курс обмена Камкомбанка — наличные доллар и евро в отделениях банка.
// Источник: backbron.kamkombank.ru (сервис брони валюты самого банка) — публичный JSON без ключа.
// sell = банк ПРОДАЁТ валюту клиенту: по этому курсу перекуп покупает $/€ для оплаты машин.
// Контракт ответа прежний: {usd, eur?, src, ts} — клиент (js/cbr.js) не меняется.
const KKB_URL = "https://backbron.kamkombank.ru/v1/currency/exchange";

// первый валидный курс «продажа» по имени валюты из списка отделений
// (курсы во всех отделениях одинаковые; границы lo/hi — страховка от смены
// формата/семантики ответа на стороне банка, а не фильтр «мусорных» офферов)
function pickSell(result, name, lo, hi) {
  for (const office of result || []) {
    for (const c of (office && office.currencies) || []) {
      if (c && typeof c === "object" && c.currency_name === name) {
        const v = parseFloat(String(c.sell).replace(",", "."));
        if (v > lo && v < hi) return v;
      }
    }
  }
  return 0;
}

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // курс публичный — работает и с GitHub Pages
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).end(); return; }
  // Легитимный клиент дёргает чистый /api/market без параметров. Любой query (?cb=…) —
  // это обход CDN-кэша: отклоняем СРАЗУ. Ответ кэшируем надолго, чтобы спам одинаковых
  // «мусорных» URL тоже гасил CDN.
  const qs = (req.url || "").indexOf("?");
  if (qs !== -1 && req.url.length > qs + 1) {
    res.setHeader("Cache-Control", "s-maxage=3600");
    res.status(400).json({ error: "no query params allowed" });
    return;
  }
  try {
    const r = await fetch(KKB_URL, {
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "AvtoCalc/1.0 (+https://avto-calc.vercel.app)" },
    });
    if (!r.ok) throw new Error("kamkombank http " + r.status);
    const data = await r.json();
    const result = (data && data.result) || [];
    const usd = pickSell(result, "Доллар США", 20, 1000);
    const eur = pickSell(result, "Евро", 20, 1000);
    if (!usd) throw new Error("no usd rate");
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    const out = {
      usd: Math.round(usd * 10000) / 10000,
      src: "Камкомбанк (продажа)",
      ts: Date.now(),
    };
    if (eur) out.eur = Math.round(eur * 10000) / 10000;
    res.status(200).json(out);
  } catch (e) {
    res.setHeader("Cache-Control", "s-maxage=30"); // ошибку кэшируем кратко
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
