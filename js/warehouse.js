// ===== WAREHOUSE =====
function addToWH(){if(!S.carName.trim()){alert("Введите название авто");return}
if(S.entries.length===0){alert("Добавьте хотя бы одну позицию");return}
S.warehouse.unshift({id:uid(),name:S.carName.trim(),date:new Date().toISOString(),
rates:{...S.rates},eurRate:S.rates.EUR||"",usdRate:S.rates.USD||"",
entries:JSON.parse(JSON.stringify(S.entries)),
status:"stock",sellPrice:"",sellCurrency:"RUB",sellDate:null,sellRates:null,sellEurRate:"",sellUsdRate:""});
saveWH();cloudUpsert(S.warehouse[0]);
S.carName="";S.entries=[];S.display="0";S.curCat=0;S.showReceipt=false;S.receiptImage=null;S.sellPrice="";
S.expandedCar=S.warehouse[0].id;saveDraft();render();
setTimeout(()=>document.getElementById("wh-section")?.scrollIntoView({behavior:"smooth"}),150)}

function startSell(id){S.sellingCarId=id;S.editingCarId=null;S.sellFormPrice="";S.sellFormCurr="RUB";
S.sellFormRate="";render()}
function cancelSell(){S.sellingCarId=null;render()}
function doSell(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
if(!parseFloat(S.sellFormPrice)){alert("Введите цену продажи");return}
const sRate=S.sellFormRate||S.rates[S.sellFormCurr]||"";
if(S.sellFormCurr!=="RUB"&&!(parseFloat(sRate)>0)){alert("Введите курс продажи");return}
car.sellPrice=S.sellFormPrice;car.sellCurrency=S.sellFormCurr;
car.sellRates={};
if(S.sellFormCurr!=="RUB")car.sellRates[S.sellFormCurr]=sRate;
// зеркала для совместимости со старыми версиями
car.sellEurRate=car.sellRates.EUR||"";car.sellUsdRate=car.sellRates.USD||"";
car.status="sold";car.sellDate=new Date().toISOString();
S.sellingCarId=null;saveWH();cloudUpsert(car);render()}
function delCar(id){showConfirm("Удалить машину из базы?",()=>{
const idx=S.warehouse.findIndex(c=>c.id===id);if(idx<0)return;
const removed=S.warehouse[idx];const receipt=S.carReceipts[id];
S.warehouse.splice(idx,1);cloudDelete(id);
if(S.expandedCar===id)S.expandedCar=null;delete S.carReceipts[id];saveWH();render();
showToast("Машина удалена","Отменить",()=>{
S.warehouse.splice(Math.min(idx,S.warehouse.length),0,removed);
if(receipt)S.carReceipts[id]=receipt;cloudUpsert(removed);saveWH();render()})})}
function retStock(id){showConfirm("Вернуть машину на склад? Данные продажи будут стёрты.",()=>{
const car=S.warehouse.find(c=>c.id===id);if(!car)return;
car.status="stock";car.sellPrice="";car.sellCurrency="RUB";car.sellDate=null;
car.sellRates=null;car.sellEurRate="";car.sellUsdRate="";
saveWH();cloudUpsert(car);render()})}
function togExp(id){S.expandedCar=S.expandedCar===id?null:id;S.sellingCarId=null;
if(S.editingCarId!==id)S.editingCarId=null;render()}
function cpToCalc(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.carName=car.name;
const cr=carRates(car);Object.keys(cr).forEach(c=>{if(cr[c])S.rates[c]=cr[c]});
car.entries.forEach(e=>{if(e.currency!=="RUB"&&CUR[e.currency]&&!S.activeCur.includes(e.currency))S.activeCur.push(e.currency)});
S.activeCur=Object.keys(CUR).filter(k=>S.activeCur.includes(k));
S.entries=JSON.parse(JSON.stringify(car.entries));S.display="0";S.curCat=0;S.showReceipt=false;S.sellPrice="";
saveDraft();render();window.scrollTo({top:0,behavior:"smooth"})}

