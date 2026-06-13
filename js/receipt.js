// ===== RECEIPTS =====
function receiptHTML(){
const entries=S.entries,cn=S.carName,rates=S.rates,t=totR(entries,rates);
const pd=pCalc(t),hs=pd.sell>0,ip=pd.profit>=0;
let h=`<div class="receipt-wrap animate" id="receipt-section"><div class="receipt"><div class="perf-top"></div>
<div class="receipt-title"><h2>★ АВТО КАЛЬКУЛЯТОР ★</h2><div class="r-sub">РАСЧЁТ СЕБЕСТОИМОСТИ</div>
${cn.trim()?`<div class="r-car">🚗 ${esc(cn.trim().toUpperCase())}</div>`:""}<div class="r-date">${ds()}</div><div class="r-dash"></div></div>`;
entries.forEach(e=>{const cm=curInfo(e.currency),r=entryRate(e,rates),rv=entryRub(e,rates);
h+=`<div style="margin-bottom:8px"><div class="r-il">${esc(e.icon)} ${esc(e.label)}</div>
<div class="r-ir"><span class="r-irl">${esc(fmt(e.amount))} ${cm.symbol}${e.currency!=="RUB"?" × "+fmtRate(r):""}</span>
<span class="r-irr">${fmt(rv)} ₽</span></div></div>`});
h+=`<div class="r-dash-bold"></div><div class="r-total"><span>СЕБЕСТОИМОСТЬ:</span><span>${fmt(t)} ₽</span></div>`;
if(hs){h+=`<div class="r-dash"></div>
<div class="r-pr"><span class="r-prl">Цена продажи:</span><span class="r-prv">${fmt(pd.sell)} ₽</span></div>
<div class="r-pr"><span class="r-prl">Прибыль:</span><span class="r-prv ${ip?"pos":"neg"}">${ip?"+":""}${fmt(pd.profit)} ₽</span></div>
<div class="r-pr"><span class="r-prl">Наценка:</span><span class="r-prv ${ip?"pos":"neg"}">${ip?"+":""}${fmtD(pd.markup,1)}%</span></div>
<div class="r-pr"><span class="r-prl">Маржа:</span><span class="r-prv ${ip?"pos":"neg"}">${ip?"+":""}${fmtD(pd.margin,1)}%</span></div>
<div class="r-prb ${ip?"pos":"neg"}">${ip?"+":""}${fmt(pd.profit)} ₽</div>`}
h+=`<div class="r-dash"></div><div class="r-footer">СПАСИБО ЗА РАСЧЁТ!<br>★ ★ ★</div><div class="perf-bottom"></div></div>
<svg class="torn-edge" width="100%" height="16" viewBox="0 0 380 16" preserveAspectRatio="none">
<path d="${Array.from({length:38},(_,i)=>`${i===0?"M":"L"}${i*10},${i%2===0?0:12}`).join(" ")} L380,0 L380,16 L0,16 Z" fill="#fef9e7"/></svg>
<div class="btn-save" onclick="saveCalcReceipt()">⬇️ СКАЧАТЬ ЧЕК</div>
<div class="btn-save btn-share" onclick="shareCalcReceipt()">📤 ПОДЕЛИТЬСЯ ЧЕКОМ</div>
${S.receiptImage?`<div class="saved-preview" id="saved-img"><p>✅ ЗАЖМИТЕ КАРТИНКУ ДЛЯ СОХРАНЕНИЯ</p><img src="${S.receiptImage}" alt="Чек"></div>`:""}</div>`;
return h}

