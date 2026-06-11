// ===== ГРАФИКИ СТАТИСТИКИ (inline-SVG, без библиотек) =====
const CHART_COLORS={car_price:"#5B8FF9",logistics:"#5AD8A6",customs:"#F6BD16",
util_fee:"#E8684A",registration:"#9270CA",other:"#6DC8EC"};
const MONTH_NAMES=["янв","фев","мар","апр","май","июн","июл","авг","сен","окт","ноя","дек"];
const MONTH_FULL=["Январь","Февраль","Март","Апрель","Май","Июнь","Июль","Август","Сентябрь","Октябрь","Ноябрь","Декабрь"];

function fmtShort(n){const a=Math.abs(n);
if(a>=1e6)return fmtD(n/1e6,1)+" млн";
if(a>=1e3)return fmt(Math.round(n/1e3))+" тыс";
return fmt(n)}

// --- данные: последние 12 месяцев (мемо в рамках одного рендера: зависит только от S.warehouse) ---
let _monthsCache=null;
function monthsData(){
if(_monthsCache)return _monthsCache;
const map={};
S.warehouse.forEach(c=>{if(c.status!=="sold"||!c.sellDate)return;
const d=new Date(c.sellDate);if(isNaN(d))return;
const k=d.getFullYear()*12+d.getMonth();
(map[k]=map[k]||{profit:0,count:0});const p=carProfit(c);map[k].profit+=Number.isFinite(p)?p:0;map[k].count++});
const out=[],now=new Date();
for(let i=11;i>=0;i--){
const d=new Date(now.getFullYear(),now.getMonth()-i,1);
const k=d.getFullYear()*12+d.getMonth();
out.push({m:d.getMonth(),y:d.getFullYear(),profit:map[k]?map[k].profit:0,count:map[k]?map[k].count:0})}
return _monthsCache=out}

// --- область просмотра: "all" (всё время) или индекс месяца в окне 12 мес ---
function scopeMonthMY(){if(S.statScope==null||S.statScope==="all")return null;
const d=monthsData()[S.statScope];return d?{m:d.m,y:d.y}:null}
// только продажи с валидной датой — одна и та же популяция, что в верхней карточке «общая прибыль» и в гистограмме
function scopedSold(){const sold=S.warehouse.filter(c=>c.status==="sold"&&c.sellDate&&!isNaN(new Date(c.sellDate)));
const sm=scopeMonthMY();if(!sm)return sold;
return sold.filter(c=>{const d=new Date(c.sellDate);return d.getFullYear()===sm.y&&d.getMonth()===sm.m})}
function scopeShort(){const sm=scopeMonthMY();return sm?MONTH_NAMES[sm.m]+" "+sm.y:"всё время"}
function scopeFull(){const sm=scopeMonthMY();return sm?MONTH_FULL[sm.m]+" "+sm.y:"Всё время"}
function profitSum(list){return list.reduce((s,c)=>{const p=carProfit(c);return s+(Number.isFinite(p)?p:0)},0)}

// --- гистограмма по месяцам (переключатель периода) ---
function monthsChartHTML(){
const data=monthsData();
const isAll=scopeMonthMY()==null;
const W=360,chartH=140,top=12;
const posMax=Math.max(0,...data.map(d=>d.profit));
const negMin=Math.min(0,...data.map(d=>d.profit));
const span=(posMax-negMin)||1;
const zeroY=top+(posMax/span)*chartH;
const slot=W/12,barW=20;
let bars="";
data.forEach((d,i)=>{
const x=i*slot+(slot-barW)/2;
const h=Math.abs(d.profit)/span*chartH;
const sel=S.statScope===i;
if(d.count){
const bh=Math.max(h,2),y=d.profit>=0?zeroY-bh:zeroY;
bars+=`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW}" height="${bh.toFixed(1)}" rx="3"
fill="${d.profit>=0?"url(#barG)":"url(#barR)"}" ${sel?'stroke="var(--gold)" stroke-width="1.5"':""}/>`;
}else{
bars+=`<rect x="${x.toFixed(1)}" y="${(zeroY-1).toFixed(1)}" width="${barW}" height="2" rx="1" fill="var(--br2)"/>`;
}
bars+=`<rect x="${(i*slot).toFixed(1)}" y="0" width="${slot.toFixed(1)}" height="${chartH+top+22}" fill="transparent" style="cursor:pointer" onclick="selMonth(${i})"/>`;
const lbl=d.m===0?MONTH_NAMES[d.m]+"·"+String(d.y).slice(2):MONTH_NAMES[d.m];
bars+=`<text x="${(i*slot+slot/2).toFixed(1)}" y="${chartH+top+16}" text-anchor="middle"
font-size="8.5" fill="${sel?"var(--gold)":"var(--t4)"}" font-family="JetBrains Mono,monospace">${lbl}</text>`});
// сводка по текущей области
const scoped=scopedSold(),tp=profitSum(scoped),n=scoped.length;
const info=`${scopeFull()}: <b style="color:${tp>=0?"#27ae60":"#e74c3c"}">${tp>=0?"+":""}${fmt(tp)} ₽</b> · ${n} маш.`;
return `<div class="coll-box"><div class="coll-header" style="cursor:default"><span>📊 Прибыль по месяцам</span></div>
<div class="coll-body">
<div class="scope-row">
<div class="scope-pill ${isAll?"active":""}" onclick="selAll()">Σ ВСЁ ВРЕМЯ</div>
<div class="scope-hint">${isAll?"нажми на месяц, чтобы смотреть его":"показан "+scopeShort()}</div></div>
<svg viewBox="0 0 ${W} ${chartH+top+22}" style="width:100%;display:block">
<defs>
<linearGradient id="barG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2ecc71"/><stop offset="1" stop-color="#1e8449"/></linearGradient>
<linearGradient id="barR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c0392b"/><stop offset="1" stop-color="#e74c3c"/></linearGradient>
</defs>
<line x1="0" y1="${zeroY.toFixed(1)}" x2="${W}" y2="${zeroY.toFixed(1)}" stroke="var(--br2)" stroke-width="1"/>
${bars}</svg>
<div class="chart-info">${info}</div></div></div>`}
function selMonth(i){if(!monthsData()[i].count)return;S.statScope=i;S.chartCat=null;rCharts()}
function selAll(){S.statScope="all";S.chartCat=null;rCharts()}