// ===== CAR EDIT MODE (per-entry rates and amounts) =====
// ISO-дата машины → yyyy-mm-dd для input[type=date] (локальный день, без сдвига пояса)
function carDateInput(car){try{const d=new Date(car.date);if(isNaN(d))return"";
const p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())}catch(e){return""}}
function startCarEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.editingCarId=id;S.sellingCarId=null;S.expandedCar=id;
S.editName=car.name;S.editDate=carDateInput(car);
const cr=carRates(car);
S.editCarEntries=car.entries.map(e=>({...e,
rate:e.rate||(e.currency==="RUB"?"":(cr[e.currency]||""))}));
S.bulkRates={};S.editCarEntries.forEach(e=>{
if(e.currency!=="RUB"&&!(e.currency in S.bulkRates))S.bulkRates[e.currency]=S.rates[e.currency]||cr[e.currency]||""});
render()}
function cancelCarEdit(){S.editingCarId=null;S.editCarEntries=null;render()}
function saveCarEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car||!S.editCarEntries)return;
if(!String(S.editName||"").trim()){alert("Введите название авто");return}
for(const e of S.editCarEntries){if(!(parseFloat(e.amount)>0)){alert("Проверьте суммы — есть пустые или нулевые");return}
if(e.currency!=="RUB"&&!(parseFloat(e.rate)>0)){alert("Проверьте курсы — есть пустые");return}}
car.entries=S.editCarEntries.map(e=>({...e,amount:parseFloat(e.amount),rate:e.currency==="RUB"?"":String(e.rate)}));
car.name=S.editName.trim();
// пустую/битую дату не трогаем; иначе фиксируем полдень выбранного дня (без сдвига пояса)
if(/^\d{4}-\d{2}-\d{2}$/.test(S.editDate||"")){const d=new Date(S.editDate+"T12:00:00");if(!isNaN(d))car.date=d.toISOString()}
S.editingCarId=null;S.editCarEntries=null;saveWH();cloudUpsert(car);render()}
function updEditEntry(i,field,val){if(!S.editCarEntries)return;S.editCarEntries[i][field]=val;updEditCost()}
function updEditCost(){if(!S.editCarEntries)return;
const car=S.warehouse.find(c=>c.id===S.editingCarId);if(!car)return;
const entries=S.editCarEntries.map(e=>({...e,amount:parseFloat(e.amount)||0}));
const cost=totR(entries,carRates(car));
const el=document.getElementById("edit-cost-val");if(el)el.textContent=fmt(cost)+" ₽";
// разница с исходной
const orig=carCost(car);const diff=cost-orig;
const del=document.getElementById("edit-cost-diff");
if(del){del.textContent=(diff===0?"без изменений":(diff>0?"+":"")+fmt(diff)+" ₽ к исходной");
del.style.color=diff>0?"#e74c3c":diff<0?"#27ae60":"#556"}}
function bulkApply(curr){if(!S.editCarEntries)return;
const v=S.bulkRates[curr];if(!(parseFloat(v)>0)){alert("Введите курс");return}
S.editCarEntries.forEach(e=>{if(e.currency===curr)e.rate=v});render()}

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
const f=ev.target.files[0];if(!f)return;
const reader=new FileReader();
reader.onload=e=>{try{const data=JSON.parse(e.target.result);
const raw=Array.isArray(data)?data:(data.warehouse||[]);
const cars=(Array.isArray(raw)?raw:[]).map(normalizeCar).filter(Boolean);
if(!cars.length){alert("Файл не содержит данных склада");return}
const skipped=(Array.isArray(raw)?raw.length:0)-cars.length;
showConfirm(`Найдено машин: ${cars.length}${skipped?` (пропущено битых: ${skipped})`:""}. Добавить к текущему складу? (дубликаты по ID будут обновлены)`,()=>{
cars.forEach(nc=>{const i=S.warehouse.findIndex(c=>c.id===nc.id);
if(i>=0)S.warehouse[i]=nc;else S.warehouse.push(nc);cloudUpsert(nc)});
saveWH();render()})}catch(err){alert("Ошибка чтения файла")}};
reader.readAsText(f);ev.target.value=""});

