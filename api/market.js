// Vercel serverless: реальный «обменный» курс с BestChange.
// Направление: Наличные RUB (91) → Tether TRC20 (10), медиана топ-5 обменников.
// Ответ кэшируется CDN на 10 минут (s-maxage) — база BestChange качается не чаще.
const AdmZip = require("adm-zip");

const FROM_ID = 91; // Наличные RUB
const TO_ID = 10;   // Tether TRC20 (USDT)

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // курс публичный — пусть работает и с GitHub Pages
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).end(); return; }
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
  try {
    // ВАЖНО: именно http — https://api.bestchange.ru не отвечает (проверено), не «чинить» на https
    const r = await fetch("http://api.bestchange.ru/info.zip", {
      signal: AbortSignal.timeout(25000),
      headers: { "User-Agent": "AvtoCalc/1.0 (+https://avto-calc.vercel.app)" },
    });
    if (!r.ok) throw new Error("bestchange http " + r.status);
    const buf = Buffer.from(await r.arrayBuffer());
    const zip = new AdmZip(buf);
    const entry = zip.getEntry("bm_rates.dat");
    if (!entry) throw new Error("no rates file");
    // http без TLS: потолок на распакованный размер закрывает OOM от подменённого zip (реальный файл ~75 МБ)
    if (entry.header.size > 200 * 1024 * 1024) throw new Error("rates file too big: " + entry.header.size);
    const text = entry.getData().toString("latin1"); // в строках только цифры и ;
    const prefix = FROM_ID + ";" + TO_ID + ";";
    const rates = [];
    let pos = 0;
    while (pos < text.length) {
      const nl = text.indexOf("\n", pos);
      const line = text.slice(pos, nl === -1 ? text.length : nl);
      pos = nl === -1 ? text.length : nl + 1;
      if (!line.startsWith(prefix)) continue;
      const f = line.split(";");
      const give = parseFloat(f[3]), get = parseFloat(f[4]);
      if (!(give > 0) || !(get > 0)) continue;
      const rate = give / get; // ₽ за 1 USDT
      if (rate > 50 && rate < 250) rates.push(rate); // санити-фильтр от мусорных офферов
    }
    if (!rates.length) throw new Error("no offers");
    rates.sort((a, b) => a - b);
    const top = rates.slice(0, 5);
    const usd = top[Math.floor((top.length - 1) / 2)]; // медиана топ-5: устойчива к фейковому «лучшему»
    res.status(200).json({
      usd: Math.round(usd * 10000) / 10000,
      offers: rates.length,
      src: "BestChange: наличные → USDT",
      ts: Date.now(),
    });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
