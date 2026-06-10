const CATS=[
{id:"car_price",label:"Стоимость авто",icon:"🚗"},
{id:"logistics",label:"Логистика",icon:"🚢"},
{id:"customs",label:"Таможенное оформление",icon:"📋"},
{id:"util_fee",label:"Утилизационный сбор",icon:"♻️"},
{id:"registration",label:"Оформление ЭПТС/СБКТС",icon:"📄"},
{id:"other",label:"Прочие расходы",icon:"📦"},
];
// Реестр валют. cbr — код валюты в API ЦБ РФ
const CUR={
RUB:{symbol:"₽",cls:"rub",label:"РУБЛЬ",cbr:null},
EUR:{symbol:"€",cls:"eur",label:"ЕВРО",cbr:"EUR"},
USD:{symbol:"$",cls:"usd",label:"ДОЛЛАР",cbr:"USD"},
CNY:{symbol:"¥",cls:"cny",label:"ЮАНЬ",cbr:"CNY"},
KRW:{symbol:"₩",cls:"krw",label:"ВОНА",cbr:"KRW"},
JPY:{symbol:"JP¥",cls:"jpy",label:"ИЕНА",cbr:"JPY"}};
const DEFAULT_RATES={EUR:"83",USD:"72",CNY:"10.6",KRW:"0.047",JPY:"0.45"};
const DEFAULT_ACTIVE=["EUR","USD","CNY"];

let S={carName:"",rates:{...DEFAULT_RATES},activeCur:[...DEFAULT_ACTIVE],entries:[],curCat:0,display:"0",
showReceipt:false,showSettings:true,showProfit:true,sellPrice:"",sellCurrency:"RUB",receiptImage:null,
warehouse:[],expandedCar:null,sellingCarId:null,whSearch:"",whSort:"new",
sellFormPrice:"",sellFormCurr:"RUB",sellFormRate:"",
editingEntry:null,editValue:"",editCurr:"RUB",editRate:"",
editingCarId:null,editCarEntries:null,bulkRates:{},
cbrBusy:false,cbrDate:"",cbrInfo:"",
carReceipts:{},confirmAction:null};

// ===== PERSISTENCE =====
function loadAll(){
try{const w=localStorage.getItem("autoCalc_wh");if(w){const arr=JSON.parse(w);
S.warehouse=(Array.isArray(arr)?arr:[]).map(normalizeCar).filter(Boolean)}}catch(e){}
try{const d=localStorage.getItem("autoCalc_draft");if(d){const dd=JSON.parse(d);
S.carName=dd.carName||"";
// миграция со старого формата (eurRate/usdRate) на карту курсов
S.rates=dd.rates?{...DEFAULT_RATES,...dd.rates}:{...DEFAULT_RATES,EUR:dd.eurRate||DEFAULT_RATES.EUR,USD:dd.usdRate||DEFAULT_RATES.USD};
S.activeCur=Array.isArray(dd.activeCur)&&dd.activeCur.length?dd.activeCur.filter(c=>CUR[c]&&c!=="RUB"):[...DEFAULT_ACTIVE];
S.entries=(Array.isArray(dd.entries)?dd.entries:[]).map(normalizeEntry).filter(Boolean);
S.curCat=dd.curCat||0;S.sellPrice=dd.sellPrice||"";
S.sellCurrency=CUR[dd.sellCurrency]?dd.sellCurrency:"RUB"}}catch(e){}
}
function saveWH(){try{localStorage.setItem("autoCalc_wh",JSON.stringify(S.warehouse))}catch(e){}}
function saveDraft(){try{localStorage.setItem("autoCalc_draft",JSON.stringify({
carName:S.carName,rates:S.rates,activeCur:S.activeCur,
eurRate:S.rates.EUR,usdRate:S.rates.USD,
entries:S.entries,curCat:S.curCat,sellPrice:S.sellPrice,sellCurrency:S.sellCurrency}))}catch(e){}}

S.theme="dark";
try{S.theme=localStorage.getItem("autoCalc_theme")||"dark"}catch(e){}
function applyTheme(){document.body.classList.toggle("light",S.theme==="light");
const mt=document.querySelector('meta[name="theme-color"]');
if(mt)mt.setAttribute("content",S.theme==="light"?"#eef0f5":"#1a1a2e")}
function toggleTheme(){S.theme=S.theme==="light"?"dark":"light";
try{localStorage.setItem("autoCalc_theme",S.theme)}catch(e){}
applyTheme();render()}
applyTheme();

