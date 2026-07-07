// ===== CALC =====
function digit(d){vibrate(8);if(S.display==="0"&&d!==".")S.display=d;else if(d==="."&&S.display.includes("."))return;else S.display+=d;rDisp()}
function clr(){vibrate(8);S.display="0";rDisp()}
function bsp(){vibrate(8);S.display=S.display.length<=1?"0":S.display.slice(0,-1);rDisp()}
function tri(n){vibrate(8);if(S.display!=="0"){S.display+=n;rDisp()}}
function curClick(cid){vibrate(14);const a=parseNum(S.display)||0;if(a<=0)return;
// без курса позицию не добавляем — иначе она молча станет 0 ₽ (актуально после «✕ очистить»)
if(cid!=="RUB"&&!(parseNum(S.rates[cid])>0)){alert("Введите курс "+cid+"/₽ — он зафиксируется за позицией");return}
const cat=CATS[S.curCat];
// фиксируем курс на момент добавления позиции (каноничный, с точкой)
const rate=cid==="RUB"?"":numStr(S.rates[cid]);
S.entries.push({category:cat.id,label:cat.label,icon:cat.icon,amount:a,currency:cid,rate:rate});
S.display="0";if(S.curCat<CATS.length-1)S.curCat++;
S.showReceipt=false;S.receiptImage=null;saveDraft();render()}
function delEntry(i){const removed=S.entries[i];S.entries.splice(i,1);
S.showReceipt=false;S.receiptImage=null;S.editingEntry=null;saveDraft();render();
showToast("Позиция удалена","Отменить",()=>{
S.entries.splice(Math.min(i,S.entries.length),0,removed);S.editingEntry=null;saveDraft();render()})}
function startEdit(i){const e=S.entries[i];S.editingEntry=i;S.editValue=String(e.amount);S.editCurr=e.currency;
S.editRate=e.rate||(e.currency==="RUB"?"":S.rates[e.currency]||"");render()}
function cancelEdit(){S.editingEntry=null;render()}
function saveEdit(i){const v=parseNum(S.editValue)||0;if(v<=0){alert("Введите сумму");return}
// не-RUB без курса не сохраняем — иначе позиция молча станет 0 ₽ (как и при добавлении через curClick)
if(S.editCurr!=="RUB"&&!(parseNum(S.editRate||S.rates[S.editCurr])>0)){alert("Введите курс "+S.editCurr+"/₽ — иначе позиция будет 0 ₽");return}
S.entries[i].amount=v;S.entries[i].currency=S.editCurr;
S.entries[i].rate=S.editCurr==="RUB"?"":numStr(S.editRate||S.rates[S.editCurr]||"");
S.editingEntry=null;S.showReceipt=false;S.receiptImage=null;saveDraft();render()}
function printR(){S.showReceipt=true;S.receiptImage=null;render();
setTimeout(()=>document.getElementById("receipt-section")?.scrollIntoView({behavior:"smooth"}),100)}
function rDisp(){const el=document.getElementById("calc-display");if(!el)return render();
const l=S.display.length;el.style.fontSize=(l>12?24:l>8?30:36)+"px";el.textContent=fmt(parseNum(S.display||"0")||0)}
function rProfit(){const t=totR(S.entries,S.rates);
const el=document.getElementById("pr-results");if(el)el.innerHTML=prHTML(pCalc(t))}
// живое обновление открытого HTML-чека (меняешь цену/наценку — чек пересчитывается сразу)
function rReceipt(){const el=document.getElementById("receipt-section");
if(el&&S.showReceipt&&S.entries.length)el.outerHTML=receiptHTML()}
// Эффективная цена продажи: введённая вручную главнее; если поле пусто, но задана целевая
// наценка % — расчётная цена от себестоимости (byMarkup). Ввёл % — прибыль и чек
// пересчитываются СРАЗУ, без кнопки «→ В ПРОДАЖУ»; убрал % — вернулись к «—».
// Кнопка «→ В ПРОДАЖУ» по-прежнему фиксирует расчётную цену в поле (для сохранения в продажу).
function pCalc(cost){
const rawSell=parseRub(S.sellPrice)||0; // целые единицы цены («500,000»=500000, не 500)
// цена введена в валюте, но курса этой валюты нет → toR даст 0 и цена молча потеряется. Флажок для UI.
const noRate=rawSell>0&&S.sellCurrency!=="RUB"&&!(parseNum(S.rates[S.sellCurrency])>0);
let sell=toR(rawSell,S.sellCurrency,S.rates),byMarkup=false;
if(!(sell>0)){const p=tgtPct();if(p!=null&&cost>0){sell=cost*(1+p/100);byMarkup=true}}
const pr=sell-cost;
return{cost,sell,profit:pr,markup:cost>0?(pr/cost)*100:0,margin:sell>0?(pr/sell)*100:0,byMarkup,noRate}}

