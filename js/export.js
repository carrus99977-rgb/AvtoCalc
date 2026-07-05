// ===== ЭКСПОРТ В EXCEL (CSV) =====
// Разделитель «;», UTF-8 с BOM, десятичная запятая — Excel-ru открывает сразу.
function csvEsc(v){v=String(v==null?"":v);
// защита от CSV-инъекции формул в Excel (=,@,+,-,таб): префикс-апостроф,
// но не трогаем легитимные отрицательные числа из csvNum ("-123,45")
if(/^[=@\t\r]/.test(v)||(/^[+-]/.test(v)&&!/^-?\d+(,\d+)?$/.test(v)))v="'"+v;
return /[";\n\r]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}
function csvNum(n){return String(Math.round(n*100)/100).replace(".",",")}

function exportCSV(){
if(!S.warehouse.length){alert("Склад пуст — нечего экспортировать");return}
const rows=[];
rows.push(["СВОДКА ПО МАШИНАМ"]);
rows.push(["Название","Дата добавления","Статус","Себестоимость ₽","Дата продажи","Цена продажи ₽","Прибыль ₽","Наценка %","Маржа %","Дней на складе"]);
S.warehouse.forEach(car=>{
const cost=carCost(car),sold=car.status==="sold";
const sellR=sold?carSellRub(car):0,pr=sellR-cost;
rows.push([car.name,dShort(car.date),sold?"Продано":"Склад",csvNum(cost),
sold&&car.sellDate?dShort(car.sellDate):"",
sold?csvNum(sellR):"",sold?csvNum(pr):"",
sold&&cost>0?csvNum(pr/cost*100):"",sold&&sellR>0?csvNum(pr/sellR*100):"",
sold?(car.sellDate?String(daysBetween(car.date,car.sellDate)):""):String(daysBetween(car.date,new Date()))])});
rows.push([]);
rows.push(["ДЕТАЛИЗАЦИЯ РАСХОДОВ"]);
rows.push(["Машина","Статус","Категория","Валюта","Сумма","Курс ₽","Сумма ₽"]);
S.warehouse.forEach(car=>{
const cr=carRates(car),st=car.status==="sold"?"Продано":car.status==="estimate"?"Прикидка":"Склад";
car.entries.forEach(e=>{const r=entryRate(e,cr);
rows.push([car.name,st,e.label,e.currency,csvNum(e.amount),
e.currency==="RUB"?"":(r?csvNum(r):"⚠ нет курса"),
(e.currency==="RUB"||r)?csvNum(entryRub(e,cr)):"⚠ нет курса"])})});
const csv="\uFEFF"+rows.map(r=>r.map(csvEsc).join(";")).join("\r\n");
const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
const a=document.createElement("a");a.href=URL.createObjectURL(blob);
a.download="АвтоСклад_"+new Date().toLocaleDateString("ru-RU").replace(/\./g,"-")+".csv";
document.body.appendChild(a);a.click();document.body.removeChild(a);
// CSV — отчёт, не восстановимый бэкап: НЕ глушим напоминание о сохранении базы
setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

// ===== СПИСОК МАШИН ДЛЯ КЛИЕНТОВ (конструктор цен) =====
// Перед отправкой — панель: накинуть наценку в % и/или суммой на себестоимость сразу всем,
// поправить цену каждой машине отдельно, часть оставить «по запросу». Себестоимость и
// прибыль в текст не попадают никогда — только название и цена для клиента.
function openListBuilder(){
const stk=sortStock(S.warehouse.filter(c=>c.status==="stock")); // тот же порядок, что на экране
if(!stk.length){alert("На складе нет машин");return}
S.listBuilder={pct:"",add:"",save:true,
items:stk.map(c=>{const ap=parseNum(c.askPrice);
// off — машина скрыта из списка этой отправки (галочка снята); каждая новая отправка начинается со всеми
return{id:c.id,name:c.name,cost:carCost(c),price:ap>0?String(ap):"",onRequest:!(ap>0),off:false}})};
render();
setTimeout(()=>document.getElementById("list-builder")?.scrollIntoView({behavior:"smooth",block:"start"}),100)}
function closeListBuilder(){S.listBuilder=null;render()}
// лояльный разбор полей наценки: терпит «15%», «+200 000», «200000₽» — лишние символы отбрасываем
// (строгий parseNum такие значения честно бракует, но здесь пользователь вводит «как привык»)
function lbNum(v){return parseNum(String(v==null?"":v).replace(/[^\d.,\-]/g,""))}
// наценка ко всем машинам с ценой: себестоимость × (1+%) + добавка, округление до 10 тыс ₽.
// достаточно ЛЮБОГО одного поля: только %, только ₽ сверху — или оба сразу
function lbApply(){const lb=S.listBuilder;if(!lb)return;
const p=lbNum(lb.pct),a=lbNum(lb.add);
const hasP=isFinite(p)&&p>-100,hasA=isFinite(a)&&a>0;
if(!hasP&&!hasA){alert("Введите наценку: % (например 15) или сумму сверху в ₽ (например 200000) — достаточно одного из двух");return}
lb.items.forEach(it=>{if(it.off||it.onRequest)return;
const v=it.cost*(1+(hasP?p:0)/100)+(hasA?a:0);
it.price=String(Math.max(0,Math.round(v/10000)*10000))});
render()}
function lbToggle(i){const it=S.listBuilder&&S.listBuilder.items[i];if(!it)return;
it.onRequest=!it.onRequest;render()}
function lbInclude(i,on){const it=S.listBuilder&&S.listBuilder.items[i];if(!it)return;
it.off=!on;render()}
function lbPrice(i,v){const it=S.listBuilder&&S.listBuilder.items[i];if(it)it.price=v}
function lbSend(){const lb=S.listBuilder;if(!lb)return;
const inc=lb.items.filter(it=>!it.off); // в список идут только отмеченные галочкой
if(!inc.length){alert("Отметьте хотя бы одну машину для списка");return}
let t="🚗 МАШИНЫ В НАЛИЧИИ ("+new Date().toLocaleDateString("ru-RU")+"):\n";
for(const it of inc){
const p=parseNum(it.price);
if(!it.onRequest&&!(p>0)){alert("У «"+it.name+"» нет цены — введите или поставьте ПО ЗАПРОСУ");return}
t+="• "+it.name+(it.onRequest?" — цена по запросу":" — "+fmt(p)+" ₽")+"\n"}
t=t.trim();
if(lb.save){ // запомнить цены в карточках: «цена для клиента» и чек 👤 покажут те же цифры.
// скрытые машины не трогаем — их цена в карточке остаётся как была
inc.forEach(it=>{const car=S.warehouse.find(c=>c.id===it.id);if(!car)return;
const p=parseNum(it.price);const np=it.onRequest?"":(p>0?String(p):"");
if((car.askPrice||"")!==np){car.askPrice=np;touch(car);cloudUpsert(car)}});
saveWH()}
S.listBuilder=null;render();
if(navigator.share){
navigator.share({text:t}).catch(err=>{if(!err||err.name!=="AbortError")copyStockList(t)});
return}
copyStockList(t)}
function listBuilderHTML(){
const lb=S.listBuilder;if(!lb)return"";
let h=`<div class="coll-box" id="list-builder"><div class="coll-header" style="cursor:default"><span>📤 Список клиентам — цены</span></div>
<div class="coll-body">
<div style="color:#778;font-size:10px;line-height:1.5;margin-bottom:8px">Галочка — машина попадёт в список (сними, чтобы скрыть). Накинь наценку на себестоимость сразу всем — или поправь цену каждой машине. «ПО ЗАПРОСУ» — без цены. Округление до 10 тыс ₽.</div>
<div class="bulk-rate-row">
<div class="bulk-rate-field"><label class="edit-lbl">НАЦЕНКА %</label>
<input type="text" inputmode="decimal" maxlength="8" class="edit-input" placeholder="15" value="${esc(lb.pct)}" oninput="S.listBuilder.pct=this.value"></div>
<div class="bulk-rate-field"><label class="edit-lbl">+ ₽ СВЕРХУ</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" placeholder="0" value="${esc(lb.add)}" oninput="S.listBuilder.add=this.value"></div>
<div class="bulk-apply" onclick="lbApply()">→ ВСЕМ</div></div>`;
lb.items.forEach((it,i)=>{h+=`<div class="edit-entry-card" style="${it.off?"opacity:.45":""}">
<div class="edit-entry-title" style="display:flex;justify-content:space-between;gap:8px;align-items:center">
<label style="display:flex;align-items:center;gap:8px;cursor:pointer;flex:1;min-width:0">
<input type="checkbox" ${it.off?"":"checked"} onchange="lbInclude(${i},this.checked)"><span>🚗 ${esc(it.name)}</span></label>
<span style="color:#667;flex:0 0 auto">себе: ${fmt(it.cost)} ₽</span></div>
${it.off?`<div style="color:#778;font-size:10px;padding:4px 0 0 26px">скрыта — в список не попадёт, цена в карточке не изменится</div>`
:`<div class="edit-fields" style="align-items:flex-end">
${it.onRequest?`<div class="edit-field" style="color:#778;font-size:11px;padding:10px 0">цена по запросу</div>`
:`<div class="edit-field"><label class="edit-lbl">ЦЕНА КЛИЕНТУ ₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" placeholder="0" value="${esc(it.price)}" oninput="lbPrice(${i},this.value)"></div>`}
<div class="pcb ${it.onRequest?"a-rub":""}" style="flex:0 0 auto" onclick="lbToggle(${i})">ПО ЗАПРОСУ</div>
</div>`}</div>`});
h+=`<label style="display:flex;align-items:center;gap:8px;color:#778;font-size:10px;margin:8px 0;cursor:pointer">
<input type="checkbox" ${lb.save?"checked":""} onchange="S.listBuilder.save=this.checked"> Запомнить цены в карточках (чек клиенту покажет те же)</label>
<div style="display:flex;gap:8px">
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="lbSend()">📤 ОТПРАВИТЬ (${lb.items.filter(it=>!it.off).length} из ${lb.items.length})</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 16px" onclick="closeListBuilder()">✕</div></div>
</div></div>`;
return h}
function copyStockList(t){
const done=()=>showToast("Список скопирован — вставьте в чат");
try{navigator.clipboard.writeText(t).then(done,()=>fallbackCopy(t,done))}
catch(e){fallbackCopy(t,done)}}
function fallbackCopy(t,done){
const ta=document.createElement("textarea");ta.value=t;
document.body.appendChild(ta);ta.select();
try{if(!document.execCommand("copy"))throw 0;done()}catch(e){alert(t)}
document.body.removeChild(ta)}
