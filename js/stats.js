function statsHTML(){
const sld=S.warehouse.filter(c=>c.status==="sold"&&c.sellDate);
let h=`<div class="section-divider stats" id="stats-section"><span>📈 Статистика</span></div>`;
if(!sld.length)return h+`<div class="empty-state"><div class="em-icon">📈</div><div class="em-text">Появится после первых продаж</div></div>`;
const tp=sld.reduce((s,c)=>s+carProfit(c),0);
const avgMargin=sld.reduce((s,c)=>{const cost=carCost(c);return s+(cost>0?(carProfit(c)/cost)*100:0)},0)/sld.length;
const avgDays=sld.reduce((s,c)=>s+daysBetween(c.date,c.sellDate),0)/sld.length;
h+=`<div class="stats-bar">
<div class="stat-card"><div class="stat-num ${tp>=0?"green":"red"}">${tp>=0?"+":""}${fmt(tp)}</div><div class="stat-lbl">ОБЩАЯ ПРИБЫЛЬ ₽</div></div>
<div class="stat-card"><div class="stat-num ${avgMargin>=0?"green":"red"}">${avgMargin>=0?"+":""}${fmtD(avgMargin,1)}%</div><div class="stat-lbl">СРЕДНЯЯ НАЦЕНКА</div></div>
<div class="stat-card"><div class="stat-num blue">${Math.round(avgDays)}</div><div class="stat-lbl">СР. ДНЕЙ ДО ПРОДАЖИ</div></div></div>`;
h+=`<div id="charts-wrap">${chartsInnerHTML()}</div>`;
return h}
