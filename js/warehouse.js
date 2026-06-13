// ===== WAREHOUSE =====
function addToWH(){if(!S.carName.trim()){alert("Введите название авто");return}
if(S.entries.length===0){alert("Добавьте хотя бы одну позицию");return}
for(const e of S.entries){if(e.currency!=="RUB"&&!(entryRate(e,S.rates)>0)){alert("Проверьте курсы — есть позиции без курса");return}}
const cleanRates={};Object.keys(S.rates).forEach(k=>{cleanRates[k]=numStr(S.rates[k])}); // храним каноничные курсы (точка)
S.warehouse.unshift({id:uid(),name:S.carName.trim(),date:new Date().toISOString(),
rates:cleanRates,eurRate:cleanRates.EUR||"",usdRate:cleanRates.USD||"",
entries:JSON.parse(JSON.stringify(S.entries)),note:"",updatedAt:new Date().toISOString(),
status:"stock",sellPrice:"",sellCurrency:"RUB",sellDate:null,sellRates:null,sellEurRate:"",sellUsdRate:"",history:[]});
addHist(S.warehouse[0],"created",fmt(carCost(S.warehouse[0]))+" ₽");
saveWH();cloudUpsert(S.warehouse[0]);
S.carName="";S.entries=[];S.display="0";S.curCat=0;S.showReceipt=false;S.receiptImage=null;S.sellPrice="";S.editingEntry=null;
S.expandedCar=S.warehouse[0].id;saveDraft();render();
setTimeout(()=>document.getElementById("wh-section")?.scrollIntoView({behavior:"smooth"}),150)}

function startSell(id){S.sellingCarId=id;S.editingCarId=null;S.sellEditMode=false;S.sellFormPrice="";S.sellFormCurr="RUB";
S.sellFormRate="";render()}
function cancelSell(){S.sellingCarId=null;S.sellEditMode=false;render()}
// общая валидация и запись формы продажи (используют и продажа, и правка цены)
function validateSaleForm(){
if(!(parseNum(S.sellFormPrice)>0)){alert("Введите цену продажи");return false}
const sRate=S.sellFormRate||S.rates[S.sellFormCurr]||"";
if(S.sellFormCurr!=="RUB"&&!(parseNum(sRate)>0)){alert("Введите курс продажи");return false}
return true}
function applySaleForm(car){
car.sellPrice=numStr(S.sellFormPrice);car.sellCurrency=S.sellFormCurr; // храним каноничную строку (точка)
const sRate=S.sellFormRate||S.rates[S.sellFormCurr]||"";
car.sellRates={};
if(S.sellFormCurr!=="RUB")car.sellRates[S.sellFormCurr]=numStr(sRate);
// зеркала для совместимости со старыми версиями
car.sellEurRate=car.sellRates.EUR||"";car.sellUsdRate=car.sellRates.USD||""}
// краткая запись о продаже для истории/деталей: «1 500 000 ₽» или «20 000 € → 1 904 048 ₽»
function saleStr(car){const s=curInfo(car.sellCurrency);const p=fmt(parseNum(car.sellPrice)||0)+" "+s.symbol;
return car.sellCurrency!=="RUB"?p+" → "+fmt(carSellRub(car))+" ₽":p}
function doSell(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
if(!validateSaleForm())return;
applySaleForm(car);car.status="sold";car.sellDate=new Date().toISOString();
addHist(car,"sold",saleStr(car));
S.sellingCarId=null;S.sellEditMode=false;touch(car);saveWH();cloudUpsert(car);render()}
// изменить цену уже проданной: статус и дату продажи не трогаем
function startEditSale(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.sellingCarId=id;S.sellEditMode=true;S.editingCarId=null;
S.sellFormPrice=String(car.sellPrice||"");S.sellFormCurr=car.sellCurrency||"RUB";
S.sellFormRate=car.sellCurrency!=="RUB"?String(carSellRate(car)||""):"";render()}
function saveSaleEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car||car.status!=="sold")return;
if(!validateSaleForm())return;
const was=saleStr(car); // фиксируем «было» до применения новых значений
applySaleForm(car);
const now=saleStr(car);if(now!==was)addHist(car,"priceEdit",was+" → "+now);
S.sellingCarId=null;S.sellEditMode=false;touch(car);saveWH();cloudUpsert(car);render()}
function delCar(id){showConfirm("Удалить машину из базы?",()=>{
const idx=S.warehouse.findIndex(c=>c.id===id);if(idx<0)return;
const removed=S.warehouse[idx];const receipt=S.carReceipts[id];
S.warehouse.splice(idx,1);cloudDelete(id);
if(S.expandedCar===id)S.expandedCar=null;delete S.carReceipts[id];saveWH();render();
showToast("Машина удалена","Отменить",()=>{
S.warehouse.splice(Math.min(idx,S.warehouse.length),0,removed);
if(receipt)S.carReceipts[id]=receipt;touch(removed);cloudUpsert(removed);saveWH();render()})})}
function retStock(id){showConfirm("Вернуть машину на склад? Данные продажи будут стёрты.",()=>{
const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.sellingCarId=null;S.sellEditMode=false; // закрыть форму правки цены, иначе СОХРАНИТЬ запишет данные продажи на сток
car.status="stock";car.sellPrice="";car.sellCurrency="RUB";car.sellDate=null;
car.sellRates=null;car.sellEurRate="";car.sellUsdRate="";
addHist(car,"returned","");
touch(car);saveWH();cloudUpsert(car);render()})}
function togExp(id){S.expandedCar=S.expandedCar===id?null:id;S.sellingCarId=null;S.sellEditMode=false;S.histOpen=false;
if(S.editingCarId!==id)S.editingCarId=null;render()}
function togHist(){S.histOpen=!S.histOpen;render()}
function cpToCalc(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
const doCopy=()=>{
S.carName=car.name;
const cr=carRates(car);Object.keys(cr).forEach(c=>{if(cr[c])S.rates[c]=cr[c]});
car.entries.forEach(e=>{if(e.currency!=="RUB"&&CUR[e.currency]&&!S.activeCur.includes(e.currency))S.activeCur.push(e.currency)});
S.activeCur=Object.keys(CUR).filter(k=>S.activeCur.includes(k));
S.entries=JSON.parse(JSON.stringify(car.entries));S.display="0";S.curCat=0;S.showReceipt=false;S.sellPrice="";
S.editingEntry=null; // иначе форма правки позиции «прилипнет» к скопированной машине со старыми значениями
saveDraft();render();window.scrollTo({top:0,behavior:"smooth"})};
// незавершённый расчёт в калькуляторе не затираем молча
if(S.entries.length)showConfirm("Заменить текущий расчёт данными этой машины?",doCopy);
else doCopy()}