// --- пончик расходов по категориям (по выбранной области) ---
function categoryData(list){
const sums={};let total=0;
list.forEach(car=>{const cr=carRates(car);
car.entries.forEach(e=>{const v=entryRub(e,cr);if(!(v>0))return;
const k=CHART_COLORS[e.category]?e.category:"other";
sums[k]=(sums[k]||0)+v;total+=v})});
return{sums,total}}

function donutChartHTML(){
const{sums,total}=categoryData(scopedSold());
const head=`<div class="coll-header" style="cursor:default"><span>🧩 Расходы — ${esc(scopeShort())}</span></div>`;
if(!total)return `<div class="coll-box">${head}<div class="coll-body"><div class="chart-empty">Нет расходов за период</div></div></div>`;
const cats=CATS.filter(c=>sums[c.id]).map(c=>({id:c.id,label:c.label,icon:c.icon,v:sums[c.id]}));
const R=58,CX=85,CY=85,C=2*Math.PI*R;
let off=0,segs="";
cats.forEach(c=>{
const frac=c.v/total,len=frac*C,sel=S.chartCat===c.id;
segs+=`<circle cx="${CX}" cy="${CY}" r="${R}" fill="none" stroke="${CHART_COLORS[c.id]}"
stroke-width="${sel?32:24}" stroke-dasharray="${Math.max(len-1.5,1).toFixed(2)} ${C.toFixed(2)}"
stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${CX} ${CY})"
style="cursor:pointer;opacity:${S.chartCat&&!sel?.45:1}" onclick="selCat('${c.id}')"/>`;
off+=len});
const selC=cats.find(c=>c.id===S.chartCat);
const center=selC
?`<text x="${CX}" y="${CY-4}" text-anchor="middle" font-size="11" fill="${CHART_COLORS[selC.id]}" font-weight="700" font-family="Oswald,sans-serif">${fmtD(selC.v/total*100,1)}%</text>
<text x="${CX}" y="${CY+12}" text-anchor="middle" font-size="8.5" fill="var(--t3)" font-family="JetBrains Mono,monospace">${fmtShort(selC.v)} ₽</text>`
:`<text x="${CX}" y="${CY-4}" text-anchor="middle" font-size="8.5" fill="var(--t4)" font-family="JetBrains Mono,monospace">РАСХОДЫ</text>
<text x="${CX}" y="${CY+12}" text-anchor="middle" font-size="11" fill="var(--t0)" font-weight="700" font-family="Oswald,sans-serif">${fmtShort(total)} ₽</text>`;
const legend=cats.map(c=>`<div class="cl-row ${S.chartCat===c.id?"sel":""}" onclick="selCat('${c.id}')">
<span class="cl-dot" style="background:${CHART_COLORS[c.id]}"></span>
<span class="cl-name">${c.icon} ${c.label}</span>
<span class="cl-val">${fmtShort(c.v)} ₽ · ${fmtD(c.v/total*100,1)}%</span></div>`).join("");
return `<div class="coll-box">${head}
<div class="coll-body"><div class="donut-wrap">
<svg viewBox="0 0 170 170" class="donut-svg">${segs}${center}</svg>
<div class="cl-legend">${legend}</div></div></div></div>`}
function selCat(k){S.chartCat=S.chartCat===k?null:k;rCharts()}

// --- прибыль по машинам (по выбранной области) ---
function carsChartHTML(){
const sld=scopedSold()
.map(c=>{const p=carProfit(c);return{name:c.name,profit:Number.isFinite(p)?p:0}})
.sort((a,b)=>b.profit-a.profit);
const head=`<div class="coll-header" style="cursor:default"><span>🏆 Прибыль по машинам — ${esc(scopeShort())}</span></div>`;
if(!sld.length)return `<div class="coll-box">${head}<div class="coll-body"><div class="chart-empty">Нет продаж за период</div></div></div>`;
const top=sld.slice(0,8),rest=sld.length-top.length;
const maxAbs=Math.max(...top.map(c=>Math.abs(c.profit)),1);
const rows=top.map(c=>{const ip=c.profit>=0,w=Math.max(Math.abs(c.profit)/maxAbs*100,3);
return `<div class="cb-row"><div class="cb-name">${esc(c.name)}</div>
<div class="cb-track"><div class="cb-bar ${ip?"pos":"neg"}" style="width:${w.toFixed(1)}%"></div></div>
<div class="cb-val" style="color:${ip?"#27ae60":"#e74c3c"}">${ip?"+":""}${fmtShort(c.profit)}</div></div>`}).join("");
return `<div class="coll-box">${head}
<div class="coll-body">${rows}${rest>0?`<div class="cb-more">и ещё ${rest} маш.</div>`:""}</div></div>`}

// --- сборка и частичная перерисовка ---
function chartsInnerHTML(){_monthsCache=null;return monthsChartHTML()+donutChartHTML()+carsChartHTML()}
function rCharts(){const el=document.getElementById("charts-wrap");if(el)el.innerHTML=chartsInnerHTML()}
