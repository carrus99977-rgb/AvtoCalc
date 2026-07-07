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
carInfo:{vin:"",year:"",body:"",inter:"",vol:"",trim:""},showCarInfo:false,
showReceipt:false,showSettings:true,showProfit:true,sellPrice:"",sellCurrency:"RUB",receiptImage:null,
warehouse:[],expandedCar:null,sellingCarId:null,whSearch:"",whSort:"new",histOpen:false,
sellFormPrice:"",sellFormCurr:"RUB",sellFormRate:"",sellFormDate:"",sellEditMode:false,
editingEntry:null,editValue:"",editCurr:"RUB",editRate:"",
editingCarId:null,editCarEntries:null,bulkRates:{},editName:"",editDate:"",editAskPrice:"",editNote:"",editInfo:null,targetMarkup:"",
cbrBusy:false,cbrDate:"",cbrInfo:"",
toast:null,backupHidden:false,statScope:"all",chartCat:null,listBuilder:null,
carReceipts:{},confirmAction:null,colorOpen:null,clientQuote:null,rateApply:null};

// ===== PERSISTENCE =====
// _whBlockOverwrite — склад не загрузился и сырой резерв НЕ удалось сохранить: блокируем saveWH,
// чтобы не затереть единственную (повреждённую, но восстановимую) копию пустым складом.
let _whBlockOverwrite=false,_whSaveWarned=false;
function loadAll(){
try{const w=localStorage.getItem("autoCalc_wh");if(w){const arr=JSON.parse(w);
S.warehouse=(Array.isArray(arr)?arr:[]).map(normalizeCar).filter(Boolean)}}
catch(e){
// весь blob не распарсился (повреждён): НЕ молчим и НЕ даём следующему saveWH() затереть сырые
// данные пустым []. Сохраняем сырую копию один раз и предупреждаем — есть шанс на восстановление.
let backedUp=false;
try{if(localStorage.getItem("autoCalc_wh_corrupt"))backedUp=true;
else{const raw=localStorage.getItem("autoCalc_wh");if(raw){localStorage.setItem("autoCalc_wh_corrupt",raw);backedUp=true}else backedUp=true}}catch(_){}
if(!backedUp)_whBlockOverwrite=true; // резерв не записался (напр. память переполнена) → не даём saveWH затереть сырьё
setTimeout(()=>{try{alert("Не удалось прочитать сохранённый склад — данные повреждены. Сырая копия сохранена в резерв. Не делайте новых изменений и экспорта до восстановления.")}catch(_){}},0)}
try{const d=localStorage.getItem("autoCalc_draft");if(d){const dd=JSON.parse(d);
S.carName=dd.carName||"";
// миграция со старого формата (eurRate/usdRate) на карту курсов
S.rates=dd.rates?{...DEFAULT_RATES,...dd.rates}:{...DEFAULT_RATES,EUR:dd.eurRate||DEFAULT_RATES.EUR,USD:dd.usdRate||DEFAULT_RATES.USD};
S.activeCur=Array.isArray(dd.activeCur)&&dd.activeCur.length?dd.activeCur.filter(c=>CUR[c]&&c!=="RUB"):[...DEFAULT_ACTIVE];
S.entries=(Array.isArray(dd.entries)?dd.entries:[]).map(normalizeEntry).filter(Boolean);
S.curCat=dd.curCat||0;S.sellPrice=dd.sellPrice||"";S.targetMarkup=dd.targetMarkup||"";
S.carInfo=normCarInfo(dd.carInfo);
S.sellCurrency=CUR[dd.sellCurrency]?dd.sellCurrency:"RUB"}}catch(e){}
}
function saveWH(){if(_whBlockOverwrite)return; // склад повреждён и резерв не сохранён — не затираем сырьё
try{localStorage.setItem("autoCalc_wh",JSON.stringify(S.warehouse))}
catch(e){ // память браузера переполнена — НЕ молчим (иначе изменения тихо теряются при перезагрузке)
if(!_whSaveWarned){_whSaveWarned=true;setTimeout(()=>{try{alert("Не удалось сохранить склад — память браузера переполнена. Сделайте ЭКСПОРТ базы и освободите место, иначе изменения потеряются при перезагрузке.")}catch(_){}},0)}}}
function saveDraft(){try{localStorage.setItem("autoCalc_draft",JSON.stringify({
carName:S.carName,rates:S.rates,activeCur:S.activeCur,
eurRate:S.rates.EUR,usdRate:S.rates.USD,
entries:S.entries,curCat:S.curCat,sellPrice:S.sellPrice,sellCurrency:S.sellCurrency,
targetMarkup:S.targetMarkup,carInfo:S.carInfo}))}catch(e){}}

