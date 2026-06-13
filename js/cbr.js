// ===== КУРСЫ ЦБ РФ (api.cbr-xml-daily.ru — зеркало официальных курсов) =====
function cbrUrl(y,m,d){
if(!y)return "https://www.cbr-xml-daily.ru/daily_json.js";
const p=n=>String(n).padStart(2,"0");
return `https://www.cbr-xml-daily.ru/archive/${y}/${p(m)}/${p(d)}/daily_json.js`}

// Прогретый «сегодняшний» ответ ЦБ: повторные нажатия в течение 10 минут — мгновенны
let _cbrCache=null; // {data, ts}
const RATES_TTL=6e5; // 10 минут — как s-maxage у серверной функции
// сегодня как YYYY-MM-DD (локальная дата — для перекупа ≈ московская)
function todayStr(){const d=new Date();const p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())}

// Применить данные ЦБ к курсам; false — если в данных нет ни одной нашей валюты.
// showDate (YYYY-MM-DD) — дата, которую ПОКАЗЫВАЕМ: сегодня для авто либо выбранная.
// ЦБ не публикует курс по выходным, но пятничный курс ДЕЙСТВУЕТ в сб/вс — поэтому на
// выходных показываем «на сегодня» с пятничными цифрами (это и есть актуальный курс дня).
function applyCbrData(data,showDate){
let n=0;
Object.keys(CUR).forEach(c=>{const code=CUR[c].cbr;if(!code)return;
const v=data.Valute&&data.Valute[code];if(!v||!v.Value)return;
const perUnit=v.Value/(v.Nominal||1); // ЦБ котирует вону за 1000, иену за 100
// 6 знаков: достаточно точности для валют с курсом <1 (вона ~0.0473)
S.rates[c]=String(Math.round(perUnit*1e6)/1e6);n++});
if(!n)return false;
const lbl=new Date((showDate||todayStr())+"T12:00:00");
S.cbrInfo=`✓ Курс ЦБ на ${lbl.toLocaleDateString("ru-RU")}`;
// S.cbrDate НЕ трогаем: им управляет пользователь (пусто = сегодня/авто). Иначе авто-фетч
// «залипал» бы на дате публикации (пт) и в след. рабочий день не обновлялся бы.
saveDraft();render();return true}

async function fetchCbr(){
if(S.cbrBusy)return;
const showDate=S.cbrDate||todayStr(); // что показываем: выбранная дата или сегодня
// daily-кэш отдаём только для авто (сегодня); выбранная архивная дата всегда идёт в сеть
if(_cbrCache&&Date.now()-_cbrCache.ts<RATES_TTL&&!S.cbrDate){
if(applyCbrData(_cbrCache.data,showDate))return}
S.cbrBusy=true;S.cbrInfo="⏳ Загрузка курса...";renderCbrInfo();
try{
// работаем в UTC, чтобы дата архива не сдвигалась из-за часового пояса
let date=null;
if(S.cbrDate){const[y,m,d]=S.cbrDate.split("-").map(Number);date=new Date(Date.UTC(y,m-1,d))}
let data=null,tries=0;
// до 14 дней отката — покрывает новогодний разрыв архива (~11 дней)
while(tries<14){
const url=date?cbrUrl(date.getUTCFullYear(),date.getUTCMonth()+1,date.getUTCDate()):cbrUrl();
let d2=null;
// 404 архива отдаётся без CORS-заголовков — fetch кидает исключение, ловим и откатываемся.
// AbortSignal.timeout: на зависшей сети не висим бессрочно.
try{const r=await fetch(url,{signal:AbortSignal.timeout(10000)});if(r.ok)d2=await r.json()}catch(_){}
if(d2&&d2.Valute){data=d2;break}
if(!date)throw new Error("api");
// на выходные/праздники курс не устанавливается — берём предыдущий день
date.setUTCDate(date.getUTCDate()-1);tries++}
if(!data)throw new Error("нет данных");
if(!date)_cbrCache={data,ts:Date.now()}; // кэшируем только «сегодня», не архив
S.cbrBusy=false;
if(!applyCbrData(data,showDate))throw new Error("пусто")}
catch(e){S.cbrBusy=false;
S.cbrInfo="⚠ Не удалось получить курс — проверь интернет или дату";renderCbrInfo()}}

function renderCbrInfo(){const el=document.getElementById("cbr-info");if(el)el.textContent=S.cbrInfo}