// ===== CAR EDIT MODE (per-entry rates and amounts) =====
// ISO-дата машины → yyyy-mm-dd для input[type=date] (локальный день, без сдвига пояса)
function carDateInput(car){try{const d=new Date(car.date);if(isNaN(d))return"";
const p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())}catch(e){return""}}
function startCarEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.editingCarId=id;S.sellingCarId=null;S.sellEditMode=false;S.expandedCar=id;
S.editName=car.name;S.editDate=carDateInput(car);S.editAskPrice=car.askPrice||"";S.editNote=car.note||"";
const cr=carRates(car);
S.editCarEntries=car.entries.map(e=>({...e,
rate:e.rate||(e.currency==="RUB"?"":(cr[e.currency]||""))}));
S.bulkRates={};S.editCarEntries.forEach(e=>{
if(e.currency!=="RUB"&&!(e.currency in S.bulkRates))S.bulkRates[e.currency]=S.rates[e.currency]||cr[e.currency]||""});
render()}
function cancelCarEdit(){S.editingCarId=null;S.editCarEntries=null;render()}
function saveCarEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car||!S.editCarEntries)return;
if(!String(S.editName||"").trim()){alert("Введите название авто");return}
for(const e of S.editCarEntries){if(!(parseNum(e.amount)>0)){alert("Проверьте суммы — есть пустые или нулевые");return}
if(e.currency!=="RUB"&&!(parseNum(e.rate)>0)){alert("Проверьте курсы — есть пустые");return}}
const oldCost=carCost(car); // себестоимость до правки — для истории
// сигнатура значимых полей (дата — на уровне дня): событие пишем, только если реально что-то изменилось
const sig=c=>JSON.stringify({n:c.name||"",no:c.note||"",a:c.askPrice||"",d:carDateInput(c),e:c.entries});
const before=sig(car);
car.entries=S.editCarEntries.map(e=>{const{_new,...rest}=e;
return{...rest,amount:parseNum(e.amount),rate:e.currency==="RUB"?"":numStr(e.rate)}});
car.name=S.editName.trim();
car.note=String(S.editNote||"").trim().slice(0,500);
const ap=parseNum(S.editAskPrice);car.askPrice=ap>0?String(ap):"";
// пустую/битую дату не трогаем; иначе фиксируем полдень выбранного дня (без сдвига пояса)
if(/^\d{4}-\d{2}-\d{2}$/.test(S.editDate||"")){const d=new Date(S.editDate+"T12:00:00");if(!isNaN(d))car.date=d.toISOString()}
if(sig(car)!==before){const newCost=carCost(car);const dCost=Math.round(newCost)-Math.round(oldCost); // дельта на уровне ₽
addHist(car,"edited",fmt(newCost)+" ₽"+(dCost?" ("+(dCost>0?"+":"")+fmt(dCost)+")":""));}
S.editingCarId=null;S.editCarEntries=null;touch(car);saveWH();cloudUpsert(car);render()}
function updEditEntry(i,field,val){if(!S.editCarEntries)return;S.editCarEntries[i][field]=val;updEditCost()}
function updEditCost(){if(!S.editCarEntries)return;
const car=S.warehouse.find(c=>c.id===S.editingCarId);if(!car)return;
const entries=S.editCarEntries.map(e=>({...e,amount:parseNum(e.amount)||0}));
// null вместо карты курсов машины: строка без введённого курса честно даёт 0 ₽ в превью
const cost=totR(entries,null);
const el=document.getElementById("edit-cost-val");if(el)el.textContent=fmt(cost)+" ₽";
// разница с исходной
const orig=carCost(car);const diff=cost-orig;
const del=document.getElementById("edit-cost-diff");
if(del){del.textContent=(diff===0?"без изменений":(diff>0?"+":"")+fmt(diff)+" ₽ к исходной");
del.style.color=diff>0?"#e74c3c":diff<0?"#27ae60":"#556"}}
function bulkApply(curr){if(!S.editCarEntries)return;
const v=S.bulkRates[curr];if(!(parseNum(v)>0)){alert("Введите курс");return}
const cv=numStr(v);S.editCarEntries.forEach(e=>{if(e.currency===curr)e.rate=cv});render()}