function drawReceiptPNG(opts){
const W=400,sc=2,cv=document.createElement("canvas"),cx=cv.getContext("2d");
const cost=totR(opts.entries,opts.rates);
let sellRub=0,profit=0,markup=0,margin=0,hasSell=false;
if(opts.sell&&parseNum(opts.sell.price)>0){hasSell=true;
sellRub=toR(parseNum(opts.sell.price),opts.sell.currency,opts.sell.rates);
profit=sellRub-cost;markup=cost>0?(profit/cost)*100:0;margin=sellRub>0?(profit/sellRub)*100:0}
let tH=60;if(opts.name)tH+=28;tH+=24+20+16+opts.entries.length*38+20+28;
if(hasSell)tH+=140;tH+=50+30;
cv.width=W*sc;cv.height=tH*sc;cx.scale(sc,sc);cx.fillStyle="#fef9e7";cx.fillRect(0,0,W,tH);
for(let x=6;x<W;x+=12){cx.beginPath();cx.arc(x,0,3,0,Math.PI*2);cx.fillStyle="#fff";cx.fill()}
const px=28,rx=W-px,mx=W/2;let y=28;cx.textBaseline="top";
cx.fillStyle="#2c2c2c";cx.font="bold 17px 'Courier New',monospace";cx.textAlign="center";cx.fillText("★ АВТО КАЛЬКУЛЯТОР ★",mx,y);y+=22;
cx.font="11px 'Courier New',monospace";cx.fillStyle="#888";cx.fillText(hasSell?"ОТЧЁТ ПО СДЕЛКЕ":"РАСЧЁТ СЕБЕСТОИМОСТИ",mx,y);y+=18;
if(opts.name){cx.fillStyle="#2c2c2c";cx.font="bold 14px 'Courier New',monospace";cx.fillText(opts.name.toUpperCase(),mx,y);y+=22}
cx.font="10px 'Courier New',monospace";cx.fillStyle="#aaa";cx.fillText(ds(),mx,y);y+=18;
cx.setLineDash([4,3]);cx.strokeStyle="#ccc";cx.lineWidth=1;cx.beginPath();cx.moveTo(px,y);cx.lineTo(rx,y);cx.stroke();y+=14;
cx.setLineDash([]);
opts.entries.forEach(e=>{const cm=curInfo(e.currency);
const r=entryRate(e,opts.rates),rv=entryRub(e,opts.rates);
cx.fillStyle="#2c2c2c";cx.font="bold 11px 'Courier New',monospace";cx.textAlign="left";cx.fillText(e.label,px,y);y+=16;
cx.font="12px 'Courier New',monospace";cx.fillStyle="#888";cx.textAlign="left";
cx.fillText(fmt(e.amount)+" "+cm.symbol+(e.currency!=="RUB"?" × "+fmtRate(r):""),px+4,y);
cx.fillStyle="#2c2c2c";cx.font="bold 12px 'Courier New',monospace";cx.textAlign="right";cx.fillText(fmt(rv)+" ₽",rx,y);y+=20});
cx.setLineDash([]);cx.strokeStyle="#2c2c2c";cx.lineWidth=2;cx.beginPath();cx.moveTo(px,y);cx.lineTo(rx,y);cx.stroke();y+=4;
cx.beginPath();cx.moveTo(px,y);cx.lineTo(rx,y);cx.stroke();y+=12;
cx.font="bold 17px 'Courier New',monospace";cx.fillStyle="#2c2c2c";cx.textAlign="left";cx.fillText("СЕБЕСТОИМОСТЬ:",px,y);
cx.textAlign="right";cx.fillText(fmt(cost)+" ₽",rx,y);y+=22;
if(hasSell){y+=4;cx.setLineDash([4,3]);cx.strokeStyle="#ccc";cx.lineWidth=1;cx.beginPath();cx.moveTo(px,y);cx.lineTo(rx,y);cx.stroke();y+=12;cx.setLineDash([]);
const ip=profit>=0;const sCur=curInfo(opts.sell.currency);
const rows=[["ЦЕНА ПРОДАЖИ:",fmt(parseNum(opts.sell.price)||0)+" "+sCur.symbol+(opts.sell.currency!=="RUB"?" = "+fmt(sellRub)+" ₽":""),null]];
if(opts.sell.currency!=="RUB")rows.push(["КУРС ПРОДАЖИ:",fmtRate(parseNum(opts.sell.rates[opts.sell.currency])||0)+" ₽/"+sCur.symbol,null]);
rows.push(["ПРИБЫЛЬ:",(ip?"+":"")+fmt(profit)+" ₽",ip],["НАЦЕНКА:",(ip?"+":"")+fmtD(markup,1)+"%",ip],["МАРЖА:",(ip?"+":"")+fmtD(margin,1)+"%",ip]);
rows.forEach(([lab,v,c])=>{cx.font="bold 11px 'Courier New',monospace";cx.fillStyle="#2c2c2c";cx.textAlign="left";cx.fillText(lab,px,y);
cx.fillStyle=c===null?"#2c2c2c":c?"#1e8449":"#922b21";cx.textAlign="right";cx.fillText(v,rx,y);y+=20})}
y+=8;cx.setLineDash([4,3]);cx.strokeStyle="#ccc";cx.lineWidth=1;cx.beginPath();cx.moveTo(px,y);cx.lineTo(rx,y);cx.stroke();y+=14;cx.setLineDash([]);
cx.textAlign="center";cx.fillStyle="#aaa";cx.font="10px 'Courier New',monospace";cx.fillText("СПАСИБО ЗА РАСЧЁТ!",mx,y);y+=14;cx.fillText("★ ★ ★",mx,y);
for(let x=6;x<W;x+=12){cx.beginPath();cx.arc(x,tH,3,0,Math.PI*2);cx.fillStyle="#fff";cx.fill()}
return cv.toDataURL("image/png")}

