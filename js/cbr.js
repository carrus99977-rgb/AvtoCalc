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

// ===== РЫНОЧНЫЙ КУРС (обмен валюты в банке) =====
// Курс ПРОДАЖИ Камкомбанка: сколько ₽ стоит 1 $/€ при покупке валюты в банке — по нему
// перекуп реально платит за машины. Серверная функция на Vercel поверх публичного API
// банка (backbron.kamkombank.ru). Истории нет — курс «сейчас».
const MARKET_API="https://avto-calc.vercel.app/api/market";
let _mkCache=null; // {usd, src, ts} — прогретый рыночный курс
let _mkInflight=null; // общий in-flight запрос: кнопка и прогрев делят одну загрузку
function loadMarketShared(){
if(!_mkInflight)_mkInflight=loadMarketData()
.then(d=>(_mkCache={...d,ts:Date.now()}))
.finally(()=>{_mkInflight=null});
return _mkInflight}

// Курс продажи доллара и евро Камкомбанка, отдаёт серверная функция. EUR может отсутствовать.
async function loadMarketData(){
const r=await fetch(MARKET_API,{signal:AbortSignal.timeout(12000)});
if(!r.ok)throw new Error("market http "+r.status);
const d=await r.json();
const v=parseFloat(d&&d.usd);
// Принимаем только свежий ответ (защита от промежуточного кэша). Свежесть меряем по часам
// СЕРВЕРА (заголовок Date, если CORS его отдал) — сбитые часы телефона не должны глушить
// кнопку; без заголовка — часы устройства с допуском 6 ч на сбитое время (легитимная
// давность CDN-кэша ≤ 40 мин, так что и щедрый порог отсекает по-настоящему тухлое)
const srv=Date.parse(r.headers.get("date")||"");
if(!(v>0)||(d.ts&&(srv||Date.now())-d.ts>=(srv?36e5:216e5)))throw new Error("банк недоступен");
const e=parseFloat(d&&d.eur);
return{usd:v,eur:e>0?e:0,src:d.src||"Камкомбанк (продажа)"}}

function applyMarket(d){
S.rates.USD=String(Math.round(d.usd*1e4)/1e4);
if(d.eur>0)S.rates.EUR=String(Math.round(d.eur*1e4)/1e4); // евро тоже рыночный (продажа); если нет — не трогаем
S.cbrDate=""; // рыночный курс — только текущий момент
const t=new Date(d.ts||Date.now()).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
const eurTxt=d.eur>0?` · € ${fmtRate(d.eur)}`:"";
S.cbrInfo=`✓ ${d.src||"Камкомбанк (продажа)"} ${t} · $ ${fmtRate(d.usd)}${eurTxt} ₽`;
saveDraft();render()}

async function fetchMarket(){
if(S.cbrBusy)return;
// прогретый рыночный курс держим в кэше 10 минут (как ЦБ); иначе тянем свежий
if(_mkCache&&Date.now()-_mkCache.ts<RATES_TTL){applyMarket(_mkCache);return}
S.cbrBusy=true;S.cbrInfo="⏳ Загрузка рыночного курса...";renderCbrInfo();
try{
const d=await loadMarketShared();
S.cbrBusy=false;applyMarket(d)}
catch(e){S.cbrBusy=false;
S.cbrInfo="⚠ Курс банка недоступен — попробуй ещё раз, жми «КУРС ЦБ» или введи вручную";renderCbrInfo()}}

// ===== ТИХИЙ ПРОГРЕВ ПРИ ЗАПУСКЕ =====
// К моменту нажатия кнопок ответы уже готовы: кнопки срабатывают мгновенно,
// а заодно каждый запуск приложения греет CDN-кэш серверной функции.
function prefetchRates(){
if(navigator.onLine===false)return;
loadMarketShared().catch(()=>{});
if(!S.cbrBusy)(async()=>{try{
const r=await fetch(cbrUrl(),{signal:AbortSignal.timeout(10000)});
if(r.ok){const d=await r.json();if(d&&d.Valute)_cbrCache={data:d,ts:Date.now()}}}catch(_){}})()}