// ===== ДОБАВЛЕНИЕ РАСХОДА К МАШИНЕ (в режиме правки) =====
function addEditEntry(){if(!S.editCarEntries)return;
const cat=CATS.find(c=>c.id==="other")||CATS[CATS.length-1];
S.editCarEntries.push({_new:true,category:cat.id,label:cat.label,icon:cat.icon,amount:"",currency:"RUB",rate:""});
render()}
function rmEditEntry(i){const e=S.editCarEntries&&S.editCarEntries[i];
if(!e||!e._new)return; // удалять можно только ещё не сохранённые строки
S.editCarEntries.splice(i,1);render()}
function setEditEntryCat(i,catId){const c=CATS.find(x=>x.id===catId);const e=S.editCarEntries&&S.editCarEntries[i];
if(!c||!e)return;e.category=c.id;e.label=c.label;e.icon=c.icon;updEditCost()}
function setEditEntryCur(i,cur){const e=S.editCarEntries&&S.editCarEntries[i];if(!e||!CUR[cur])return;
e.currency=cur;e.rate=cur==="RUB"?"":(S.rates[cur]||"");render()}

// ===== BACKUP =====
function exportData(){
const data={version:2,exported:new Date().toISOString(),warehouse:S.warehouse};
const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
const a=document.createElement("a");a.href=URL.createObjectURL(blob);
a.download="АвтоСклад_бэкап_"+new Date().toLocaleDateString("ru-RU").replace(/\./g,"-")+".json";
document.body.appendChild(a);a.click();document.body.removeChild(a);
setTimeout(()=>URL.revokeObjectURL(a.href),1000);markBackup();S.backupHidden=true;render()}
function importData(){document.getElementById("import-file").click()}
document.getElementById("import-file").addEventListener("change",function(ev){
const f=ev.target.files[0];if(!f){return}
// отклоняем огромный файл ДО чтения/парсинга — иначе он подвесит вкладку ещё до лимита машин.
// потолок щедрый: даже тяжёлый бэкап 5000 машин (заметки/история) укладывается, цель — отсечь абсурд
const MAX_FILE=100*1024*1024; // 100 МБ
if(f.size>MAX_FILE){alert("Файл слишком большой ("+Math.round(f.size/1048576)+" МБ). Максимум 100 МБ.");ev.target.value="";return}
const reader=new FileReader();
reader.onerror=()=>{alert("Не удалось прочитать файл");ev.target.value=""};
reader.onload=e=>{try{const data=JSON.parse(e.target.result);
const rawAll=Array.isArray(data)?data:(data.warehouse||[]);
const MAX_IMPORT=5000; // потолок против раздутого бэкапа (реальному складу столько не нужно)
const raw=(Array.isArray(rawAll)?rawAll:[]).slice(0,MAX_IMPORT);
const cars=raw.map(normalizeCar).filter(Boolean);
if(!cars.length){alert("Файл не содержит данных склада");return}
const skipped=raw.length-cars.length;
const truncated=(Array.isArray(rawAll)?rawAll.length:0)-raw.length;
showConfirm(`Найдено машин: ${cars.length}${skipped?` (пропущено битых: ${skipped})`:""}${truncated>0?` (обрезано сверх лимита: ${truncated})`:""}. Добавить к текущему складу? (дубликаты по ID — по свежести)`,()=>{
cars.forEach(nc=>{const i=S.warehouse.findIndex(c=>c.id===nc.id);
// не затираем более свежую локальную версию старым бэкапом (сравнение по updatedAt)
if(i>=0){if(tsKey(nc.updatedAt)>=tsKey(S.warehouse[i].updatedAt))S.warehouse[i]=nc}
else S.warehouse.push(nc)});
// импортированные машины минуют очередь — помечаем состояние несинхронизированным,
// чтобы выход не стёр их, пока fullSync не подтвердит загрузку в облако
if(typeof CL!=="undefined")CL.synced=false;
saveWH();render();
// в облако — через слияние по свежести (а не слепой upsert каждой машины: тот откатывал бы
// более свежие облачные данные и давал O(n²) пере-сериализацию очереди)
if(typeof fullSync==="function")fullSync()})}catch(err){alert("Ошибка чтения файла")}};
reader.readAsText(f);ev.target.value=""});

