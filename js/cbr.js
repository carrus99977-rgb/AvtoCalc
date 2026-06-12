// ===== КУРСЫ ЦБ РФ (api.cbr-xml-daily.ru — зеркало официальных курсов) =====
function cbrUrl(y,m,d){
if(!y)return "https://www.cbr-xml-daily.ru/daily_json.js";
const p=n=>String(n).padStart(2,"0");
return `https://www.cbr-xml-daily.ru/archive/${y}/${p(m)}/${p(d)}/daily_json.js`}

// Прогретый «сегодняшний» ответ ЦБ: повторные нажатия в течение 10 минут — мгновенны
let _cbrCache=null; // {data, ts}
const RATES_TTL=6e5; // 10 минут — как s-maxage у серверной функции
// дата курса в данных ЦБ как YYYY-MM-DD (в этом же виде applyCbrData пишет её в S.cbrDate)
function cbrDataDate(d){try{return new Date(d.Date).toISOString().slice(0,10)}catch(_){return""}}

// Применить данные ЦБ к курсам; false — если в данных нет ни одной нашей валюты
function applyCbrData(data){
let n=0;
Object.keys(CUR).forEach(c=>{const code=CUR[c].cbr;if(!code)return;
const v=data.Valute&&data.Valute[code];if(!v||!v.Value)return;
const perUnit=v.Value/(v.Nominal||1); // ЦБ котирует вону за 1000, иену за 100
// 6 знаков: достаточно точности для валют с курсом <1 (вона ~0.0473)
S.rates[c]=String(Math.round(perUnit*1e6)/1e6);n++});
if(!n)return false;
const dt=new Date(data.Date);
S.cbrInfo=`✓ Курс ЦБ на ${dt.toLocaleDateString("ru-RU")}`;
// показываем дату полученного курса в поле даты (ЦБ ставит метку 11:30+03:00 — UTC-сдвига дня не будет)
try{S.cbrDate=dt.toISOString().slice(0,10)}catch(_){}
saveDraft();render();return true}

async function fetchCbr(){
if(S.cbrBusy)return;
// без даты ИЛИ с датой закэшированного курса (её пишет applyCbrData) — мгновенно из кэша;
// явно выбранная другая дата уходит в архив как обычно
if(_cbrCache&&Date.now()-_cbrCache.ts<RATES_TTL&&(!S.cbrDate||S.cbrDate===cbrDataDate(_cbrCache.data))){
if(applyCbrData(_cbrCache.data))return}
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
if(!applyCbrData(data))throw new Error("пусто")}
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
.then(d=>(_mkCache={...d,ts:Date.now()}))
.finally(()=>{_mkInflight=null});
return _mkInflight}

// Загрузка рыночного курса по цепочке источников; бросает, если все недоступны
async function loadMarketData(){
let usdRub=null,eurUsd=null,src="USDT";
// кросс EUR/USD не зависит от USD-цепочки — стартуем параллельно, потребляем в конце
const erP=(async()=>{try{
const r=await fetch("https://open.er-api.com/v6/latest/USD",{signal:AbortSignal.timeout(10000)});
if(r.ok)return await r.json()}catch(_){}return null})();
try{
const r=await fetch(MARKET_API,{signal:AbortSignal.timeout(12000)});
if(r.ok){const d=await r.json();const v=d&&parseFloat(d.usd);
// принимаем только свежий ответ (защита от любого промежуточного кэша)
if(v>0&&(!d.ts||Date.now()-d.ts<36e5)){usdRub=v;src="BestChange нал→USDT"}}
}catch(_){}
if(!usdRub)try{
const r=await fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub",
{signal:AbortSignal.timeout(10000)});
if(r.ok){const d=await r.json();const v=d&&d.tether&&parseFloat(d.tether.rub);if(v>0){usdRub=v;src="биржа USDT"}}
}catch(_){}
const er=await erP;
if(er){const eur=er.rates&&parseFloat(er.rates.EUR);if(eur>0)eurUsd=1/eur;
if(!usdRub){const rub=er.rates&&parseFloat(er.rates.RUB);if(rub>0){usdRub=rub;src="форекс"}}}
if(!usdRub)throw new Error("нет данных");
return{usd:usdRub,eurUsd,src}}

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
// мгновенно из прогретого кэша (свежее 10 минут)
if(_mkCache&&Date.now()-_mkCache.ts<RATES_TTL){applyMarket(_mkCache);return}
S.cbrBusy=true;S.cbrInfo="⏳ Загрузка рыночного курса...";renderCbrInfo();
try{
const d=await loadMarketShared();
S.cbrBusy=false;applyMarket(d)}
catch(e){S.cbrBusy=false;
S.cbrInfo="⚠ Рыночный курс недоступен — проверь интернет или попробуй ЦБ";renderCbrInfo()}}

// ===== ТИХИЙ ПРОГРЕВ ПРИ ЗАПУСКЕ =====
// К моменту нажатия кнопок ответы уже готовы: кнопки срабатывают мгновенно,
// а заодно каждый запуск приложения греет CDN-кэш серверной функции.
function prefetchRates(){
if(navigator.onLine===false)return;
loadMarketShared().catch(()=>{});
if(!S.cbrBusy)(async()=>{try{
const r=await fetch(cbrUrl(),{signal:AbortSignal.timeout(10000)});
if(r.ok){const d=await r.json();if(d&&d.Valute)_cbrCache={data:d,ts:Date.now()}}}catch(_){}})()}