// ===== ОБРАТНЫЙ КАЛЬКУЛЯТОР: цена продажи под целевую наценку =====
function tgtPct(){const p=parseNum(S.targetMarkup);return isFinite(p)&&p>-100?p:null}
function targetPrice(cost){const p=tgtPct();
return(p==null||!(cost>0))?null:cost*(1+p/100)}
function targetHTML(cost){
if(tgtPct()==null)return `<span style="color:var(--t5)">введи %</span>`;
if(!(cost>0))return `<span style="color:var(--t5)">нет себестоимости</span>`;
const v=targetPrice(cost);
let s=fmt(v)+" ₽";
if(S.sellCurrency!=="RUB"){const r=parseNum(S.rates[S.sellCurrency]);
if(r>0)s+=` ≈ ${fmt(v/r)} ${curInfo(S.sellCurrency).symbol}`}
return s}
function rTarget(){const el=document.getElementById("tgt-out");
if(el)el.innerHTML=targetHTML(totR(S.entries,S.rates))}
function applyTarget(){
if(tgtPct()==null){alert("Введите целевую наценку в %");return}
const cost=totR(S.entries,S.rates);
if(!(cost>0)){alert("Себестоимость 0 ₽ — проверьте курсы позиций");return}
const v=targetPrice(cost);
let price=v;
if(S.sellCurrency!=="RUB"){const r=parseNum(S.rates[S.sellCurrency]);
if(!(r>0)){alert("Нет курса "+S.sellCurrency+" — введите курс или выберите ₽");return}
price=v/r}
S.sellPrice=String(Math.round(price));saveDraft();render()}

// Очистить значения курсов активных валют и дату ЦБ (позиции не трогаем — у них курс зафиксирован)
function clearRates(){S.activeCur.forEach(c=>S.rates[c]="");
S.cbrDate="";S.cbrInfo="";saveDraft();render()}

// выбор цвета кузова/салона в калькуляторе (свотч или палитра); "" — сброс. После выбора пикер сворачиваем.
function setCalcColor(field,hex){S.carInfo[field]=normColor(hex);S.colorOpen=null;saveDraft();render()}

// Полная очистка расчёта одной кнопкой: прикидка «на посмотреть» не идёт на склад,
// и без этого её приходилось вычищать вручную по позиции. Курсы НЕ трогаем (они про
// текущий день, не про машину; для них свой ✕). С подтверждением и отменой, как delCar.
function clearCalc(){
const snap={carName:S.carName,entries:S.entries,display:S.display,curCat:S.curCat,
sellPrice:S.sellPrice,targetMarkup:S.targetMarkup,sellCurrency:S.sellCurrency,carInfo:{...S.carInfo}};
showConfirm("Очистить расчёт? Название, данные авто, позиции и цена продажи будут стёрты (курсы останутся).",()=>{
S.carName="";S.entries=[];S.display="0";S.curCat=0;
S.sellPrice="";S.targetMarkup="";S.sellCurrency="RUB";S.carInfo=normCarInfo(null);
S.showReceipt=false;S.receiptImage=null;S.editingEntry=null;
saveDraft();render();
showToast("Расчёт очищен","Отменить",()=>{
S.carName=snap.carName;S.entries=snap.entries;S.display=snap.display;S.curCat=snap.curCat;
S.sellPrice=snap.sellPrice;S.targetMarkup=snap.targetMarkup;S.sellCurrency=snap.sellCurrency;
S.carInfo=snap.carInfo;
saveDraft();render()})})}

