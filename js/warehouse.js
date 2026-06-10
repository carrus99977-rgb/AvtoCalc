// ===== WAREHOUSE =====
function addToWH(){if(!S.carName.trim()){alert("Введите название авто");return}
if(S.entries.length===0){alert("Добавьте хотя бы одну позицию");return}
S.warehouse.unshift({id:uid(),name:S.carName.trim(),date:new Date().toISOString(),
eurRate:S.eurRate,usdRate:S.usdRate,entries:JSON.parse(JSON.stringify(S.entries)),
status:"stock",sellPrice:"",sellCurrency:"RUB",sellDate:null,sellEurRate:"",sellUsdRate:""});
saveWH();cloudUpsert(S.warehouse[0]);
S.carName="";S.entries=[];S.display="0";S.curCat=0;S.showReceipt=false;S.receiptImage=null;S.sellPrice="";
S.expandedCar=S.warehouse[0].id;saveDraft();render();
setTimeout(()=>document.getElementById("wh-section")?.scrollIntoView({behavior:"smooth"}),150)}

function startSell(id){S.sellingCarId=id;S.editingCarId=null;S.sellFormPrice="";S.sellFormCurr="RUB";
S.sellFormEur=S.eurRate;S.sellFormUsd=S.usdRate;render()}
function cancelSell(){S.sellingCarId=null;render()}
function doSell(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
if(!parseFloat(S.sellFormPrice)){alert("Введите цену продажи");return}
car.sellPrice=S.sellFormPrice;car.sellCurrency=S.sellFormCurr;
car.sellEurRate=S.sellFormEur||S.eurRate;car.sellUsdRate=S.sellFormUsd||S.usdRate;
car.status="sold";car.sellDate=new Date().toISOString();
S.sellingCarId=null;saveWH();cloudUpsert(car);render()}
function delCar(id){showConfirm("Удалить машину из базы?",()=>{S.warehouse=S.warehouse.filter(c=>c.id!==id);cloudDelete(id);
if(S.expandedCar===id)S.expandedCar=null;delete S.carReceipts[id];saveWH();render()})}
function retStock(id){showConfirm("Вернуть машину на склад? Данные продажи будут стёрты.",()=>{
const car=S.warehouse.find(c=>c.id===id);if(!car)return;
car.status="stock";car.sellPrice="";car.sellCurrency="RUB";car.sellDate=null;car.sellEurRate="";car.sellUsdRate="";
saveWH();cloudUpsert(car);render()})}
function togExp(id){S.expandedCar=S.expandedCar===id?null:id;S.sellingCarId=null;
if(S.editingCarId!==id)S.editingCarId=null;render()}
function cpToCalc(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.carName=car.name;S.eurRate=car.eurRate;S.usdRate=car.usdRate;
S.entries=JSON.parse(JSON.stringify(car.entries));S.display="0";S.curCat=0;S.showReceipt=false;S.sellPrice="";
saveDraft();render();window.scrollTo({top:0,behavior:"smooth"})}

// ===== CAR EDIT MODE (per-entry rates and amounts) =====
function startCarEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.editingCarId=id;S.sellingCarId=null;S.expandedCar=id;
S.editCarEntries=car.entries.map(e=>({...e,
rate:e.rate||(e.currency==="EUR"?car.eurRate:e.currency==="USD"?car.usdRate:"")}));
S.bulkEur=S.eurRate;S.bulkUsd=S.usdRate;render()}
function cancelCarEdit(){S.editingCarId=null;S.editCarEntries=null;render()}
function saveCarEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car||!S.editCarEntries)return;
for(const e of S.editCarEntries){if(!(parseFloat(e.amount)>0)){alert("Проверьте суммы — есть пустые или нулевые");return}
if(e.currency!=="RUB"&&!(parseFloat(e.rate)>0)){alert("Проверьте курсы — есть пустые");return}}
car.entries=S.editCarEntries.map(e=>({...e,amount:parseFloat(e.amount),rate:e.currency==="RUB"?"":String(e.rate)}));
S.editingCarId=null;S.editCarEntries=null;saveWH();cloudUpsert(car);render()}
function updEditEntry(i,field,val){if(!S.editCarEntries)return;S.editCarEntries[i][field]=val;updEditCost()}
function updEditCost(){if(!S.editCarEntries)return;
const car=S.warehouse.find(c=>c.id===S.editingCarId);if(!car)return;
const entries=S.editCarEntries.map(e=>({...e,amount:parseFloat(e.amount)||0}));
const cost=totR(entries,car.eurRate,car.usdRate);
const el=document.getElementById("edit-cost-val");if(el)el.textContent=fmt(cost)+" ₽";
// разница с исходной
const orig=carCost(car);const diff=cost-orig;
const del=document.getElementById("edit-cost-diff");
if(del){del.textContent=(diff===0?"без изменений":(diff>0?"+":"")+fmt(diff)+" ₽ к исходной");
del.style.color=diff>0?"#e74c3c":diff<0?"#27ae60":"#556"}}
function bulkApply(curr){if(!S.editCarEntries)return;
const v=curr==="EUR"?S.bulkEur:S.bulkUsd;if(!(parseFloat(v)>0)){alert("Введите курс");return}
S.editCarEntries.forEach(e=>{if(e.currency===curr)e.rate=v});render()}