// ===== ПОИСК И СОРТИРОВКА =====
function whMatch(car){const q=S.whSearch.trim().toLowerCase();return !q||car.name.toLowerCase().includes(q)}
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
<div class="backup-btn" onclick="exportCSV()">📊 EXCEL</div></div>`;
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
<div style="color:#667;font-size:9px;margin-bottom:6px;letter-spacing:.5px">КУРСЫ ПО ФАКТУ ОПЛАТЫ:</div>`;
if(bulkCurs.length){
h+=`<div style="color:#667;font-size:9px;margin-bottom:6px;letter-spacing:.5px">БЫСТРО ПРИМЕНИТЬ КУРС КО ВСЕМ ПОЗИЦИЯМ:</div>`;
bulkCurs.forEach(c=>{h+=`<div class="bulk-rate-row"><div class="bulk-rate-field">
<label class="edit-lbl">${curInfo(c).symbol} ${esc(c)} / ₽</label>
<input type="number" class="edit-input" value="${esc(S.bulkRates[c])}" oninput="S.bulkRates['${esc(c)}']=this.value"></div>
<div class="bulk-apply" onclick="bulkApply('${esc(c)}')">→ ВСЕМ ${curInfo(c).symbol}</div></div>`});
}
S.editCarEntries.forEach((e,i)=>{const cm=curInfo(e.currency);
h+=`<div class="edit-entry-card"><div class="edit-entry-title">${esc(e.icon)} ${esc(e.label)} (${cm.symbol})</div>
<div class="edit-fields">
<div class="edit-field"><label class="edit-lbl">СУММА ${cm.symbol}</label>
<input type="number" class="edit-input" value="${esc(e.amount)}" oninput="updEditEntry(${i},'amount',this.value)"></div>
${e.currency!=="RUB"?`<div class="edit-field"><label class="edit-lbl">КУРС ₽</label>
<input type="number" class="edit-input" value="${esc(e.rate)}" oninput="updEditEntry(${i},'rate',this.value)"></div>`:""}
</div></div>`});
const editCost=totR(S.editCarEntries.map(e=>({...e,amount:parseFloat(e.amount)||0})),carRates(car));
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
if(car.status==="sold"){const mg=cost>0?(pr/cost)*100:0,ip=pr>=0;
const sCur=curInfo(car.sellCurrency);
h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">💰 Продажа</span>
<span class="wh-detail-val">${fmt(parseFloat(car.sellPrice)||0)} ${sCur.symbol}${car.sellCurrency!=="RUB"?" → "+fmt(sellR)+" ₽":""}</span></div>
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
else{h+=`<div class="btn-action btn-outline" title="Вернуть на склад" onclick="event.stopPropagation();retStock('${esc(car.id)}')">↩️ ВЕРНУТЬ</div>`}
h+=`<div class="btn-action btn-yellow tip-end" style="flex:0 0 auto;padding:10px 14px" data-tip="Сохранить чек" aria-label="Сохранить чек (картинку)" onclick="event.stopPropagation();carReceipt('${esc(car.id)}')">🧾</div>
<div class="btn-action btn-blue tip-end" style="flex:0 0 auto;padding:10px 14px" data-tip="Поделиться чеком" aria-label="Поделиться чеком" onclick="event.stopPropagation();carShare('${esc(car.id)}')">📤</div>
<div class="btn-action btn-red tip-end" style="flex:0 0 auto;padding:10px 14px" data-tip="Удалить машину" aria-label="Удалить машину" onclick="event.stopPropagation();delCar('${esc(car.id)}')">🗑</div></div>`;
if(S.carReceipts[car.id])h+=`<div class="saved-preview"><p>✅ ЧЕК СОХРАНЁН — ЗАЖМИТЕ ДЛЯ КОПИРОВАНИЯ</p><img src="${S.carReceipts[car.id]}" alt="Чек"></div>`;
h+=`</div>`}

if(selling){h+=`<div class="wh-sell-form" onclick="event.stopPropagation()">
<div style="color:#888;font-size:11px;font-weight:600;margin-bottom:8px">ОФОРМИТЬ ПРОДАЖУ</div>
<input type="number" class="wh-sell-input" placeholder="Цена продажи" value="${esc(S.sellFormPrice)}" oninput="S.sellFormPrice=this.value">
<div class="profit-curr-row">
${[...new Set(["RUB",...S.activeCur,S.sellFormCurr])].map(c=>`<div class="pcb ${S.sellFormCurr===c?"a-"+curInfo(c).cls:""}"
onclick="S.sellFormCurr='${esc(c)}';S.sellFormRate=S.rates['${esc(c)}']||'';render()">${curInfo(c).symbol} ${esc(c)}</div>`).join("")}</div>
${S.sellFormCurr!=="RUB"?`<label class="sell-rate-lbl">КУРС НА ДАТУ ПРОДАЖИ ${curInfo(S.sellFormCurr).symbol}/₽</label>
<input type="number" class="wh-sell-input" value="${esc(S.sellFormRate)}" oninput="S.sellFormRate=this.value">`:""}
<div style="display:flex;gap:8px;margin-top:4px">
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="doSell('${esc(car.id)}')">✅ ПРОДАТЬ</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 16px" onclick="cancelSell()">✕</div></div></div>`}
h+=`</div>`;
return h}
