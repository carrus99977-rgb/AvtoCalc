// Vercel serverless: рыночный курс ПРОДАЖИ USDT за рубли (сколько ₽ дают за 1 USDT).
// Источник: официальный BestChange API v2 (HTTPS, JSON). Ключ — в переменной окружения
// BESTCHANGE_KEY (в репозиторий не коммитим, он публичный).
// Направление 10→21: отдаёшь USDT (10), получаешь СБП ₽ (21). В этом направлении
// rate = USDT за 1 ₽, поэтому ₽ за 1 USDT = 1/rate. Курс = медиана ВСЕХ офферов (типичный).
const FROM_ID = 10; // Tether TRC20 (USDT)
const TO_ID = 21;   // СБП RUB
const PAIR = FROM_ID + "-" + TO_ID;

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // курс публичный — работает и с GitHub Pages
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).end(); return; }
  try {
    const key = process.env.BESTCHANGE_KEY;
    if (!key) throw new Error("BESTCHANGE_KEY not set");
    const r = await fetch(`https://bestchange.app/v2/${key}/rates/${PAIR}`, {
      signal: AbortSignal.timeout(12000),
      headers: { "User-Agent": "AvtoCalc/1.0 (+https://avto-calc.vercel.app)" },
    });
    if (!r.ok) throw new Error("bestchange v2 http " + r.status);
    const data = await r.json();
    const arr = (data && data.rates && data.rates[PAIR]) || [];
    // rate = USDT за 1 ₽ → ₽ за 1 USDT = 1/rate; оставляем только разумные (50..250 ₽/USDT)
    const ppu = [];
    for (const o of arr) {
      const rate = parseFloat(o && o.rate);
      if (!(rate > 0)) continue;
      const v = 1 / rate;
      if (v > 50 && v < 250) ppu.push(v);
    }
    if (!ppu.length) throw new Error("no offers");
    ppu.sort((a, b) => a - b);
    const usd = ppu[Math.floor(ppu.length / 2)]; // типичный курс продажи — медиана всех офферов
    // кэшируем CDN только УСПЕШНЫЙ ответ на 10 минут
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    res.status(200).json({
      usd: Math.round(usd * 10000) / 10000,
      offers: ppu.length,
      src: "BestChange: продажа USDT",
      ts: Date.now(),
    });
  } catch (e) {
    // ошибку кэшируем кратко — разовый сбой источника не залипает на 10 минут
    res.setHeader("Cache-Control", "s-maxage=30");
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
