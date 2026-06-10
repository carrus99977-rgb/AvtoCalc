// ===== CALC =====
function digit(d){if(S.display==="0"&&d!==".")S.display=d;else if(d==="."&&S.display.includes("."))return;else S.display+=d;rDisp()}
function clr(){S.display="0";rDisp()}
function bsp(){S.display=S.display.length<=1?"0":S.display.slice(0,-1);rDisp()}
function tri(n){if(S.display!=="0"){S.display+=n;rDisp()}}
function curClick(cid){const a=parseFloat(S.display)||0;if(a<=0)return;const cat=CATS[S.curCat];
// фиксируем курс на момент добавления позиции
const rate=cid==="RUB"?"":(S.rates[cid]||"");
S.entries.push({category:cat.id,label:cat.label,icon:cat.icon,amount:a,currency:cid,rate:rate});
S.display="0";if(S.curCat<CATS.length-1)S.curCat++;
S.showReceipt=false;S.receiptImage=null;saveDraft();render()}
function delEntry(i){S.entries.splice(i,1);S.showReceipt=false;S.receiptImage=null;S.editingEntry=null;saveDraft();render()}
function startEdit(i){const e=S.entries[i];S.editingEntry=i;S.editValue=String(e.amount);S.editCurr=e.currency;
S.editRate=e.rate||(e.currency==="RUB"?"":S.rates[e.currency]||"");render()}
function cancelEdit(){S.editingEntry=null;render()}
function saveEdit(i){const v=parseFloat(S.editValue)||0;if(v<=0){alert("Введите сумму");return}
S.entries[i].amount=v;S.entries[i].currency=S.editCurr;
S.entries[i].rate=S.editCurr==="RUB"?"":(S.editRate||S.rates[S.editCurr]||"");
S.editingEntry=null;S.showReceipt=false;S.receiptImage=null;saveDraft();render()}
function printR(){S.showReceipt=true;S.receiptImage=null;render();
setTimeout(()=>document.getElementById("receipt-section")?.scrollIntoView({behavior:"smooth"}),100)}
function rDisp(){const el=document.getElementById("calc-display");if(!el)return render();
const l=S.display.length;el.style.fontSize=(l>12?24:l>8?30:36)+"px";el.textContent=fmt(parseFloat(S.display||"0"))}
function rProfit(){const t=totR(S.entries,S.rates);
const el=document.getElementById("pr-results");if(el)el.innerHTML=prHTML(pCalc(t))}
function pCalc(cost){const sell=toR(parseFloat(S.sellPrice)||0,S.sellCurrency,S.rates);const pr=sell-cost;
return{cost,sell,profit:pr,markup:cost>0?(pr/cost)*100:0,margin:sell>0?(pr/sell)*100:0}}

// Включение/выключение валюты в настройках
function togCur(c){const i=S.activeCur.indexOf(c);
if(i>=0){if(S.activeCur.length<=1){alert("Оставьте хотя бы одну валюту");return}
S.activeCur.splice(i,1);if(S.sellCurrency===c)S.sellCurrency="RUB"}
else{S.activeCur.push(c);S.activeCur=Object.keys(CUR).filter(k=>S.activeCur.includes(k))}
saveDraft();render()}