// ===== HELPERS =====
function fmt(n){return n.toLocaleString("ru-RU",{maximumFractionDigits:0})}
function fmtD(n,d){return n.toLocaleString("ru-RU",{minimumFractionDigits:d,maximumFractionDigits:d})}
function fmtRate(n){return fmtD(n,n>=1?2:4)}
// Курс позиции: свой (зафиксированный), иначе из карты курсов машины/черновика
function entryRate(e,rates){if(e.currency==="RUB")return 1;
if(e.rate&&parseFloat(e.rate))return parseFloat(e.rate);
return parseFloat((rates&&rates[e.currency])||0)}
function entryRub(e,rates){return e.amount*entryRate(e,rates)}
function totR(entries,rates){return entries.reduce((s,e)=>s+entryRub(e,rates),0)}
function toR(a,c,rates){if(c==="RUB")return a;return a*parseFloat((rates&&rates[c])||0)}
function ds(){return new Date().toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function dShort(d){try{return new Date(d).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})}catch(e){return d}}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
// Безопасный id для вставки в onclick: только [A-Za-z0-9_-], иначе мусор отбрасывается
function safeId(id){return /^[A-Za-z0-9_-]+$/.test(String(id||""))?String(id):""}
// Безопасный лукап валюты: данные из импорта/облака могут содержать валюту вне CUR.
// Fallback-символ чистится до букв/цифр — он попадает и в HTML, и в canvas-чек без esc().
function curInfo(c){if(CUR[c])return CUR[c];
const safe=String(c||"?").replace(/[^A-Za-z0-9]/g,"").slice(0,6)||"?";
return{symbol:safe,cls:"",label:safe,cbr:null}}

// ===== ВАЛИДАЦИЯ ВХОДЯЩИХ ДАННЫХ (импорт и облако) =====
// Любая машина из файла/облака проходит через normalizeCar: лишние поля
// отбрасываются, типы приводятся, битые объекты возвращают null.
function normalizeEntry(e){
if(!e||typeof e!=="object")return null;
if(!isFinite(parseFloat(e.amount)))return null;
// валюта — только латиница 2-6 символов (реальные коды); мусор → RUB
const cur=(typeof e.currency==="string"&&/^[A-Za-z]{2,6}$/.test(e.currency))?e.currency:"RUB";
return{category:String(e.category||"other"),label:String(e.label||"Позиция"),
icon:String(e.icon||"📦"),amount:parseFloat(e.amount),currency:cur,
rate:cur==="RUB"?"":String(e.rate||"")}}
function safeRates(o){if(!o||typeof o!=="object"||Array.isArray(o))return null;
const r={};Object.keys(o).forEach(k=>{r[String(k)]=String(o[k]==null?"":o[k])});return r}
function normalizeCar(c){
if(!c||typeof c!=="object")return null;
const entries=(Array.isArray(c.entries)?c.entries:[]).map(normalizeEntry).filter(Boolean);
if(!entries.length)return null;
const status=c.status==="sold"?"sold":"stock";
const rates=safeRates(c.rates)||{EUR:String(c.eurRate||""),USD:String(c.usdRate||"")};
const sellRates=safeRates(c.sellRates);
return{id:safeId(c.id)||uid(),
name:typeof c.name==="string"?c.name:String(c.name||"Без названия"),
date:typeof c.date==="string"?c.date:new Date().toISOString(),
rates,eurRate:String(rates.EUR||""),usdRate:String(rates.USD||""),
entries,status,
sellPrice:status==="sold"?String(c.sellPrice||""):"",
sellCurrency:typeof c.sellCurrency==="string"?c.sellCurrency:"RUB",
sellDate:c.sellDate||null,
sellRates,
sellEurRate:String((sellRates&&sellRates.EUR)||""),
sellUsdRate:String((sellRates&&sellRates.USD)||"")}}
// Карта курсов машины: новый формат — car.rates, старый — eurRate/usdRate
function carRates(car){return car.rates||{EUR:car.eurRate,USD:car.usdRate}}
function carSellRates(car){const r={...carRates(car)};
if(car.sellRates)Object.assign(r,car.sellRates);
else{if(car.sellEurRate)r.EUR=car.sellEurRate;if(car.sellUsdRate)r.USD=car.sellUsdRate}
return r}
function carCost(car){return totR(car.entries,carRates(car))}
function carSellRub(car){return toR(parseFloat(car.sellPrice)||0,car.sellCurrency,carSellRates(car))}
function carSellRate(car){return parseFloat(carSellRates(car)[car.sellCurrency]||0)}
function carProfit(car){return carSellRub(car)-carCost(car)}
function daysBetween(d1,d2){try{return Math.max(0,Math.round((new Date(d2)-new Date(d1))/86400000))}catch(e){return 0}}

// ===== CONFIRM =====
function showConfirm(msg,fn){S.confirmAction={msg,fn};renderConfirm()}
function hideConfirm(){S.confirmAction=null;renderConfirm()}
function renderConfirm(){const el=document.getElementById("confirm-dialog");if(!S.confirmAction){el.innerHTML="";return}
el.innerHTML=`<div class="confirm-overlay" onclick="hideConfirm()"><div class="confirm-box" onclick="event.stopPropagation()">
<p>${S.confirmAction.msg}</p><div class="confirm-btns">
<div class="btn-action btn-outline" onclick="hideConfirm()">ОТМЕНА</div>
<div class="btn-action btn-red" onclick="window._cY()">ДА</div></div></div></div>`;
window._cY=()=>{const f=S.confirmAction.fn;hideConfirm();f()}}
