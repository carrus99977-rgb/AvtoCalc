const CATS=[
{id:"car_price",label:"Стоимость авто",icon:"🚗"},
{id:"logistics",label:"Логистика",icon:"🚢"},
{id:"customs",label:"Таможенное оформление",icon:"📋"},
{id:"util_fee",label:"Утилизационный сбор",icon:"♻️"},
{id:"registration",label:"Оформление ЭПТС/СБКТС",icon:"📄"},
{id:"other",label:"Прочие расходы",icon:"📦"},
];
const CUR={EUR:{symbol:"€",cls:"eur"},USD:{symbol:"$",cls:"usd"},RUB:{symbol:"₽",cls:"rub"}};

let S={carName:"",eurRate:"105",usdRate:"95",entries:[],curCat:0,display:"0",
showReceipt:false,showSettings:true,showProfit:true,sellPrice:"",sellCurrency:"RUB",receiptImage:null,
warehouse:[],expandedCar:null,sellingCarId:null,
sellFormPrice:"",sellFormCurr:"RUB",sellFormEur:"",sellFormUsd:"",
editingEntry:null,editValue:"",editCurr:"RUB",editRate:"",
editingCarId:null,editCarEntries:null,bulkEur:"",bulkUsd:"",
carReceipts:{},confirmAction:null};

// ===== PERSISTENCE =====
function loadAll(){
try{const w=localStorage.getItem("autoCalc_wh");if(w)S.warehouse=JSON.parse(w)}catch(e){}
try{const d=localStorage.getItem("autoCalc_draft");if(d){const dd=JSON.parse(d);
S.carName=dd.carName||"";S.eurRate=dd.eurRate||"105";S.usdRate=dd.usdRate||"95";
S.entries=dd.entries||[];S.curCat=dd.curCat||0;S.sellPrice=dd.sellPrice||"";S.sellCurrency=dd.sellCurrency||"RUB"}}catch(e){}
}
function saveWH(){try{localStorage.setItem("autoCalc_wh",JSON.stringify(S.warehouse))}catch(e){}}
function saveDraft(){try{localStorage.setItem("autoCalc_draft",JSON.stringify({
carName:S.carName,eurRate:S.eurRate,usdRate:S.usdRate,entries:S.entries,
curCat:S.curCat,sellPrice:S.sellPrice,sellCurrency:S.sellCurrency}))}catch(e){}}

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
// Курс позиции: свой (зафиксированный), иначе общий курс машины/черновика
function entryRate(e,er,ur){if(e.currency==="RUB")return 1;
if(e.rate&&parseFloat(e.rate))return parseFloat(e.rate);
return parseFloat((e.currency==="EUR"?er:ur)||0)}
function entryRub(e,er,ur){return e.amount*entryRate(e,er,ur)}
function totR(entries,er,ur){return entries.reduce((s,e)=>s+entryRub(e,er,ur),0)}
function toR(a,c,er,ur){if(c==="RUB")return a;if(c==="EUR")return a*parseFloat(er||0);if(c==="USD")return a*parseFloat(ur||0);return 0}
function ds(){return new Date().toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"})}
function dShort(d){try{return new Date(d).toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"numeric"})}catch(e){return d}}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function esc(s){return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function carCost(car){return totR(car.entries,car.eurRate,car.usdRate)}
function carSellRub(car){const er=car.sellEurRate||car.eurRate,ur=car.sellUsdRate||car.usdRate;
return toR(parseFloat(car.sellPrice)||0,car.sellCurrency,er,ur)}
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
