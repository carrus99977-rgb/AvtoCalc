// ===== КУРСЫ ЦБ РФ (api.cbr-xml-daily.ru — зеркало официальных курсов) =====
function cbrUrl(dateStr){
if(!dateStr)return "https://www.cbr-xml-daily.ru/daily_json.js";
const[y,m,d]=dateStr.split("-");
return `https://www.cbr-xml-daily.ru/archive/${y}/${m}/${d}/daily_json.js`}

async function fetchCbr(){
if(S.cbrBusy)return;
S.cbrBusy=true;S.cbrInfo="⏳ Загрузка курса...";renderCbrInfo();
try{
let date=S.cbrDate?new Date(S.cbrDate+"T12:00:00"):null;
let data=null,tries=0;
while(tries<8){
const url=date?cbrUrl(date.toISOString().slice(0,10)):cbrUrl("");
let d2=null;
// 404 архива отдаётся без CORS-заголовков — fetch кидает исключение, ловим и откатываемся
try{const r=await fetch(url);if(r.ok)d2=await r.json()}catch(_){}
if(d2&&d2.Valute){data=d2;break}
if(!date)throw new Error("api");
// на выходные/праздники курс не устанавливается — берём предыдущий день
date.setDate(date.getDate()-1);tries++}
if(!data)throw new Error("нет данных");
let n=0;
Object.keys(CUR).forEach(c=>{const code=CUR[c].cbr;if(!code)return;
const v=data.Valute&&data.Valute[code];if(!v||!v.Value)return;
const perUnit=v.Value/(v.Nominal||1); // ЦБ котирует вону за 1000, иену за 100
S.rates[c]=String(Math.round(perUnit*10000)/10000);n++});
if(!n)throw new Error("пусто");
const dt=new Date(data.Date);
S.cbrInfo=`✓ Курс ЦБ на ${dt.toLocaleDateString("ru-RU")}`;
S.cbrBusy=false;saveDraft();render()}
catch(e){S.cbrBusy=false;
S.cbrInfo="⚠ Не удалось получить курс — проверь интернет или дату";renderCbrInfo()}}

function renderCbrInfo(){const el=document.getElementById("cbr-info");if(el)el.textContent=S.cbrInfo}
