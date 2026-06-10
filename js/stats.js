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
const months={};
sld.forEach(c=>{const d=new Date(c.sellDate);const k=String(d.getMonth()+1).padStart(2,"0")+"."+d.getFullYear();
months[k]=(months[k]||0)+carProfit(c)});
const keys=Object.keys(months).sort((a,b)=>{const[a1,a2]=a.split(".");const[b1,b2]=b.split(".");
return(b2+b1).localeCompare(a2+a1)});
const maxV=Math.max(...keys.map(k=>Math.abs(months[k])),1);
h+=`<div class="coll-box"><div class="coll-header" style="cursor:default"><span>📅 Прибыль по месяцам</span></div>
<div class="coll-body">`;
keys.forEach(k=>{const v=months[k];const w=Math.round(Math.abs(v)/maxV*100);
h+=`<div class="month-row"><span class="month-lbl">${k}</span>
<div class="month-bar-wrap"><div class="month-bar" style="width:${w}%;background:${v>=0?"#27ae60":"#e74c3c"}"></div></div>
<span class="month-val" style="color:${v>=0?"#27ae60":"#e74c3c"}">${v>=0?"+":""}${fmt(v)} ₽</span></div>`});
h+=`</div></div>`;
return h}
