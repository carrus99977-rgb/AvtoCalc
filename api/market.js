// Vercel serverless: реальный «обменный» курс с BestChange.
// Направление: Наличные RUB (91) → Tether TRC20 (10), медиана топ-5 обменников.
// Ответ кэшируется CDN на 10 минут (s-maxage) — база BestChange качается не чаще.
const AdmZip = require("adm-zip");

const FROM_ID = 91; // Наличные RUB
const TO_ID = 10;   // Tether TRC20 (USDT)

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*"); // курс публичный — пусть работает и с GitHub Pages
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); res.status(405).end(); return; }
  try {
    // ВАЖНО: именно http — https://api.bestchange.ru не отвечает (проверено), не «чинить» на https
    const r = await fetch("http://api.bestchange.ru/info.zip", {
      signal: AbortSignal.timeout(25000),
      headers: { "User-Agent": "AvtoCalc/1.0 (+https://avto-calc.vercel.app)" },
    });
    if (!r.ok) throw new Error("bestchange http " + r.status);
    // HTTP без TLS — ответ недоверенный: ограничиваем скачивание ДО полной буферизации,
    // чтобы подменённый/раздутый ответ не выжрал память функции (реальный zip заметно < 60 МБ).
    const DL_CAP = 60 * 1024 * 1024;
    const clen = Number(r.headers.get("content-length") || 0);
    if (clen > DL_CAP) throw new Error("response too large: " + clen);
    let buf;
    if (r.body && typeof r.body.getReader === "function") {
      const reader = r.body.getReader();
      const chunks = []; let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        if (total > DL_CAP) { try { await reader.cancel(); } catch (_) {} throw new Error("response exceeded cap: " + total); }
        chunks.push(Buffer.from(value));
      }
      buf = Buffer.concat(chunks);
    } else {
      buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > DL_CAP) throw new Error("response too large: " + buf.length);
    }
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
    // кэшируем CDN только УСПЕШНЫЙ ответ — на 10 минут (база качается не чаще)
    res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=1800");
    res.status(200).json({
      usd: Math.round(usd * 10000) / 10000,
      offers: rates.length,
      src: "BestChange: наличные → USDT",
      ts: Date.now(),
    });
  } catch (e) {
    // ошибку кэшируем лишь кратко: разовый сбой источника BestChange не должен залипать
    // на 10 минут (раньше s-maxage=600 ставился до try и применялся и к 502)
    res.setHeader("Cache-Control", "s-maxage=30");
    res.status(502).json({ error: String((e && e.message) || e) });
  }
};