// Включение/выключение валюты в настройках

function togCur(c){const i=S.activeCur.indexOf(c);
if(i>=0){if(S.activeCur.length<=1){alert("Оставьте хотя бы одну валюту");return}
S.activeCur.splice(i,1);if(S.sellCurrency===c)S.sellCurrency="RUB"}
else{S.activeCur.push(c);S.activeCur=Object.keys(CUR).filter(k=>S.activeCur.includes(k))}
saveDraft();render()}

function prHTML(pd){const hs=pd.sell>0,ip=pd.profit>=0,c=!hs?"ntl":ip?"pos":"neg",
bw=!hs?0:Math.min(Math.abs(pd.markup),100),bc=!hs?"#333":ip?"var(--pos)":"var(--neg)";
const mk=pd.cost>0?marketRates():null; // справочный эквивалент по рыночному курсу банка
return`${pd.noRate?`<div style="color:var(--warn);font-size:10px;text-align:right;margin-bottom:4px">⚠ Нет курса ${esc(S.sellCurrency)} — цена продажи не учтена. Задайте курс в «Текущие курсы валют».</div>`:""}
<div class="pr-row"><span class="pr-lbl">Себестоимость</span><span class="pr-val ntl">${fmt(pd.cost)} ₽</span></div>
${mk?`<div style="text-align:right;color:var(--t4);font-size:9px;margin-top:-4px">≈ ${fmt(pd.cost/mk.usd)} $${mk.eur?` · ${fmt(pd.cost/mk.eur)} €`:""} по рынку</div>`:""}
<div class="pr-row"><span class="pr-lbl">${pd.byMarkup?"Цена по наценке "+esc(S.targetMarkup)+"%":"Цена продажи"}</span><span class="pr-val ${c}">${hs?fmt(pd.sell)+" ₽":"—"}</span></div>
<div class="pr-row"><span class="pr-lbl">Прибыль</span><span class="pr-val ${c}">${hs?(ip?"+":"")+fmt(pd.profit)+" ₽":"—"}</span></div>
<div class="pr-row"><span class="pr-lbl">Наценка</span><span class="pr-val ${c}">${hs?(ip?"+":"")+fmtD(pd.markup,1)+"%":"—"}</span></div>
<div class="pr-row"><span class="pr-lbl">Маржа</span><span class="pr-val ${c}">${hs?(ip?"+":"")+fmtD(pd.margin,1)+"%":"—"}</span></div>
<div class="pr-bar"><div class="pr-bar-bg"><div class="pr-bar-fill" style="width:${bw}%;background:${bc}"></div></div>
<div class="pr-bar-labels"><span>0%</span><span>50%</span><span>100%</span></div></div>
<div class="pr-big"><div class="big-pct ${c}">${hs?(ip?"+":"")+fmtD(pd.markup,1)+"%":"—"}</div><div class="big-lbl">НАЦЕНКА</div></div>`}

