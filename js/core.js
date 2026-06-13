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
USD:{symbol:"$",cls:"usd",label:"ДОЛЛАР",cbr:"USD"}};
const DEFAULT_RATES={EUR:"83",USD:"72"};
const DEFAULT_ACTIVE=["EUR","USD"];

let S={carName:"",rates:{...DEFAULT_RATES},activeCur:[...DEFAULT_ACTIVE],entries:[],curCat:0,display:"0",
showReceipt:false,showSettings:true,showProfit:true,sellPrice:"",sellCurrency:"RUB",receiptImage:null,
warehouse:[],expandedCar:null,sellingCarId:null,whSearch:"",whSort:"new",histOpen:false,
sellFormPrice:"",sellFormCurr:"RUB",sellFormRate:"",sellEditMode:false,
editingEntry:null,editValue:"",editCurr:"RUB",editRate:"",
editingCarId:null,editCarEntries:null,bulkRates:{},editName:"",editDate:"",editAskPrice:"",editNote:"",targetMarkup:"",
cbrBusy:false,cbrDate:"",cbrInfo:"",
toast:null,backupHidden:false,statScope:"all",chartCat:null,
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
S.curCat=dd.curCat||0;S.sellPrice=dd.sellPrice||"";S.targetMarkup=dd.targetMarkup||"";
S.sellCurrency=CUR[dd.sellCurrency]?dd.sellCurrency:"RUB"}}catch(e){}
}
function saveWH(){try{localStorage.setItem("autoCalc_wh",JSON.stringify(S.warehouse))}catch(e){}}
function saveDraft(){try{localStorage.setItem("autoCalc_draft",JSON.stringify({
carName:S.carName,rates:S.rates,activeCur:S.activeCur,
eurRate:S.rates.EUR,usdRate:S.rates.USD,
entries:S.entries,curCat:S.curCat,sellPrice:S.sellPrice,sellCurrency:S.sellCurrency,
targetMarkup:S.targetMarkup}))}catch(e){}}