// ===== РЫНОЧНЫЙ КУРС (обменный уровень) =====
// Цепочка источников USD: 1) BestChange (наличные→USDT, серверная функция на Vercel) —
// реальный курс обменников; 2) CoinGecko USDT/₽ (биржа); 3) er-api форекс.
// EUR: USD_рынок × кросс EUR/USD (er-api). Истории нет — курс только «сейчас».
const MARKET_API="https://avto-calc.vercel.app/api/market";
let _mkCache=null; // {usd, eurUsd, src, ts} — прогретый рыночный курс
let _mkInflight=null; // общий in-flight запрос: кнопка и прогрев делят одну загрузку
function loadMarketShared(){
if(!_mkInflight)_mkInflight=loadMarketData()
// primary=true только для BestChange; фолбэк (биржа/форекс) пометим, чтобы держать в кэше недолго
.then(d=>(_mkCache={...d,ts:Date.now(),primary:/^BestChange/.test(d.src||"")}))
.finally(()=>{_mkInflight=null});
return _mkInflight}

// Рыночный курс USD берём ТОЛЬКО из BestChange (наличный USDT). Биржу (CoinGecko) и
// фиатный форекс как курс НЕ подставляем — если BestChange недоступен, бросаем ошибку
// («рыночный курс недоступен»). Форекс (HTTPS) тянем лишь для EUR-кросса и проверки:
// BestChange приходит по НЕЗАЩИЩЁННОМУ HTTP, расхождение >35% с фиатом считаем подменой.
async function loadMarketData(){
let eurUsd=null;
const erP=(async()=>{try{
const r=await fetch("https://open.er-api.com/v6/latest/USD",{signal:AbortSignal.timeout(10000)});
if(r.ok)return await r.json()}catch(_){}return null})();
const bcP=(async()=>{try{
const r=await fetch(MARKET_API,{signal:AbortSignal.timeout(12000)});
if(r.ok)return await r.json()}catch(_){}return null})();
const er=await erP;
const forexUsd=(er&&er.rates&&parseFloat(er.rates.RUB))||0; // ₽ за 1 USD (фиат) — только опора-проверка
if(er){const eur=er.rates&&parseFloat(er.rates.EUR);if(eur>0)eurUsd=1/eur}
const d=await bcP;
if(d){const v=parseFloat(d.usd);
// свежий + подтверждённый HTTPS-опорой в пределах ±35% — иначе НЕ доверяем (фолбэка нет)
if(v>0&&(!d.ts||Date.now()-d.ts<36e5)&&forexUsd>0&&Math.abs(v-forexUsd)/forexUsd<=0.35)
return{usd:v,eurUsd,src:"BestChange нал→USDT"}}
throw new Error("BestChange недоступен")}

function applyMarket(d){
S.rates.USD=String(Math.round(d.usd*1e4)/1e4);
let eurNote="";
if(d.eurUsd>0)S.rates.EUR=String(Math.round(d.usd*d.eurUsd*1e4)/1e4);
// кросс недоступен: очищаем EUR, чтобы устаревший курс молча не зафиксировался в новые позиции
else{eurNote=" · EUR недоступен — введи курс вручную";S.rates.EUR=""}
S.cbrDate=""; // рыночный курс — только текущий момент
const t=new Date(d.ts||Date.now()).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
S.cbrInfo=`✓ Рынок на ${t} · ${d.src} ${fmtRate(d.usd)}${eurNote}`;
saveDraft();render()}

async function fetchMarket(){
if(S.cbrBusy)return;
// BestChange держим в кэше 10 минут; фолбэк (биржа/форекс) — лишь минуту, чтобы при
// разовом сбое BestChange не залипнуть на бирже на все 10 минут, а перепробовать
const ttl=(_mkCache&&_mkCache.primary)?RATES_TTL:6e4;
if(_mkCache&&Date.now()-_mkCache.ts<ttl){applyMarket(_mkCache);return}
S.cbrBusy=true;S.cbrInfo="⏳ Загрузка рыночного курса...";renderCbrInfo();
try{
const d=await loadMarketShared();
S.cbrBusy=false;applyMarket(d)}
catch(e){S.cbrBusy=false;
S.cbrInfo="⚠ Наличный курс (BestChange) недоступен — попробуй ещё раз, жми «КУРС ЦБ» или введи вручную";renderCbrInfo()}}

// ===== ТИХИЙ ПРОГРЕВ ПРИ ЗАПУСКЕ =====
// К моменту нажатия кнопок ответы уже готовы: кнопки срабатывают мгновенно,
// а заодно каждый запуск приложения греет CDN-кэш серверной функции.
function prefetchRates(){
if(navigator.onLine===false)return;
loadMarketShared().catch(()=>{});
if(!S.cbrBusy)(async()=>{try{
const r=await fetch(cbrUrl(),{signal:AbortSignal.timeout(10000)});
if(r.ok){const d=await r.json();if(d&&d.Valute)_cbrCache={data:d,ts:Date.now()}}}catch(_){}})()}