function calcHTML(){
const t=totR(S.entries,S.rates);
const l=S.display.length,fs=l>12?24:l>8?30:36;
let h=`<div class="header"><h1>🚗 Авто Калькулятор</h1><p>Расчёт себестоимости импортного автомобиля</p></div>
<div class="jump-row">
<div class="jump-chip" onclick="toggleTheme()">${S.theme==="light"?"🌙 ТЁМНАЯ":"☀️ СВЕТЛАЯ"}</div>
<div class="jump-chip" onclick="document.getElementById('wh-section')?.scrollIntoView({behavior:'smooth'})">🏭 Склад</div>
<div class="jump-chip" onclick="document.getElementById('sold-section')?.scrollIntoView({behavior:'smooth'})">💰 Проданные</div>
<div class="jump-chip" onclick="document.getElementById('stats-section')?.scrollIntoView({behavior:'smooth'})">📈 Статистика</div></div>
<input type="text" class="car-name-input" placeholder="Название авто (напр. BMW X5 2023)" value="${esc(S.carName)}"
oninput="S.carName=this.value;saveDraft()">
<div class="coll-box"><div class="coll-header" onclick="S.showCarInfo=!S.showCarInfo;render()">
<span>🚗 Данные авто${carSpecsStr(S.carInfo)||S.carInfo.vin||S.carInfo.trim||S.carInfo.body||S.carInfo.inter?" ✓":""}</span><span class="coll-arrow" style="transform:rotate(${S.showCarInfo?180:0}deg)">▾</span></div>
${S.showCarInfo?`<div class="coll-body">
<div class="edit-fields" style="align-items:flex-end;margin-bottom:8px">
<div class="edit-field" style="flex:2"><label class="edit-lbl">VIN — ВНУТРЕННИЙ, В ЧЕК КЛИЕНТУ НЕ ПОПАДАЕТ</label>
<input type="text" maxlength="20" class="edit-input" placeholder="WBA..." value="${esc(S.carInfo.vin)}" oninput="S.carInfo.vin=this.value;saveDraft()"></div>
<div class="bulk-apply" onclick="vinFillCalc()">🔎 ПО VIN</div></div>
<div class="edit-fields" style="margin-bottom:8px">
<div class="edit-field"><label class="edit-lbl">ГОД ВЫПУСКА</label>
<input type="text" inputmode="numeric" maxlength="4" class="edit-input" placeholder="2023" value="${esc(S.carInfo.year)}" oninput="S.carInfo.year=this.value;saveDraft()"></div>
<div class="edit-field"><label class="edit-lbl">ОБЪЁМ ДВИГАТЕЛЯ, Л</label>
<input type="text" inputmode="decimal" maxlength="10" class="edit-input" placeholder="3.5" value="${esc(S.carInfo.vol)}" oninput="S.carInfo.vol=this.value;saveDraft()"></div></div>
<div style="margin-bottom:8px"><label class="edit-lbl">ЦВЕТ КУЗОВА</label>${colorPickerHTML("body",S.carInfo.body,"setCalcColor","calc:body")}</div>
<div style="margin-bottom:8px"><label class="edit-lbl">ЦВЕТ САЛОНА</label>${colorPickerHTML("inter",S.carInfo.inter,"setCalcColor","calc:inter")}</div>
<div class="edit-fields">
<div class="edit-field"><label class="edit-lbl">КОМПЛЕКТАЦИЯ (видит клиент)</label>
<input type="text" maxlength="80" class="edit-input" placeholder="Premium, панорама, HUD" value="${esc(S.carInfo.trim)}" oninput="S.carInfo.trim=this.value;saveDraft()"></div></div>
<div class="rate-hint">Эти данные попадут в чек для клиента (кроме VIN — он только для внутренних задач). «🔎 ПО VIN» заполняет пустые поля из базы NHTSA; заполненное вручную не трогает.</div>
</div>`:""}</div>
<div class="coll-box"><div class="coll-header" onclick="S.showSettings=!S.showSettings;render()">
<span>⚙️ Текущие курсы валют</span><span class="coll-arrow" style="transform:rotate(${S.showSettings?180:0}deg)">▾</span></div>
${S.showSettings?`<div class="coll-body">
<div class="rates-row" style="flex-wrap:wrap">
${S.activeCur.map(c=>`<div style="flex:1 1 40%;min-width:120px"><label class="rate-label ${curInfo(c).cls}">${curInfo(c).symbol} ${c} / ₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="rate-input ${curInfo(c).cls}" value="${esc(S.rates[c]||"")}" oninput="S.rates['${c}']=this.value;saveDraft()" onchange="render()"></div>`).join("")}
</div>
<div class="cur-chips">
${Object.keys(CUR).filter(c=>c!=="RUB").map(c=>`<div class="cur-chip ${S.activeCur.includes(c)?"active":""}" onclick="togCur('${c}')">${CUR[c].symbol} ${c} · ${CUR[c].label}</div>`).join("")}</div>
<div class="cbr-row">
<input type="date" class="cbr-date" value="${esc(S.cbrDate||todayStr())}" max="${todayStr()}" oninput="S.cbrDate=this.value" title="Дата курса ЦБ (по умолчанию — сегодня; можно выбрать архивную)">
<div class="cbr-btn" onclick="fetchCbr()">↻ КУРС ЦБ</div>
<div class="cbr-btn cbr-market" onclick="fetchMarket()" title="Курс обмена Камкомбанка (продажа банка)">🏦 РЫНОК</div>
<div class="cbr-btn cbr-usdt" onclick="fetchUsdt()" title="Курс USDT/₽ (биржа ABCEX) — в поле USD">💠 USDT</div>
<div class="cbr-btn cbr-clear" onclick="clearRates()" title="Очистить курсы и дату">✕</div></div>
<div class="rate-hint" id="cbr-info">${esc(S.cbrInfo)||"«КУРС ЦБ» — официальный курс (можно на дату). «🏦 РЫНОК» — курс обмена Камкомбанка (продажа банка)."}</div>
<div class="rate-hint">💡 Курс фиксируется за каждой позицией в момент добавления. Платишь таможню через месяц по новому курсу — поменяй курс здесь перед добавлением позиции, либо отредактируй позицию на складе.</div></div>`:""}</div>
<div class="categories">${CATS.map((c,i)=>`<div class="cat-btn ${S.curCat===i?"active":""}" onclick="S.curCat=${i};saveDraft();render()">${c.icon} ${c.label}</div>`).join("")}</div>
<div class="calc-body"><div class="display-box">
<div class="display-cat">${CATS[S.curCat].icon} ${CATS[S.curCat].label}</div>
<div class="display-num" id="calc-display" style="font-size:${fs}px">${fmt(parseNum(S.display||"0")||0)}</div></div>
<div class="numpad">
${[7,8,9].map(d=>`<div class="btn-calc" onclick="digit('${d}')">${d}</div>`).join("")}
<div class="btn-calc back" onclick="bsp()">⌫</div>
${[4,5,6].map(d=>`<div class="btn-calc" onclick="digit('${d}')">${d}</div>`).join("")}
<div class="btn-calc clear" onclick="clr()">C</div>
${[1,2,3].map(d=>`<div class="btn-calc" onclick="digit('${d}')">${d}</div>`).join("")}
<div class="btn-calc" onclick="digit('0')">0</div>
<div class="btn-calc triple" onclick="tri('000')">000</div>
<div class="btn-calc triple" onclick="tri('00')">00</div></div>
<div class="currency-row">
${[...S.activeCur,"RUB"].map(c=>`<div class="btn-currency ${CUR[c].cls}" onclick="curClick('${c}')">${CUR[c].symbol} ${CUR[c].label}</div>`).join("")}</div></div>`;

if(S.entries.length>0){
h+=`<div class="entries-box"><div class="entries-header"><span>ПОЗИЦИИ (${S.entries.length})</span><span>СЕБЕСТ: ${fmt(t)} ₽</span></div>`;
S.entries.forEach((e,i)=>{const cm=curInfo(e.currency);
if(S.editingEntry===i){
h+=`<div class="entry-edit-form">
<div style="color:var(--t3);font-size:10px;margin-bottom:6px">${esc(e.icon)} ${esc(e.label)} — редактирование</div>
<label class="edit-lbl">СУММА</label>
<input type="text" inputmode="decimal" maxlength="16" class="entry-edit-input" value="${esc(S.editValue)}" oninput="S.editValue=this.value">
<div class="profit-curr-row" style="margin-bottom:8px">
${[...new Set(["RUB",...S.activeCur,S.editCurr])].map(c=>`<div class="pcb ${S.editCurr===c?"a-"+curInfo(c).cls:""}"
onclick="S.editCurr='${esc(c)}';S.editRate=S.rates['${esc(c)}']||'';render()">${curInfo(c).symbol} ${esc(c)}</div>`).join("")}</div>
${S.editCurr!=="RUB"?`<label class="edit-lbl">КУРС ${curInfo(S.editCurr).symbol}/₽ (на дату оплаты)</label>
<input type="text" inputmode="decimal" maxlength="16" class="entry-edit-input" value="${esc(S.editRate)}" oninput="S.editRate=this.value">`:""}
<div style="display:flex;gap:8px">
<div class="btn-action btn-green" style="flex:1;margin:0;padding:10px 0;font-size:11px" onclick="saveEdit(${i})">✅ СОХРАНИТЬ</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 16px;font-size:11px" onclick="cancelEdit()">✕</div></div></div>`;
}else{
const r=entryRate(e,S.rates);
h+=`<div class="entry-row"><div style="flex:1"><div class="entry-label">${esc(e.icon)} ${esc(e.label)}</div>
${e.currency!=="RUB"?`<div class="entry-rate">курс ${r?fmtRate(r):"⚠ нет курса"} ₽</div>`:""}</div>
<div style="text-align:right;display:flex;align-items:center;gap:4px"><div>
<div class="entry-amount ${cm.cls}">${esc(fmt(e.amount))} ${cm.symbol}</div>
${e.currency!=="RUB"?`<div class="entry-rub">≈ ${fmt(entryRub(e,S.rates))} ₽</div>`:""}</div>
<div class="entry-act edit" onclick="startEdit(${i})">✎</div>
<div class="entry-act del" onclick="delEntry(${i})">✕</div></div></div>`}});
h+=`<div style="padding:0 12px 8px;display:flex;gap:8px">
<div class="btn-action btn-yellow" style="flex:1;margin:0" onclick="printR()">🧾 ЧЕК</div>
<div class="btn-action btn-red" style="flex:1;margin:0" title="Стереть название, позиции и цену продажи (курсы останутся)" onclick="clearCalc()">🗑 ОЧИСТИТЬ</div></div>
<div style="padding:0 12px 12px;display:flex;gap:8px">
<div class="btn-action btn-blue" style="flex:1;margin:0" title="Сохранить как прикидку — не склад, не считается в заморожено" onclick="addEstimate()">📝 В ПРИКИДКИ</div>
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="addToWH()">🏭 НА СКЛАД</div></div></div>`;

h+=`<div class="profit-box"><div class="coll-header" onclick="S.showProfit=!S.showProfit;render()">
<span>📊 Расчёт прибыли</span><span class="coll-arrow" style="transform:rotate(${S.showProfit?180:0}deg)">▾</span></div>
${S.showProfit?`<div class="profit-body">
<div class="profit-input-group"><label>💰 Продажа</label>
<input type="text" inputmode="decimal" maxlength="16" class="profit-input" placeholder="0" value="${esc(S.sellPrice)}" oninput="S.sellPrice=this.value;saveDraft();rProfit();rReceipt()"></div>
<div class="profit-curr-row">
${[...new Set(["RUB",...S.activeCur,S.sellCurrency])].map(c=>`<div class="pcb ${S.sellCurrency===c?"a-"+curInfo(c).cls:""}" onclick="S.sellCurrency='${esc(c)}';saveDraft();render()">${curInfo(c).symbol} ${esc(c)}</div>`).join("")}</div>
<div class="target-row">
<label class="target-lbl">🎯 Наценка</label>
<input type="text" inputmode="decimal" maxlength="8" class="profit-input target-inp" placeholder="%" value="${esc(S.targetMarkup)}" oninput="S.targetMarkup=this.value;saveDraft();rTarget();rProfit();rReceipt()">
<div class="target-out" id="tgt-out">${targetHTML(t)}</div>
<div class="bulk-apply" onclick="applyTarget()">→ В ПРОДАЖУ</div></div>
<div class="pr-box" id="pr-results">${prHTML(pCalc(t))}</div></div>`:""}</div>`}

if(S.showReceipt&&S.entries.length>0)h+=receiptHTML();
return h}