// При первом запуске (нет сохранённой темы) берём системную; ручной выбор приоритетнее
S.theme="dark";
try{const saved=localStorage.getItem("autoCalc_theme");
S.theme=saved||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){}
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
// Разбор числа из ввода/импорта «по-русски»: запятая-десятичная (83,45),
// пробелы-разделители тысяч (1 234 567, в т.ч. тонкие/неразрывные), оба
// разделителя сразу (1 234,56 / 1,234.56). Мусор/Infinity/буквы → NaN, а не
// «съедаются» как у parseFloat. Лимит ±1e12 (нет таких сумм). Для чистых
// "83.45" результат тот же, что у parseFloat, — замена безопасна.
function parseNum(v){
if(typeof v==="number")return isFinite(v)&&Math.abs(v)<=1e12?v:NaN;
let s=String(v==null?"":v).trim();if(!s)return NaN;
s=s.replace(/[\s   ]/g,""); // убрать пробелы-разделители тысяч
const hasC=s.indexOf(",")>-1,hasD=s.indexOf(".")>-1;
if(hasC&&hasD){ // оба разделителя: правый — десятичный, левый — тысячный (строго группы по 3)
if(s.lastIndexOf(",")>s.lastIndexOf(".")){ // 1.234,56 — точки тысячные
if(!/^-?\d{1,3}(\.\d{3})*,\d+$/.test(s))return NaN;s=s.replace(/\./g,"").replace(",",".");
}else{ // 1,234.56 — запятые тысячные
if(!/^-?\d{1,3}(,\d{3})*\.\d+$/.test(s))return NaN;s=s.replace(/,/g,"");
}
}else if(hasC){ // только запятые: одна → десятичная; несколько → тысячные (строго группы по 3)
if(s.split(",").length===2)s=s.replace(",",".");
else{if(!/^-?\d{1,3}(,\d{3})+$/.test(s))return NaN;s=s.replace(/,/g,"");}
}else if(hasD&&s.split(".").length>2){ // несколько точек → тысячные (строго группы по 3)
if(!/^-?\d{1,3}(\.\d{3})+$/.test(s))return NaN;s=s.replace(/\./g,"");
}
// финальная строгая проверка: ровно одно число (необяз. минус, один десятичный разделитель).
// мусор («1O00», «123abc», «1-2», «50%», «1.2.3») честно отвергаем как NaN, а не «съедаем»
if(!/^-?(\d+\.?\d*|\.\d+)$/.test(s))return NaN;
const n=parseFloat(s);
return isFinite(n)&&Math.abs(n)<=1e12?n:NaN}
// Каноничная строка для хранения: "83,45" → "83.45", мусор → "" (всегда точка)
function numStr(v){const n=parseNum(v);return isFinite(n)?String(n):""}
// ===== ИСТОРИЯ ИЗМЕНЕНИЙ ПО МАШИНЕ (ключевые события) =====
const HIST_EV=["created","edited","sold","priceEdit","returned"];
const HIST_META={
created:{icon:"🏭",label:"Создана"},
edited:{icon:"✏️",label:"Изменены данные"},
sold:{icon:"💰",label:"Продана"},
priceEdit:{icon:"📈",label:"Изменена цена продажи"},
returned:{icon:"↩️",label:"Возврат на склад"}};
// добавить событие в историю машины (с обрезкой текста и лимитом 50)
function addHist(car,e,d){if(!car)return;if(!Array.isArray(car.history))car.history=[];
car.history.push({t:new Date().toISOString(),e:String(e),d:d?String(d).slice(0,120):""});
if(car.history.length>50)car.history=car.history.slice(-50)}
// список событий для показа (по возрастанию t); старым машинам синтезируем «создана» из даты
function carHistory(car){
const h=(Array.isArray(car.history)?car.history:[]).filter(x=>x&&x.t&&HIST_EV.includes(x.e)).slice();
if(!h.some(x=>x.e==="created"))h.unshift({t:car.date,e:"created",d:""});
return h.sort((a,b)=>new Date(a.t)-new Date(b.t))}
// дата+время события: 13.06.26 04:21
function histDate(t){try{const d=new Date(t);if(isNaN(d))return"";
return d.toLocaleDateString("ru-RU",{day:"2-digit",month:"2-digit",year:"2-digit"})+" "+d.toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}catch(e){return""}}
// Курс позиции: свой (зафиксированный), иначе из карты курсов машины/черновика
function entryRate(e,rates){if(e.currency==="RUB")return 1;
const own=parseNum(e.rate);if(own>0)return own;
const r=parseNum((rates&&rates[e.currency]));return r>0?r:0}
function entryRub(e,rates){return e.amount*entryRate(e,rates)}
function totR(entries,rates){return entries.reduce((s,e)=>s+entryRub(e,rates),0)}
function toR(a,c,rates){if(c==="RUB")return a;const r=parseNum(rates&&rates[c]);return a*(r>0?r:0)}
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
const amt=parseNum(e.amount);if(!(amt>0))return null; // как в UI: сумма строго > 0 (отсекает 0, отрицательные, NaN); запятые-импорт принимаем
// валюта — только латиница 2-6 символов (реальные коды); мусор → RUB
const cur=(typeof e.currency==="string"&&/^[A-Za-z]{2,6}$/.test(e.currency))?e.currency:"RUB";
return{category:String(e.category||"other"),label:String(e.label||"Позиция"),
icon:String(e.icon||"📦"),amount:amt,currency:cur,
rate:cur==="RUB"?"":numStr(e.rate)}} // курс канонизируем (запятая→точка), мусор→""
// Карта курсов: значения канонизируем (запятая→точка, мусор→""), чтобы импорт/облако не таскали «грязные» строки
function safeRates(o){if(!o||typeof o!=="object"||Array.isArray(o))return null;
const r={};Object.keys(o).forEach(k=>{r[String(k)]=numStr(o[k])});return r}
function normalizeCar(c){
if(!c||typeof c!=="object")return null;
const entries=(Array.isArray(c.entries)?c.entries:[]).map(normalizeEntry).filter(Boolean);
if(!entries.length)return null;
const status=c.status==="sold"?"sold":"stock";
const rates=safeRates(c.rates)||{EUR:numStr(c.eurRate),USD:numStr(c.usdRate)};
const sellRates=safeRates(c.sellRates);
return{id:safeId(c.id)||uid(),
name:typeof c.name==="string"?c.name:String(c.name||"Без названия"),
date:typeof c.date==="string"?c.date:new Date().toISOString(),
rates,eurRate:String(rates.EUR||""),usdRate:String(rates.USD||""),
entries,status,
sellPrice:status==="sold"?numStr(c.sellPrice):"",
// валюта продажи — только буквенный код 2-6 симв. (как у позиций): отсекает инъекцию
// в инлайн-onclick формы продажи (esc не экранирует одинарные кавычки), мусор → RUB
sellCurrency:(typeof c.sellCurrency==="string"&&/^[A-Za-z]{2,6}$/.test(c.sellCurrency))?c.sellCurrency:"RUB",
sellDate:c.sellDate||null,
sellRates,
sellEurRate:String((sellRates&&sellRates.EUR)||""),
sellUsdRate:String((sellRates&&sellRates.USD)||""),
askPrice:(()=>{const ap=parseNum(c.askPrice);return ap>0?String(ap):""})(),
note:typeof c.note==="string"?c.note.slice(0,500):"",
// история ключевых событий: чистим типы, отбрасываем мусор, лимит 50
history:(Array.isArray(c.history)?c.history:[]).map(h=>{
if(!h||typeof h!=="object")return null;
const e=String(h.e||"");if(!HIST_EV.includes(e))return null;
const t=(typeof h.t==="string")?(()=>{const d=new Date(h.t);return isNaN(d)?"":d.toISOString()})():"";
if(!t)return null;
return{t,e,d:typeof h.d==="string"?h.d.slice(0,120):""}}).filter(Boolean).slice(-50),
// метка свежести → канон. UTC Z-форма, чтобы строковое сравнение в слиянии было хронологически верным
updatedAt:(()=>{const s=c.updatedAt;if(typeof s!=="string"||!s)return"";const d=new Date(s);return isNaN(d)?"":d.toISOString()})()}}
// Карта курсов машины: новый формат — car.rates, старый — eurRate/usdRate
function carRates(car){return car.rates||{EUR:car.eurRate,USD:car.usdRate}}
function carSellRates(car){const r={...carRates(car)};
if(car.sellRates)Object.assign(r,car.sellRates);
else{if(car.sellEurRate)r.EUR=car.sellEurRate;if(car.sellUsdRate)r.USD=car.sellUsdRate}
return r}
function carCost(car){return totR(car.entries,carRates(car))}
function carSellRub(car){return toR(parseNum(car.sellPrice)||0,car.sellCurrency,carSellRates(car))}
function carSellRate(car){return parseNum(carSellRates(car)[car.sellCurrency])||0}
function carProfit(car){return carSellRub(car)-carCost(car)}
function daysBetween(d1,d2){try{return Math.max(0,Math.round((new Date(d2)-new Date(d1))/86400000))}catch(e){return 0}}