// При первом запуске (нет сохранённой темы) берём системную; ручной выбор приоритетнее
S.theme="dark";
try{const saved=localStorage.getItem("autoCalc_theme");
S.theme=saved||(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark")}catch(e){}
function applyTheme(){document.body.classList.toggle("light",S.theme==="light");
const mt=document.querySelector('meta[name="theme-color"]');
if(mt)mt.setAttribute("content",S.theme==="light"?"#f1ede6":"#131110")}
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
// Целые рубли из ПОЛЬЗОВАТЕЛЬСКОГО ввода цены: убираем все разделители (пробелы/запятые/точки-тысячные) → целое.
// Для денежных полей (цена клиенту, +₽) копейки не нужны, а «500,000» должно значить 500 000, а не 500
// (в отличие от parseNum, где одиночная запятая — десятичная). НЕ применять к каноничным строкам с точкой-десятичной.
function parseRub(v){const s=String(v==null?"":v).replace(/[^\d]/g,"");if(!s)return NaN;const n=parseInt(s,10);return isFinite(n)&&n<=1e12?n:NaN}
// ===== ИСТОРИЯ ИЗМЕНЕНИЙ ПО МАШИНЕ (ключевые события) =====
const HIST_EV=["created","edited","sold","priceEdit","returned","quoted"];
const HIST_META={
created:{icon:"🏭",label:"Создана"},
edited:{icon:"✏️",label:"Изменены данные"},
sold:{icon:"💰",label:"Продана"},
priceEdit:{icon:"📈",label:"Изменена продажа"},
returned:{icon:"↩️",label:"Возврат на склад"},
quoted:{icon:"📤",label:"Отправлен чек клиенту"}};
// добавить событие в историю машины (с обрезкой текста и лимитом 50)
function addHist(car,e,d){if(!car)return;if(!Array.isArray(car.history))car.history=[];
car.history.push({t:new Date().toISOString(),e:String(e),d:d?String(d).slice(0,120):""});
if(car.history.length>50)car.history=car.history.slice(-50)}
// Запись «отправлен чек клиенту» с дедупом одинаковых подряд (защита от двойного тапа/повторной отправки той же цены).
// true — событие добавлено (нужно сохранить), false — дубль последнего, пропущено.
function pushQuoteHist(car,price){if(!car)return false;const d=fmt(price)+" ₽";
const h=Array.isArray(car.history)?car.history:[];const last=h[h.length-1];
if(last&&last.e==="quoted"&&last.d===d)return false;addHist(car,"quoted",d);return true}
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

// ===== ДАННЫЕ АВТО (VIN, год, цвета, объём, комплектация) =====
// VIN — ВНУТРЕННЕЕ поле: хранится в карточке, виден менеджеру, в клиентский чек не попадает.
// Чистка: латиница (без I/O/Q по стандарту, но не отсекаем — бывают frame numbers), цифры, дефис.
function normVin(v){return String(v==null?"":v).toUpperCase().replace(/[^A-Z0-9-]/g,"").slice(0,20)}
// ЦВЕТА КУЗОВА/САЛОНА — теперь HEX (#rrggbb), выбираются кружками-свотчами + палитрой RGB (не текст).
// Пресеты частых автоцветов для свотчей:
const CAR_COLORS=["#eeeeee","#1c1c1e","#c4c8cc","#74787d","#3a3d42","#23407a","#4c7cc4",
"#b41e1e","#6e1a24","#1f6b3a","#5a3a22","#d8c8a8","#c9a84a","#d2691e"];
// Миграция старых ТЕКСТОВЫХ цветов (из прежних версий/импорта) в HEX
const COLOR_NAMES={"белый":"#eeeeee","чёрный":"#1c1c1e","черный":"#1c1c1e","серебристый":"#c4c8cc","серебро":"#c4c8cc",
"серый":"#74787d","графит":"#3a3d42","тёмно-серый":"#3a3d42","темно-серый":"#3a3d42","антрацит":"#3a3d42",
"синий":"#23407a","голубой":"#4c7cc4","красный":"#b41e1e","бордовый":"#6e1a24","вишнёвый":"#6e1a24","вишневый":"#6e1a24",
"зелёный":"#1f6b3a","зеленый":"#1f6b3a","коричневый":"#5a3a22","бежевый":"#d8c8a8","коньяк":"#d8c8a8",
"золотой":"#c9a84a","песочный":"#c9a84a","оранжевый":"#d2691e","жёлтый":"#e3b505","желтый":"#e3b505"};
// нормализация цвета: HEX как есть (#rgb→#rrggbb), иначе миграция известного названия, иначе "" (не выбран)
function normColor(v){if(typeof v!=="string")return"";v=v.trim();
if(/^#[0-9a-fA-F]{6}$/.test(v))return v.toLowerCase();
if(/^#[0-9a-fA-F]{3}$/.test(v))return("#"+v[1]+v[1]+v[2]+v[2]+v[3]+v[3]).toLowerCase();
return COLOR_NAMES[v.toLowerCase()]||""}
// «свой» цвет = валидный, но не из пресетов (для подсветки кнопки палитры)
function isCustomColor(hex){return !!hex&&CAR_COLORS.indexOf(hex)<0}
// один залитый кружок для HTML (карточка, HTML-чек)
function colorDot(hex){return hex?`<span style="display:inline-block;width:13px;height:13px;border-radius:50%;background:${esc(hex)};border:1px solid rgba(128,128,128,.55);vertical-align:middle;margin-left:4px"></span>`:""}
// подпись+кружок кузова и салона: full=«Цвет кузова:», иначе коротко «Кузов»
function carColorsHTML(ci,full){if(!ci||(!ci.body&&!ci.inter))return"";
const L=full?["Цвет кузова:","Цвет салона:"]:["Кузов","Салон"];const parts=[];
if(ci.body)parts.push(`${esc(L[0])}${colorDot(ci.body)}`);
if(ci.inter)parts.push(`${esc(L[1])}${colorDot(ci.inter)}`);
return parts.join('<span style="display:inline-block;width:14px"></span>')}
// Пикер цвета: ряд пресет-кружков + «🎨» (нативная RGB-палитра) + «✕» сброс.
// field — "body"/"inter"; cur — текущий HEX; fn — имя функции-сеттера ("setCalcColor"/"setEditColor").
// onchange у палитры (не oninput): render рушит нативный пикер, а change стреляет при его закрытии.
function openColor(key){S.colorOpen=key;render()}
function colorPickerHTML(field,cur,fn,key){
// цвет выбран и пикер не раскрыт → свёрнуто: только выбранный кружок + «изменить» + сброс
if(cur&&S.colorOpen!==key)return `<div class="swatch-row">
<div class="swatch sel" style="background:${esc(cur)}" title="Изменить цвет" onclick="openColor('${key}')"></div>
<div class="swatch-change" onclick="openColor('${key}')">изменить</div>
<div class="swatch-clear" title="Сбросить цвет" onclick="${fn}('${field}','')">✕</div></div>`;
// раскрыто (цвет не выбран или нажали «изменить») → вся палитра
return `<div class="swatch-row">
${CAR_COLORS.map(hex=>`<div class="swatch${cur===hex?" sel":""}" style="background:${hex}" onclick="${fn}('${field}','${hex}')"></div>`).join("")}
<label class="swatch swatch-custom${isCustomColor(cur)?" sel":""}"${isCustomColor(cur)?` style="background:${esc(cur)}"`:""}><input type="color" value="${esc(cur||"#888888")}" onchange="${fn}('${field}',this.value)">🎨</label>
${cur?`<div class="swatch-clear" title="Сбросить цвет" onclick="${fn}('${field}','')">✕</div>`:""}</div>`}
function normCarInfo(o){o=o&&typeof o==="object"?o:{};
const yr=parseInt(o.year,10);
return{vin:normVin(o.vin),
year:(yr>=1950&&yr<=2100)?String(yr):"",
body:normColor(o.body),
inter:normColor(o.inter),
vol:typeof o.vol==="string"?o.vol.slice(0,10):(typeof o.vol==="number"&&isFinite(o.vol)?String(o.vol):""),
trim:typeof o.trim==="string"?o.trim.slice(0,80):""}}
// строка характеристик для чеков/карточки: «2023 г · 3.5 л» (цвета теперь отдельно кружками — см. carColorsHTML)
function carSpecsStr(ci){if(!ci)return"";
const v=parseNum(ci.vol);
const volTxt=ci.vol?(v>0?(v<=12?fmtD(v,v%1?1:0)+" л":fmt(v)+" см³"):ci.vol):"";
return[ci.year?ci.year+" г.":"",volTxt].filter(Boolean).join(" · ")}

// ===== ВАЛИДАЦИЯ ВХОДЯЩИХ ДАННЫХ (импорт и облако) =====
// Любая машина из файла/облака проходит через normalizeCar: лишние поля
// отбрасываются, типы приводятся, битые объекты возвращают null.
function normalizeEntry(e){
if(!e||typeof e!=="object")return null;
const amt=parseNum(e.amount);if(!(amt>0))return null; // как в UI: сумма строго > 0 (отсекает 0, отрицательные, NaN); запятые-импорт принимаем
// валюта — только латиница 2-6 символов (реальные коды); мусор → RUB
const cur=(typeof e.currency==="string"&&/^[A-Za-z]{2,6}$/.test(e.currency))?e.currency:"RUB";
// строки из импорта/облака режем по длине (защита от раздутого бэкапа и обрезки в чеке)
return{category:String(e.category||"other").slice(0,40),label:String(e.label||"Позиция").slice(0,80),
icon:String(e.icon||"📦").slice(0,8),amount:amt,currency:cur,
rate:cur==="RUB"?"":numStr(e.rate)}} // курс канонизируем (запятая→точка), мусор→""
// Карта курсов: значения канонизируем (запятая→точка, мусор→""), чтобы импорт/облако не таскали «грязные» строки
function safeRates(o){if(!o||typeof o!=="object"||Array.isArray(o))return null;
const r={};Object.keys(o).forEach(k=>{r[String(k)]=numStr(o[k])});return r}
function normalizeCar(c){
if(!c||typeof c!=="object")return null;
const entries=(Array.isArray(c.entries)?c.entries:[]).map(normalizeEntry).filter(Boolean);
if(!entries.length)return null;
const status=c.status==="sold"?"sold":c.status==="estimate"?"estimate":"stock";
const rates=safeRates(c.rates)||{EUR:numStr(c.eurRate),USD:numStr(c.usdRate)};
// ВАЖНО: не выбрасываем валютную позицию без курса и не роняем из-за неё машину —
// normalizeCar гоняется на каждом старте, легаси-машина (старые версии без валидации
// курса) иначе молча исчезла бы. Себестоимость без курса = 0 ₽, но это видно по ⚠ в карточке.
const sellRates=safeRates(c.sellRates);
return{id:safeId(c.id)||uid(),
name:(typeof c.name==="string"?c.name:String(c.name||"Без названия")).slice(0,200),
// дату валидируем через Date: битую строку из импорта/облака не пропускаем (иначе daysBetween/сортировки → NaN)
date:(()=>{const d=new Date(c.date);return isNaN(d)?new Date().toISOString():d.toISOString()})(),
rates,eurRate:String(rates.EUR||""),usdRate:String(rates.USD||""),
entries,status,
sellPrice:status==="sold"?numStr(c.sellPrice):"",
// валюта продажи — только буквенный код 2-6 симв. (как у позиций): отсекает инъекцию
// в инлайн-onclick формы продажи (esc не экранирует одинарные кавычки), мусор → RUB
sellCurrency:(typeof c.sellCurrency==="string"&&/^[A-Za-z]{2,6}$/.test(c.sellCurrency))?c.sellCurrency:"RUB",
sellDate:(()=>{if(!c.sellDate)return null;const d=new Date(c.sellDate);return isNaN(d)?null:d.toISOString()})(),
sellRates,
sellEurRate:String((sellRates&&sellRates.EUR)||""),
sellUsdRate:String((sellRates&&sellRates.USD)||""),
askPrice:(()=>{const ap=parseNum(c.askPrice);return ap>0?String(ap):""})(),
note:typeof c.note==="string"?c.note.slice(0,500):"",
// данные авто: VIN — внутренний (не для клиентского чека), остальное — клиентские характеристики
info:normCarInfo(c.info),
// история ключевых событий: чистим типы, отбрасываем мусор, лимит 50
history:(Array.isArray(c.history)?c.history:[]).map(h=>{
if(!h||typeof h!=="object")return null;
const e=String(h.e||"");if(!HIST_EV.includes(e))return null;
const t=(typeof h.t==="string")?(()=>{const d=new Date(h.t);return isNaN(d)?"":d.toISOString()})():"";
if(!t)return null;
return{t,e,d:typeof h.d==="string"?h.d.slice(0,120):""}}).filter(Boolean).slice(-50),
// метка свежести → канон. UTC Z-форма, чтобы строковое сравнение в слиянии было хронологически верным
updatedAt:(()=>{const s=c.updatedAt;if(typeof s==="string"&&s){const d=new Date(s);if(!isNaN(d))return d.toISOString()}
// легаси/импорт без метки свежести → берём дату создания, иначе localTs='' и ЛЮБОЕ надгробие удалит машину при слиянии
const dd=new Date(c.date);return isNaN(dd)?new Date().toISOString():dd.toISOString()})()}}
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
function daysBetween(d1,d2){const a=new Date(d1),b=new Date(d2);if(isNaN(a)||isNaN(b))return 0;return Math.max(0,Math.round((b-a)/86400000))}

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
// onCancel (необязателен) зовётся при любом закрытии без «ДА»: кнопка ОТМЕНА или клик по фону
function showConfirm(msg,fn,onCancel){S.confirmAction={msg,fn,onCancel};renderConfirm()}
function hideConfirm(){const c=S.confirmAction;S.confirmAction=null;renderConfirm();if(c&&c.onCancel)c.onCancel()}
function confirmYes(){const c=S.confirmAction;S.confirmAction=null;renderConfirm();if(c&&c.fn)c.fn()}
function renderConfirm(){const el=document.getElementById("confirm-dialog");if(!S.confirmAction){el.innerHTML="";return}
el.innerHTML=`<div class="confirm-overlay" onclick="hideConfirm()"><div class="confirm-box" onclick="event.stopPropagation()">
<p>${esc(S.confirmAction.msg)}</p><div class="confirm-btns">
<div class="btn-action btn-outline" onclick="hideConfirm()">ОТМЕНА</div>
<div class="btn-action btn-red" onclick="confirmYes()">ДА</div></div></div></div>`}