// ===== ПОИСК И СОРТИРОВКА =====
function whMatch(car){const q=S.whSearch.trim().toLowerCase();
return !q||(car.name+" "+(car.note||"")).toLowerCase().includes(q)}
function sortStock(list){const l=[...list];
if(S.whSort==="old")return l.sort((a,b)=>(a.date||"").localeCompare(b.date||""));
if(S.whSort==="exp")return l.sort((a,b)=>carCost(b)-carCost(a));
if(S.whSort==="cheap")return l.sort((a,b)=>carCost(a)-carCost(b));
return l.sort((a,b)=>(b.date||"").localeCompare(a.date||""))}
function stockListHTML(){
const stk=sortStock(S.warehouse.filter(c=>c.status==="stock"&&whMatch(c)));
if(!stk.length)return `<div class="empty-state"><div class="em-icon">🏭</div><div class="em-text">${S.whSearch.trim()?"Ничего не найдено":"Склад пуст"}<br><span style="color:#444;font-size:11px">${S.whSearch.trim()?"Поправьте запрос":"Добавьте машину через калькулятор"}</span></div></div>`;
return stk.map(c=>carCardHTML(c)).join("")}
function soldListHTML(){
const sld=S.warehouse.filter(c=>c.status==="sold"&&whMatch(c));
if(!sld.length)return `<div class="empty-state"><div class="em-icon">📊</div><div class="em-text">${S.whSearch.trim()?"Ничего не найдено":"Нет проданных машин"}</div></div>`;
return sld.map(c=>carCardHTML(c)).join("")}
// Частичная перерисовка списков — фокус в поле поиска не теряется
function rLists(){const a=document.getElementById("wh-list");if(a)a.innerHTML=stockListHTML();
const b=document.getElementById("sold-list");if(b)b.innerHTML=soldListHTML()}