function downloadPNG(dataUrl,name){
try{const a=document.createElement("a");
const sn=name?name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s-]/g,"").replace(/\s+/g,"_"):"авто";
a.download="Чек_"+sn+"_"+new Date().toLocaleDateString("ru-RU").replace(/\./g,"-")+".png";
a.href=dataUrl;document.body.appendChild(a);a.click();document.body.removeChild(a)}catch(_){}}

function buildCalcReceiptPNG(){
const sp=parseNum(S.sellPrice)||0;
return drawReceiptPNG({name:S.carName.trim(),rates:S.rates,entries:S.entries,
sell:sp>0?{price:S.sellPrice,currency:S.sellCurrency,rates:S.rates}:null})}
function buildCarReceiptPNG(car){
return drawReceiptPNG({name:car.name,rates:carRates(car),entries:car.entries,
sell:car.status==="sold"&&parseNum(car.sellPrice)>0?{price:car.sellPrice,currency:car.sellCurrency,
rates:carSellRates(car)}:null})}

// ===== ШАРИНГ ЧЕКА =====
// dataURL → Blob синхронно (через fetch потерялся бы user gesture для navigator.share)
function dataUrlToBlob(du){const b=du.split(",")[1];const bin=atob(b);
const u8=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u8[i]=bin.charCodeAt(i);
return new Blob([u8],{type:"image/png"})}
function shareReceipt(dataUrl,name){
try{
const sn=name?name.replace(/[^a-zA-Zа-яА-ЯёЁ0-9\s-]/g,"").replace(/\s+/g,"_"):"авто";
const file=new File([dataUrlToBlob(dataUrl)],"Чек_"+sn+".png",{type:"image/png"});
if(navigator.canShare&&navigator.canShare({files:[file]})){
// отмена пользователем (AbortError) — не ошибка; прочие сбои — скачиваем как запасной вариант
navigator.share({files:[file]}).catch(err=>{if(!err||err.name!=="AbortError")downloadPNG(dataUrl,name)});
return}
}catch(e){}
// устройство не умеет делиться файлами — просто скачиваем
downloadPNG(dataUrl,name)}

function saveCalcReceipt(){
const du=buildCalcReceiptPNG();
S.receiptImage=du;downloadPNG(du,S.carName.trim());render();
setTimeout(()=>document.getElementById("saved-img")?.scrollIntoView({behavior:"smooth"}),100)}
function shareCalcReceipt(){shareReceipt(buildCalcReceiptPNG(),S.carName.trim())}

function carReceipt(id){
const car=S.warehouse.find(c=>c.id===id);if(!car)return;
const du=buildCarReceiptPNG(car);
S.carReceipts[id]=du;S.expandedCar=id;downloadPNG(du,car.name);render()}
function carShare(id){
const car=S.warehouse.find(c=>c.id===id);if(!car)return;
shareReceipt(buildCarReceiptPNG(car),car.name)}
