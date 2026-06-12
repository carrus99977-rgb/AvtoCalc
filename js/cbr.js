// ===== КУРСЫ ЦБ РФ (api.cbr-xml-daily.ru — зеркало официальных курсов) =====
function cbrUrl(y,m,d){
if(!y)return "https://www.cbr-xml-daily.ru/daily_json.js";
const p=n=>String(n).padStart(2,"0");
return `https://www.cbr-xml-daily.ru/archive/${y}/${p(m)}/${p(d)}/daily_json.js`}

async function fetchCbr(){
if(S.cbrBusy)return;
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
let n=0;
Object.keys(CUR).forEach(c=>{const code=CUR[c].cbr;if(!code)return;
const v=data.Valute&&data.Valute[code];if(!v||!v.Value)return;
const perUnit=v.Value/(v.Nominal||1); // ЦБ котирует вону за 1000, иену за 100
// 6 знаков: достаточно точности для валют с курсом <1 (вона ~0.0473)
S.rates[c]=String(Math.round(perUnit*1e6)/1e6);n++});
if(!n)throw new Error("пусто");
const dt=new Date(data.Date);
S.cbrInfo=`✓ Курс ЦБ на ${dt.toLocaleDateString("ru-RU")}`;
// показываем дату полученного курса в поле даты (ЦБ ставит метку 11:30+03:00 — UTC-сдвига дня не будет)
try{S.cbrDate=dt.toISOString().slice(0,10)}catch(_){}
S.cbrBusy=false;saveDraft();render()}
catch(e){S.cbrBusy=false;
S.cbrInfo="⚠ Не удалось получить курс — проверь интернет или дату";renderCbrInfo()}}

function renderCbrInfo(){const el=document.getElementById("cbr-info");if(el)el.textContent=S.cbrInfo}

// ===== РЫНОЧНЫЙ КУРС (обменный уровень) =====
// USD: USDT/₽ с CoinGecko (фактический «обменный» уровень), запасной — форекс er-api.
// EUR: USD_рынок × кросс EUR/USD (er-api). Истории нет — курс только «сейчас».
async function fetchMarket(){
if(S.cbrBusy)return;
S.cbrBusy=true;S.cbrInfo="⏳ Загрузка рыночного курса...";renderCbrInfo();
let usdRub=null,eurUsd=null,src="USDT";
try{
try{
const r=await fetch("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub",
{signal:AbortSignal.timeout(10000)});
if(r.ok){const d=await r.json();const v=d&&d.tether&&parseFloat(d.tether.rub);if(v>0)usdRub=v}
}catch(_){}
try{
const r=await fetch("https://open.er-api.com/v6/latest/USD",{signal:AbortSignal.timeout(10000)});
if(r.ok){const d=await r.json();
const eur=d&&d.rates&&parseFloat(d.rates.EUR);if(eur>0)eurUsd=1/eur;
if(!usdRub){const rub=d&&d.rates&&parseFloat(d.rates.RUB);if(rub>0){usdRub=rub;src="форекс"}}}
}catch(_){}
if(!usdRub)throw new Error("нет данных");
S.rates.USD=String(Math.round(usdRub*1e4)/1e4);
let eurNote="";
if(eurUsd>0)S.rates.EUR=String(Math.round(usdRub*eurUsd*1e4)/1e4);
// кросс недоступен: очищаем EUR, чтобы устаревший курс молча не зафиксировался в новые позиции
else{eurNote=" · EUR недоступен — введи курс вручную";S.rates.EUR=""}
S.cbrDate=""; // рыночный курс — только текущий момент
const t=new Date().toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"});
S.cbrInfo=`✓ Рынок на ${t} · ${src} ${fmtRate(usdRub)}${eurNote}`;
S.cbrBusy=false;saveDraft();render()}
catch(e){S.cbrBusy=false;
S.cbrInfo="⚠ Рыночный курс недоступен — проверь интернет или попробуй ЦБ";renderCbrInfo()}}