function whHTML(){
const stk=S.warehouse.filter(c=>c.status==="stock");
const frozen=stk.reduce((s,c)=>s+carCost(c),0);
const avgAge=stk.length?Math.round(stk.reduce((s,c)=>s+daysBetween(c.date,new Date()),0)/stk.length):0;
let h=`<div class="section-divider" id="wh-section"><span>🏭 Склад (${stk.length})</span></div>`;
if(backupNeeded())h+=`<div class="backup-warn">
<span>💾 Давно не сохраняли базу — сделайте бэкап, чтобы не потерять данные.</span>
<div class="backup-warn-acts"><span class="bw-act" onclick="exportData()">ЭКСПОРТ</span>
<span class="bw-x" onclick="S.backupHidden=true;render()">✕</span></div></div>`;
h+=`${cloudBoxHTML()}<div class="backup-row">
<div class="backup-btn" onclick="exportData()">💾 ЭКСПОРТ БАЗЫ</div>
<div class="backup-btn" onclick="importData()">📥 ИМПОРТ БАЗЫ</div>
<div class="backup-btn" onclick="exportCSV()">📊 EXCEL</div>
<div class="backup-btn" onclick="shareStockList()">📤 СПИСОК</div></div>`;
if(stk.length)h+=`<div class="stats-bar">
<div class="stat-card"><div class="stat-num gold">${fmt(frozen)}</div><div class="stat-lbl">ЗАМОРОЖЕНО ₽</div></div>
<div class="stat-card"><div class="stat-num blue">${avgAge}</div><div class="stat-lbl">СР. ДНЕЙ НА СКЛАДЕ</div></div></div>`;
if(S.warehouse.length)h+=`<input type="text" class="wh-search" placeholder="🔍 Поиск по названию" value="${esc(S.whSearch)}" oninput="S.whSearch=this.value;rLists()">
<div class="sort-row">${[["new","СНАЧАЛА НОВЫЕ"],["old","СТАРЫЕ"],["exp","ДОРОЖЕ"],["cheap","ДЕШЕВЛЕ"]].map(([k,lbl])=>`<div class="sort-chip ${S.whSort===k?"active":""}" onclick="S.whSort='${k}';render()">${lbl}</div>`).join("")}</div>`;
h+=`<div id="wh-list">${stockListHTML()}</div>`;
return h}

function soldHTML(){
const sld=S.warehouse.filter(c=>c.status==="sold");
const tp=sld.reduce((s,c)=>s+carProfit(c),0);
let h=`<div class="section-divider sold" id="sold-section"><span>💰 Проданные (${sld.length})</span></div>`;
if(sld.length)h+=`<div class="stats-bar">
<div class="stat-card"><div class="stat-num green">${sld.length}</div><div class="stat-lbl">МАШИН</div></div>
<div class="stat-card"><div class="stat-num ${tp>=0?"green":"red"}">${tp>=0?"+":""}${fmt(tp)}</div><div class="stat-lbl">ПРИБЫЛЬ ₽</div></div></div>`;
h+=`<div id="sold-list">${soldListHTML()}</div>`;
return h}