// ===== BACKUP =====
function exportData(){
const data={version:2,exported:new Date().toISOString(),warehouse:S.warehouse};
const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
const a=document.createElement("a");a.href=URL.createObjectURL(blob);
a.download="АвтоСклад_бэкап_"+new Date().toLocaleDateString("ru-RU").replace(/\./g,"-")+".json";
document.body.appendChild(a);a.click();document.body.removeChild(a);
setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function importData(){document.getElementById("import-file").click()}
document.getElementById("import-file").addEventListener("change",function(ev){
const f=ev.target.files[0];if(!f)return;
const reader=new FileReader();
reader.onload=e=>{try{const data=JSON.parse(e.target.result);
const cars=Array.isArray(data)?data:(data.warehouse||[]);
if(!Array.isArray(cars)||!cars.length){alert("Файл не содержит данных склада");return}
showConfirm(`Найдено машин: ${cars.length}. Добавить к текущему складу? (дубликаты по ID будут обновлены)`,()=>{
cars.forEach(nc=>{const i=S.warehouse.findIndex(c=>c.id===nc.id);
if(i>=0)S.warehouse[i]=nc;else S.warehouse.push(nc);cloudUpsert(nc)});
saveWH();render()})}catch(err){alert("Ошибка чтения файла")}};
reader.readAsText(f);ev.target.value=""});

function whHTML(){
const stk=S.warehouse.filter(c=>c.status==="stock");
let h=`<div class="section-divider" id="wh-section"><span>🏭 Склад (${stk.length})</span></div>
${cloudBoxHTML()}<div class="backup-row">
<div class="backup-btn" onclick="exportData()">💾 ЭКСПОРТ БАЗЫ</div>
<div class="backup-btn" onclick="importData()">📥 ИМПОРТ БАЗЫ</div></div>`;
if(!stk.length)h+=`<div class="empty-state"><div class="em-icon">🏭</div><div class="em-text">Склад пуст<br><span style="color:#444;font-size:11px">Добавьте машину через калькулятор</span></div></div>`;
stk.forEach(car=>h+=carCardHTML(car));
return h}

function soldHTML(){
const sld=S.warehouse.filter(c=>c.status==="sold");
const tp=sld.reduce((s,c)=>s+carProfit(c),0);
let h=`<div class="section-divider sold" id="sold-section"><span>💰 Проданные (${sld.length})</span></div>`;
if(sld.length)h+=`<div class="stats-bar">
<div class="stat-card"><div class="stat-num green">${sld.length}</div><div class="stat-lbl">МАШИН</div></div>
<div class="stat-card"><div class="stat-num ${tp>=0?"green":"red"}">${tp>=0?"+":""}${fmt(tp)}</div><div class="stat-lbl">ПРИБЫЛЬ ₽</div></div></div>`;
if(!sld.length)h+=`<div class="empty-state"><div class="em-icon">📊</div><div class="em-text">Нет проданных машин</div></div>`;
sld.forEach(car=>h+=carCardHTML(car));
return h}

function carCardHTML(car){
const cost=carCost(car),exp=S.expandedCar===car.id,selling=S.sellingCarId===car.id,editing=S.editingCarId===car.id;
const sellR=carSellRub(car),pr=sellR-cost;
let h=`<div class="wh-card"><div class="wh-card-header" onclick="togExp('${car.id}')">
<div><div class="wh-car-name">🚗 ${esc(car.name)}<span class="wh-status ${car.status}">${car.status==="stock"?"СКЛАД":"ПРОДАНО"}</span></div>
<div style="color:#556;font-size:10px;margin-top:2px">${dShort(car.date)}${car.status==="stock"?` · ${daysBetween(car.date,new Date())} дн. на складе`:""}</div></div>
<div style="text-align:right"><div class="wh-car-cost">${fmt(cost)} ₽</div>
${car.status==="sold"?`<div style="color:${pr>=0?"#27ae60":"#e74c3c"};font-size:11px;font-weight:600">${pr>=0?"+":""}${fmt(pr)} ₽</div>`:""}</div></div>`;

if(exp&&editing&&S.editCarEntries){
// ===== РЕЖИМ РЕДАКТИРОВАНИЯ КУРСОВ И СУММ =====
const hasEur=S.editCarEntries.some(e=>e.currency==="EUR");
const hasUsd=S.editCarEntries.some(e=>e.currency==="USD");
h+=`<div class="wh-detail" onclick="event.stopPropagation()">
<div style="color:var(--gold);font-size:11px;font-weight:700;margin-bottom:10px;letter-spacing:1px">✏️ РЕДАКТИРОВАНИЕ — КУРСЫ ПО ФАКТУ ОПЛАТЫ</div>`;
if(hasEur||hasUsd){
h+=`<div style="color:#667;font-size:9px;margin-bottom:6px;letter-spacing:.5px">БЫСТРО ПРИМЕНИТЬ КУРС КО ВСЕМ ПОЗИЦИЯМ:</div>`;
if(hasEur)h+=`<div class="bulk-rate-row"><div class="bulk-rate-field">
<label class="edit-lbl">€ EUR / ₽</label>
<input type="number" class="edit-input" value="${S.bulkEur}" oninput="S.bulkEur=this.value"></div>
<div class="bulk-apply" onclick="bulkApply('EUR')">→ ВСЕМ €</div></div>`;
if(hasUsd)h+=`<div class="bulk-rate-row"><div class="bulk-rate-field">
<label class="edit-lbl">$ USD / ₽</label>
<input type="number" class="edit-input" value="${S.bulkUsd}" oninput="S.bulkUsd=this.value"></div>
<div class="bulk-apply" onclick="bulkApply('USD')">→ ВСЕМ $</div></div>`;
}
S.editCarEntries.forEach((e,i)=>{const cm=CUR[e.currency];
h+=`<div class="edit-entry-card"><div class="edit-entry-title">${e.icon} ${e.label} (${cm.symbol})</div>
<div class="edit-fields">
<div class="edit-field"><label class="edit-lbl">СУММА ${cm.symbol}</label>
<input type="number" class="edit-input" value="${e.amount}" oninput="updEditEntry(${i},'amount',this.value)"></div>
${e.currency!=="RUB"?`<div class="edit-field"><label class="edit-lbl">КУРС ₽</label>
<input type="number" class="edit-input" value="${e.rate}" oninput="updEditEntry(${i},'rate',this.value)"></div>`:""}
</div></div>`});
h+=`<div class="edit-cost-preview"><span class="ecp-lbl">СЕБЕСТОИМОСТЬ</span>
<div style="text-align:right"><div class="ecp-val" id="edit-cost-val">${fmt(cost)} ₽</div>
<div id="edit-cost-diff" style="font-size:9px;color:#556">без изменений</div></div></div>
<div style="display:flex;gap:8px">
<div class="btn-action btn-green" style="flex:1;margin:0;font-size:11px;padding:11px 0" onclick="saveCarEdit('${car.id}')">✅ СОХРАНИТЬ</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:11px 16px;font-size:11px" onclick="cancelCarEdit()">✕ ОТМЕНА</div></div></div>`;
}else if(exp){
// ===== ОБЫЧНЫЙ ПРОСМОТР =====
h+=`<div class="wh-detail">
<div style="color:#556;font-size:10px;font-weight:600;margin-bottom:8px;letter-spacing:1px">РАЗБИВКА РАСХОДОВ (курс на дату оплаты)</div>`;
car.entries.forEach(e=>{const cm=CUR[e.currency];const r=entryRate(e,car.eurRate,car.usdRate);
const rv=entryRub(e,car.eurRate,car.usdRate);
h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">${e.icon} ${e.label}</span>
<span class="wh-detail-val">${fmt(e.amount)} ${cm.symbol}${e.currency!=="RUB"?" × "+fmtD(r,2)+" = "+fmt(rv)+" ₽":""}</span></div>`});
h+=`<div class="wh-detail-row" style="border-top:2px solid var(--br2);padding-top:8px;margin-top:4px">
<span style="color:var(--gold);font-size:12px;font-weight:700">СЕБЕСТОИМОСТЬ</span>
<span style="color:var(--gold);font-size:14px;font-weight:700;font-family:'Oswald',sans-serif">${fmt(cost)} ₽</span></div>`;
if(car.status==="sold"){const mg=cost>0?(pr/cost)*100:0,ip=pr>=0;
const sCur=CUR[car.sellCurrency]||CUR.RUB;
h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">💰 Продажа</span>
<span class="wh-detail-val">${fmt(parseFloat(car.sellPrice)||0)} ${sCur.symbol}${car.sellCurrency!=="RUB"?" → "+fmt(sellR)+" ₽":""}</span></div>
${car.sellCurrency!=="RUB"?`<div class="wh-detail-row"><span class="wh-detail-lbl">📈 Курс продажи</span>
<span class="wh-detail-val">${car.sellCurrency==="EUR"?(car.sellEurRate||car.eurRate)+" ₽/€":(car.sellUsdRate||car.usdRate)+" ₽/$"}</span></div>`:""}
<div class="wh-detail-row"><span class="wh-detail-lbl">📊 Прибыль</span>
<span class="wh-detail-val" style="color:${ip?"#27ae60":"#e74c3c"}">${ip?"+":""}${fmt(pr)} ₽ (${ip?"+":""}${fmtD(mg,1)}%)</span></div>
${car.sellDate?`<div class="wh-detail-row"><span class="wh-detail-lbl">📅 Продана</span>
<span class="wh-detail-val">${dShort(car.sellDate)} · стояла ${daysBetween(car.date,car.sellDate)} дн.</span></div>`:""}`}
h+=`<div class="wh-actions">`;
if(car.status==="stock"){h+=`<div class="btn-action btn-green" onclick="event.stopPropagation();startSell('${car.id}')">💰 ПРОДАТЬ</div>`}
h+=`<div class="btn-action btn-blue" onclick="event.stopPropagation();startCarEdit('${car.id}')">✏️ КУРСЫ</div>`;
if(car.status==="stock"){h+=`<div class="btn-action btn-outline" style="flex:0 0 auto;padding:10px 14px" onclick="event.stopPropagation();cpToCalc('${car.id}')">📋</div>`}
else{h+=`<div class="btn-action btn-outline" onclick="event.stopPropagation();retStock('${car.id}')">↩️ ВЕРНУТЬ</div>`}
h+=`<div class="btn-action btn-yellow" style="flex:0 0 auto;padding:10px 14px" onclick="event.stopPropagation();carReceipt('${car.id}')">🧾</div>
<div class="btn-action btn-red" style="flex:0 0 auto;padding:10px 14px" onclick="event.stopPropagation();delCar('${car.id}')">🗑</div></div>`;
if(S.carReceipts[car.id])h+=`<div class="saved-preview"><p>✅ ЧЕК СОХРАНЁН — ЗАЖМИТЕ ДЛЯ КОПИРОВАНИЯ</p><img src="${S.carReceipts[car.id]}" alt="Чек"></div>`;
h+=`</div>`}

if(selling){h+=`<div class="wh-sell-form" onclick="event.stopPropagation()">
<div style="color:#888;font-size:11px;font-weight:600;margin-bottom:8px">ОФОРМИТЬ ПРОДАЖУ</div>
<input type="number" class="wh-sell-input" placeholder="Цена продажи" value="${S.sellFormPrice}" oninput="S.sellFormPrice=this.value">
<div class="profit-curr-row">
${["RUB","EUR","USD"].map(c=>`<div class="pcb ${S.sellFormCurr===c?"a-"+c.toLowerCase():""}"
onclick="S.sellFormCurr='${c}';render()">${CUR[c].symbol} ${c}</div>`).join("")}</div>
${S.sellFormCurr!=="RUB"?`<label class="sell-rate-lbl">КУРС НА ДАТУ ПРОДАЖИ ${S.sellFormCurr==="EUR"?"€":"$"}/₽</label>
<input type="number" class="wh-sell-input" value="${S.sellFormCurr==="EUR"?S.sellFormEur:S.sellFormUsd}"
oninput="${S.sellFormCurr==="EUR"?"S.sellFormEur":"S.sellFormUsd"}=this.value">`:""}
<div style="display:flex;gap:8px;margin-top:4px">
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="doSell('${car.id}')">✅ ПРОДАТЬ</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 16px" onclick="cancelSell()">✕</div></div></div>`}
h+=`</div>`;
return h}
