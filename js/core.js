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
try{const w=localStorage.getItem("autoCalc_wh");if(w)S.warehouse=JSON.parse(w)}catch(e){}
try{const d=localStorage.getItem("autoCalc_draft");if(d){const dd=JSON.parse(d);
S.carName=dd.carName||"";
// миграция со старого формата (eurRate/usdRate) на карту курсов
S.rates=dd.rates?{...DEFAULT_RATES,...dd.rates}:{...DEFAULT_RATES,EUR:dd.eurRate||DEFAULT_RATES.EUR,USD:dd.usdRate||DEFAULT_RATES.USD};
S.activeCur=Array.isArray(dd.activeCur)&&dd.activeCur.length?dd.activeCur.filter(c=>CUR[c]&&c!=="RUB"):[...DEFAULT_ACTIVE];
S.entries=dd.entries||[];S.curCat=dd.curCat||0;S.sellPrice=dd.sellPrice||"";
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
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
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