// ===== ВИБРАЦИЯ (телефон) =====
function vibrate(ms){try{if(navigator.vibrate)navigator.vibrate(ms||10)}catch(e){}}

// ===== ТОСТ С ОТМЕНОЙ =====
let _toastTimer=null;
function showToast(text,actionLabel,actionFn){
if(_toastTimer){clearTimeout(_toastTimer);_toastTimer=null}
S.toast={text,actionLabel,actionFn};renderToast();
_toastTimer=setTimeout(hideToast,5000)}
function hideToast(){if(_toastTimer){clearTimeout(_toastTimer);_toastTimer=null}S.toast=null;renderToast()}
function toastAction(){const fn=S.toast&&S.toast.actionFn;hideToast();if(fn)fn()}
function renderToast(){const el=document.getElementById("toast");if(!el)return;
if(!S.toast){el.innerHTML="";return}
el.innerHTML=`<div class="toast"><span class="toast-text">${esc(S.toast.text)}</span>`+
(S.toast.actionLabel?`<span class="toast-act" onclick="toastAction()">${esc(S.toast.actionLabel)}</span>`:"")+`</div>`}

// ===== ТРЕКИНГ БЭКАПА =====
function markBackup(){try{localStorage.setItem("autoCalc_lastBackup",String(Date.now()))}catch(e){}}
function backupNeeded(){
if(CL.user||!S.warehouse.length||S.backupHidden)return false;
let last=0;try{last=parseInt(localStorage.getItem("autoCalc_lastBackup")||"0",10)||0}catch(e){}
// первый запуск без бэкапа — не дёргаем сразу, а заводим отсчёт 7 дней
if(!last){try{localStorage.setItem("autoCalc_lastBackup",String(Date.now()))}catch(e){}return false}
return Date.now()-last>7*86400000}

// ===== CONFIRM =====
function showConfirm(msg,fn){S.confirmAction={msg,fn};renderConfirm()}
function hideConfirm(){S.confirmAction=null;renderConfirm()}
function confirmYes(){const f=S.confirmAction&&S.confirmAction.fn;hideConfirm();if(f)f()}
function renderConfirm(){const el=document.getElementById("confirm-dialog");if(!S.confirmAction){el.innerHTML="";return}
el.innerHTML=`<div class="confirm-overlay" onclick="hideConfirm()"><div class="confirm-box" onclick="event.stopPropagation()">
<p>${esc(S.confirmAction.msg)}</p><div class="confirm-btns">
<div class="btn-action btn-outline" onclick="hideConfirm()">ОТМЕНА</div>
<div class="btn-action btn-red" onclick="confirmYes()">ДА</div></div></div></div>`}