function prHTML(pd){const hs=pd.sell>0,ip=pd.profit>=0,c=!hs?"ntl":ip?"pos":"neg",
bw=!hs?0:Math.min(Math.abs(pd.markup),100),bc=!hs?"#333":ip?"#27ae60":"#e74c3c";
return`<div class="pr-row"><span class="pr-lbl">Себестоимость</span><span class="pr-val ntl">${fmt(pd.cost)} ₽</span></div>
<div class="pr-row"><span class="pr-lbl">Цена продажи</span><span class="pr-val ${c}">${hs?fmt(pd.sell)+" ₽":"—"}</span></div>
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
<div class="coll-box"><div class="coll-header" onclick="S.showSettings=!S.showSettings;render()">
<span>⚙️ Текущие курсы валют</span><span class="coll-arrow" style="transform:rotate(${S.showSettings?180:0}deg)">▾</span></div>
${S.showSettings?`<div class="coll-body">
<div class="rates-row" style="flex-wrap:wrap">
${S.activeCur.map(c=>`<div style="flex:1 1 40%;min-width:120px"><label class="rate-label ${CUR[c].cls}">${CUR[c].symbol} ${c} / ₽</label>
<input type="number" class="rate-input ${CUR[c].cls}" value="${S.rates[c]||""}" oninput="S.rates['${c}']=this.value;saveDraft()" onchange="render()"></div>`).join("")}
</div>
<div class="cur-chips">
${Object.keys(CUR).filter(c=>c!=="RUB").map(c=>`<div class="cur-chip ${S.activeCur.includes(c)?"active":""}" onclick="togCur('${c}')">${CUR[c].symbol} ${c} · ${CUR[c].label}</div>`).join("")}</div>
<div class="rate-hint">💡 Курс фиксируется за каждой позицией в момент добавления. Платишь таможню через месяц по новому курсу — поменяй курс здесь перед добавлением позиции, либо отредактируй позицию на складе.</div></div>`:""}</div>
<div class="categories">${CATS.map((c,i)=>`<div class="cat-btn ${S.curCat===i?"active":""}" onclick="S.curCat=${i};saveDraft();render()">${c.icon} ${c.label}</div>`).join("")}</div>
<div class="calc-body"><div class="display-box">
<div class="display-cat">${CATS[S.curCat].icon} ${CATS[S.curCat].label}</div>
<div class="display-num" id="calc-display" style="font-size:${fs}px">${fmt(parseFloat(S.display||"0"))}</div></div>
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
S.entries.forEach((e,i)=>{const cm=CUR[e.currency]||CUR.RUB;
if(S.editingEntry===i){
h+=`<div class="entry-edit-form">
<div style="color:#888;font-size:10px;margin-bottom:6px">${e.icon} ${e.label} — редактирование</div>
<label class="edit-lbl">СУММА</label>
<input type="number" class="entry-edit-input" value="${S.editValue}" oninput="S.editValue=this.value">
<div class="profit-curr-row" style="margin-bottom:8px">
${[...new Set(["RUB",...S.activeCur,S.editCurr])].map(c=>`<div class="pcb ${S.editCurr===c?"a-"+CUR[c].cls:""}"
onclick="S.editCurr='${c}';S.editRate=S.rates['${c}']||'';render()">${CUR[c].symbol} ${c}</div>`).join("")}</div>
${S.editCurr!=="RUB"?`<label class="edit-lbl">КУРС ${CUR[S.editCurr].symbol}/₽ (на дату оплаты)</label>
<input type="number" class="entry-edit-input" value="${S.editRate}" oninput="S.editRate=this.value">`:""}
<div style="display:flex;gap:8px">
<div class="btn-action btn-green" style="flex:1;margin:0;padding:10px 0;font-size:11px" onclick="saveEdit(${i})">✅ СОХРАНИТЬ</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 16px;font-size:11px" onclick="cancelEdit()">✕</div></div></div>`;
}else{
const r=entryRate(e,S.rates);
h+=`<div class="entry-row"><div style="flex:1"><div class="entry-label">${e.icon} ${e.label}</div>
${e.currency!=="RUB"?`<div class="entry-rate">курс ${fmtRate(r)} ₽</div>`:""}</div>
<div style="text-align:right;display:flex;align-items:center;gap:4px"><div>
<div class="entry-amount ${cm.cls}">${fmt(e.amount)} ${cm.symbol}</div>
${e.currency!=="RUB"?`<div class="entry-rub">≈ ${fmt(entryRub(e,S.rates))} ₽</div>`:""}</div>
<div class="entry-act edit" onclick="startEdit(${i})">✎</div>
<div class="entry-act del" onclick="delEntry(${i})">✕</div></div></div>`}});
h+=`<div style="padding:0 12px 12px;display:flex;gap:8px">
<div class="btn-action btn-yellow" style="flex:1;margin:0" onclick="printR()">🧾 ЧЕК</div>
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="addToWH()">🏭 НА СКЛАД</div></div></div>`;

h+=`<div class="profit-box"><div class="coll-header" onclick="S.showProfit=!S.showProfit;render()">
<span>📊 Расчёт прибыли</span><span class="coll-arrow" style="transform:rotate(${S.showProfit?180:0}deg)">▾</span></div>
${S.showProfit?`<div class="profit-body">
<div class="profit-input-group"><label>💰 Продажа</label>
<input type="number" class="profit-input" placeholder="0" value="${S.sellPrice}" oninput="S.sellPrice=this.value;saveDraft();rProfit()"></div>
<div class="profit-curr-row">
${[...new Set(["RUB",...S.activeCur,S.sellCurrency])].map(c=>`<div class="pcb ${S.sellCurrency===c?"a-"+CUR[c].cls:""}" onclick="S.sellCurrency='${c}';saveDraft();render()">${CUR[c].symbol} ${c}</div>`).join("")}</div>
<div class="pr-box" id="pr-results">${prHTML(pCalc(t))}</div></div>`:""}</div>`}

if(S.showReceipt&&S.entries.length>0)h+=receiptHTML();
return h}