function carCardHTML(car){
const cost=carCost(car),exp=S.expandedCar===car.id,selling=S.sellingCarId===car.id,editing=S.editingCarId===car.id;
const sellR=carSellRub(car),pr=sellR-cost;
let h=`<div class="wh-card"><div class="wh-card-header" onclick="togExp('${esc(car.id)}')">
<div><div class="wh-car-name">🚗 ${esc(car.name)}<span class="wh-status ${car.status}">${car.status==="stock"?"СКЛАД":"ПРОДАНО"}</span></div>
<div style="color:#556;font-size:10px;margin-top:2px">${dShort(car.date)}${car.status==="stock"?` · ${daysBetween(car.date,new Date())} дн. на складе`:""}</div></div>
<div style="text-align:right"><div class="wh-car-cost">${fmt(cost)} ₽</div>
${car.status==="sold"?`<div style="color:${pr>=0?"#27ae60":"#e74c3c"};font-size:11px;font-weight:600">${pr>=0?"+":""}${fmt(pr)} ₽</div>`:""}</div></div>`;

if(exp&&editing&&S.editCarEntries){
// ===== РЕЖИМ РЕДАКТИРОВАНИЯ КУРСОВ И СУММ =====
const bulkCurs=Object.keys(S.bulkRates);
h+=`<div class="wh-detail" onclick="event.stopPropagation()">
<div style="color:var(--gold);font-size:11px;font-weight:700;margin-bottom:10px;letter-spacing:1px">✏️ РЕДАКТИРОВАНИЕ МАШИНЫ</div>
<div class="edit-fields" style="margin-bottom:10px">
<div class="edit-field" style="flex:2"><label class="edit-lbl">НАЗВАНИЕ</label>
<input type="text" class="edit-input" value="${esc(S.editName)}" oninput="S.editName=this.value"></div>
<div class="edit-field"><label class="edit-lbl">ДАТА ПОКУПКИ</label>
<input type="date" class="edit-input edit-date" value="${esc(S.editDate)}" oninput="S.editDate=this.value"></div></div>
<div class="edit-fields" style="margin-bottom:10px">
<div class="edit-field"><label class="edit-lbl">ЦЕНА ДЛЯ КЛИЕНТА ₽ (для списка машин, не себестоимость)</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" placeholder="не указана" value="${esc(S.editAskPrice)}" oninput="S.editAskPrice=this.value"></div></div>
<div class="edit-fields" style="margin-bottom:10px">
<div class="edit-field"><label class="edit-lbl">ЗАМЕТКА (VIN, комплектация, контакты)</label>
<textarea class="edit-input edit-area" rows="2" maxlength="500" placeholder="пусто" oninput="S.editNote=this.value">${esc(S.editNote)}</textarea></div></div>
<div style="color:#667;font-size:9px;margin-bottom:6px;letter-spacing:.5px">КУРСЫ ПО ФАКТУ ОПЛАТЫ:</div>`;
if(bulkCurs.length){
h+=`<div style="color:#667;font-size:9px;margin-bottom:6px;letter-spacing:.5px">БЫСТРО ПРИМЕНИТЬ КУРС КО ВСЕМ ПОЗИЦИЯМ:</div>`;
bulkCurs.forEach(c=>{h+=`<div class="bulk-rate-row"><div class="bulk-rate-field">
<label class="edit-lbl">${curInfo(c).symbol} ${esc(c)} / ₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" value="${esc(S.bulkRates[c])}" oninput="S.bulkRates['${esc(c)}']=this.value"></div>
<div class="bulk-apply" onclick="bulkApply('${esc(c)}')">→ ВСЕМ ${curInfo(c).symbol}</div></div>`});
}
S.editCarEntries.forEach((e,i)=>{const cm=curInfo(e.currency);
if(e._new){
// новая позиция: категория + валюта выбираются
h+=`<div class="edit-entry-card edit-new"><div class="edit-entry-title" style="display:flex;justify-content:space-between;align-items:center">
<span>➕ Новый расход</span>
<span class="entry-act del" style="opacity:.6" onclick="rmEditEntry(${i})">✕</span></div>
<select class="edit-input edit-select" onchange="setEditEntryCat(${i},this.value)">
${CATS.map(c=>`<option value="${c.id}" ${e.category===c.id?"selected":""}>${c.icon} ${c.label}</option>`).join("")}</select>
<div class="profit-curr-row" style="margin:8px 0">
${["RUB",...S.activeCur].map(c=>`<div class="pcb ${e.currency===c?"a-"+curInfo(c).cls:""}"
onclick="setEditEntryCur(${i},'${esc(c)}')">${curInfo(c).symbol} ${esc(c)}</div>`).join("")}</div>
<div class="edit-fields">
<div class="edit-field"><label class="edit-lbl">СУММА ${cm.symbol}</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" placeholder="0" value="${esc(e.amount)}" oninput="updEditEntry(${i},'amount',this.value)"></div>
${e.currency!=="RUB"?`<div class="edit-field"><label class="edit-lbl">КУРС ₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" value="${esc(e.rate)}" oninput="updEditEntry(${i},'rate',this.value)"></div>`:""}
</div></div>`;
}else{
h+=`<div class="edit-entry-card"><div class="edit-entry-title">${esc(e.icon)} ${esc(e.label)} (${cm.symbol})</div>
<div class="edit-fields">
<div class="edit-field"><label class="edit-lbl">СУММА ${cm.symbol}</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" value="${esc(e.amount)}" oninput="updEditEntry(${i},'amount',this.value)"></div>
${e.currency!=="RUB"?`<div class="edit-field"><label class="edit-lbl">КУРС ₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" value="${esc(e.rate)}" oninput="updEditEntry(${i},'rate',this.value)"></div>`:""}
</div></div>`}});
h+=`<div class="backup-btn" style="margin-bottom:10px" onclick="addEditEntry()">➕ ДОБАВИТЬ РАСХОД</div>`;
const editCost=totR(S.editCarEntries.map(e=>({...e,amount:parseNum(e.amount)||0})),null);
const editDiff=editCost-cost;
h+=`<div class="edit-cost-preview"><span class="ecp-lbl">СЕБЕСТОИМОСТЬ</span>
<div style="text-align:right"><div class="ecp-val" id="edit-cost-val">${fmt(editCost)} ₽</div>
<div id="edit-cost-diff" style="font-size:9px;color:${editDiff>0?"#e74c3c":editDiff<0?"#27ae60":"#556"}">${editDiff===0?"без изменений":(editDiff>0?"+":"")+fmt(editDiff)+" ₽ к исходной"}</div></div></div>
<div style="display:flex;gap:8px">
<div class="btn-action btn-green" style="flex:1;margin:0;font-size:11px;padding:11px 0" onclick="saveCarEdit('${esc(car.id)}')">✅ СОХРАНИТЬ</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:11px 16px;font-size:11px" onclick="cancelCarEdit()">✕ ОТМЕНА</div></div></div>`;
}else if(exp){
// ===== ОБЫЧНЫЙ ПРОСМОТР =====
const cr=carRates(car);
h+=`<div class="wh-detail">
<div style="color:#556;font-size:10px;font-weight:600;margin-bottom:8px;letter-spacing:1px">РАЗБИВКА РАСХОДОВ (курс на дату оплаты)</div>`;
car.entries.forEach(e=>{const cm=curInfo(e.currency);const r=entryRate(e,cr);
const rv=entryRub(e,cr);
h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">${esc(e.icon)} ${esc(e.label)}</span>
<span class="wh-detail-val">${esc(fmt(e.amount))} ${cm.symbol}${e.currency!=="RUB"?" × "+(r?fmtRate(r):"⚠ нет курса")+" = "+fmt(rv)+" ₽":""}</span></div>`});
h+=`<div class="wh-detail-row" style="border-top:2px solid var(--br2);padding-top:8px;margin-top:4px">
<span style="color:var(--gold);font-size:12px;font-weight:700">СЕБЕСТОИМОСТЬ</span>
<span style="color:var(--gold);font-size:14px;font-weight:700;font-family:'Oswald',sans-serif">${fmt(cost)} ₽</span></div>`;
if(car.status==="stock"&&parseNum(car.askPrice)>0)h+=`<div class="wh-detail-row">
<span class="wh-detail-lbl">💰 Цена для клиента</span>
<span class="wh-detail-val">${fmt(parseNum(car.askPrice))} ₽</span></div>`;
if(car.note)h+=`<div class="wh-note">📝 ${esc(car.note)}</div>`;
if(car.status==="sold"){const mg=cost>0?(pr/cost)*100:0,ip=pr>=0;
const sCur=curInfo(car.sellCurrency);
h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">💰 Продажа</span>
<span class="wh-detail-val">${fmt(parseNum(car.sellPrice)||0)} ${sCur.symbol}${car.sellCurrency!=="RUB"?" → "+fmt(sellR)+" ₽":""}</span></div>
${car.sellCurrency!=="RUB"?`<div class="wh-detail-row"><span class="wh-detail-lbl">📈 Курс продажи</span>
<span class="wh-detail-val">${fmtRate(carSellRate(car))} ₽/${sCur.symbol}</span></div>`:""}
<div class="wh-detail-row"><span class="wh-detail-lbl">📊 Прибыль</span>
<span class="wh-detail-val" style="color:${ip?"#27ae60":"#e74c3c"}">${ip?"+":""}${fmt(pr)} ₽ (${ip?"+":""}${fmtD(mg,1)}%)</span></div>
${car.sellDate?`<div class="wh-detail-row"><span class="wh-detail-lbl">📅 Продана</span>
<span class="wh-detail-val">${dShort(car.sellDate)} · стояла ${daysBetween(car.date,car.sellDate)} дн.</span></div>`:""}`}
h+=`<div class="wh-actions">`;
if(car.status==="stock"){h+=`<div class="btn-action btn-green" title="Оформить продажу" onclick="event.stopPropagation();startSell('${esc(car.id)}')">💰 ПРОДАТЬ</div>`}
h+=`<div class="btn-action btn-blue" title="Название, дата, курсы и суммы" onclick="event.stopPropagation();startCarEdit('${esc(car.id)}')">✏️ ПРАВКА</div>`;
if(car.status==="stock"){h+=`<div class="btn-action btn-outline" style="flex:0 0 auto;padding:10px 14px" data-tip="В калькулятор" aria-label="Скопировать в калькулятор" onclick="event.stopPropagation();cpToCalc('${esc(car.id)}')">📋</div>`}
else{h+=`<div class="btn-action btn-green" title="Изменить цену продажи" onclick="event.stopPropagation();startEditSale('${esc(car.id)}')">💰 ЦЕНА</div>
<div class="btn-action btn-outline" title="Вернуть на склад" onclick="event.stopPropagation();retStock('${esc(car.id)}')">↩️ ВЕРНУТЬ</div>`}
h+=`<div class="btn-action btn-yellow tip-end" style="flex:0 0 auto;padding:10px 14px" data-tip="Скачать чек себе" aria-label="Скачать чек себе" onclick="event.stopPropagation();carReceipt('${esc(car.id)}')">⬇️</div>
<div class="btn-action btn-blue tip-end" style="flex:0 0 auto;padding:10px 14px" data-tip="Поделиться чеком" aria-label="Поделиться чеком" onclick="event.stopPropagation();carShare('${esc(car.id)}')">📤</div>
<div class="btn-action btn-red tip-end" style="flex:0 0 auto;padding:10px 14px" data-tip="Удалить машину" aria-label="Удалить машину" onclick="event.stopPropagation();delCar('${esc(car.id)}')">🗑</div></div>`;
if(S.carReceipts[car.id])h+=`<div class="saved-preview"><p>✅ ЧЕК СОХРАНЁН — ЗАЖМИТЕ ДЛЯ КОПИРОВАНИЯ</p><img src="${S.carReceipts[car.id]}" alt="Чек"></div>`;
const hist=carHistory(car);
h+=`<div class="wh-hist"><div class="wh-hist-head" onclick="event.stopPropagation();togHist()">
<span>🕓 История (${hist.length})</span><span class="coll-arrow" style="transform:rotate(${S.histOpen?180:0}deg)">▾</span></div>`;
if(S.histOpen)h+=`<div class="wh-hist-body">${hist.slice().reverse().map(ev=>{const m=HIST_META[ev.e]||{icon:"•",label:ev.e};
return `<div class="wh-hist-row"><span class="wh-hist-ic">${m.icon}</span>
<div class="wh-hist-info"><div class="wh-hist-lbl">${esc(m.label)}${ev.d?` · <span class="wh-hist-d">${esc(ev.d)}</span>`:""}</div>
<div class="wh-hist-date">${esc(histDate(ev.t))}</div></div></div>`}).join("")}</div>`;
h+=`</div></div>`}

if(selling){h+=`<div class="wh-sell-form" onclick="event.stopPropagation()">
<div style="color:#888;font-size:11px;font-weight:600;margin-bottom:8px">${S.sellEditMode?"ИЗМЕНИТЬ ПРОДАЖУ":"ОФОРМИТЬ ПРОДАЖУ"}</div>
<input type="text" inputmode="decimal" maxlength="16" class="wh-sell-input" placeholder="Цена продажи" value="${esc(S.sellFormPrice)}" oninput="S.sellFormPrice=this.value">
<div class="profit-curr-row">
${[...new Set(["RUB",...S.activeCur,S.sellFormCurr])].map(c=>`<div class="pcb ${S.sellFormCurr===c?"a-"+curInfo(c).cls:""}"
onclick="if(S.sellFormCurr!=='${esc(c)}'){S.sellFormCurr='${esc(c)}';S.sellFormRate=S.rates['${esc(c)}']||''}render()">${curInfo(c).symbol} ${esc(c)}</div>`).join("")}</div>
${S.sellFormCurr!=="RUB"?`<label class="sell-rate-lbl">КУРС НА ДАТУ ПРОДАЖИ ${curInfo(S.sellFormCurr).symbol}/₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="wh-sell-input" value="${esc(S.sellFormRate)}" oninput="S.sellFormRate=this.value">`:""}
<div style="display:flex;gap:8px;margin-top:4px">
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="${S.sellEditMode?"saveSaleEdit":"doSell"}('${esc(car.id)}')">${S.sellEditMode?"✅ СОХРАНИТЬ":"✅ ПРОДАТЬ"}</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 16px" onclick="cancelSell()">✕</div></div></div>`}
h+=`</div>`;
return h}
