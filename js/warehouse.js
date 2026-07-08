// ===== WAREHOUSE =====
// Общее сохранение расчёта из калькулятора: на склад (stock) или в прикидки (estimate).
// Прикидка — «примерился к машине с аукциона»: лежит отдельной секцией, не считается
// в «заморожено ₽», в возрасте стока и в статистике, но синхронизируется как обычная машина.
function saveCalcAs(status){if(!S.carName.trim()){alert("Введите название авто");return}
if(S.entries.length===0){alert("Добавьте хотя бы одну позицию");return}
for(const e of S.entries){if(e.currency!=="RUB"&&!(entryRate(e,S.rates)>0)){alert("Проверьте курсы — есть позиции без курса");return}}
const cleanRates={};Object.keys(S.rates).forEach(k=>{cleanRates[k]=numStr(S.rates[k])}); // храним каноничные курсы (точка)
// цена продажи из «Расчёт прибыли» (ручная или по целевой наценке %) → цена для клиента (askPrice, в ₽);
// по ней 👤 ЧЕК КЛИЕНТУ потом шлёт сразу, без формы наценки
const sellRub=pCalc(totR(S.entries,S.rates)).sell;
const askPrice=sellRub>0?String(Math.round(sellRub)):"";
S.warehouse.unshift({id:uid(),name:S.carName.trim(),date:new Date().toISOString(),
rates:cleanRates,eurRate:cleanRates.EUR||"",usdRate:cleanRates.USD||"",
entries:JSON.parse(JSON.stringify(S.entries)),note:"",updatedAt:new Date().toISOString(),
info:normCarInfo(S.carInfo),askPrice,
status,transitCheckAt:status==="transit"?new Date().toISOString():null,
sellPrice:"",sellCurrency:"RUB",sellDate:null,sellRates:null,sellEurRate:"",sellUsdRate:"",history:[]});
addHist(S.warehouse[0],"created",fmt(carCost(S.warehouse[0]))+" ₽"+(status==="estimate"?" · прикидка":status==="transit"?" · в пути":""));
saveWH();cloudUpsert(S.warehouse[0]);
S.carName="";S.entries=[];S.display="0";S.curCat=0;S.showReceipt=false;S.receiptImage=null;S.sellPrice="";S.editingEntry=null;
S.carInfo=normCarInfo(null);
S.expandedCar=S.warehouse[0].id;saveDraft();render();
setTimeout(()=>document.getElementById(status==="estimate"?"est-section":status==="transit"?"transit-section":"wh-section")?.scrollIntoView({behavior:"smooth"}),150)}
function addToWH(){saveCalcAs("stock")}
function addEstimate(){saveCalcAs("estimate")}
function addTransit(){saveCalcAs("transit")}
// Прикидка стала реальной покупкой: дата покупки = сегодня (прикидка могла висеть неделями,
// а возраст стока и «заморожено» должны считаться от покупки; дату можно поправить в ПРАВКЕ)
function estToStock(id){const car=S.warehouse.find(c=>c.id===id);if(!car||car.status!=="estimate")return;
S.rateApply=null;const oldDate=car.date;
car.status="stock";car.date=new Date().toISOString();
addHist(car,"edited","прикидка → на склад");
touch(car);saveWH();cloudUpsert(car);render();
showToast("Машина на складе","Отменить",()=>{const c=S.warehouse.find(x=>x.id===id);if(!c)return;
if(Array.isArray(c.history))c.history.pop(); // убираем событие перехода, добавленное этим действием
c.status="estimate";c.date=oldDate;touch(c);saveWH();cloudUpsert(c);render()})}

// Прикидка → в пути: машину купил, едет. Дата = момент отправки; заводим метку напоминания.
function estToTransit(id){const car=S.warehouse.find(c=>c.id===id);if(!car||car.status!=="estimate")return;
S.rateApply=null;const oldDate=car.date;
car.status="transit";car.date=new Date().toISOString();car.transitCheckAt=car.date;
addHist(car,"edited","прикидка → в пути");
touch(car);saveWH();cloudUpsert(car);render();
showToast("Машина в пути","Отменить",()=>{const c=S.warehouse.find(x=>x.id===id);if(!c)return;
if(Array.isArray(c.history))c.history.pop(); // убираем событие перехода, добавленное этим действием
c.status="estimate";c.date=oldDate;c.transitCheckAt=null;touch(c);saveWH();cloudUpsert(c);render()})}

// Со склада обратно в прикидки (ошибочно оформил как покупку). Дату не трогаем.
function stockToEstimate(id){const car=S.warehouse.find(c=>c.id===id);if(!car||car.status!=="stock")return;
S.rateApply=null;
car.status="estimate";car.transitCheckAt=null;
addHist(car,"edited","склад → прикидка");
touch(car);saveWH();cloudUpsert(car);render();
showToast("Машина в прикидках","Отменить",()=>{const c=S.warehouse.find(x=>x.id===id);if(!c)return;
if(Array.isArray(c.history))c.history.pop(); // убираем событие перехода, добавленное этим действием
c.status="stock";touch(c);saveWH();cloudUpsert(c);render()})}

// Со склада в путь (ещё не приехала). Дата = момент отправки, заводим метку напоминания.
function stockToTransit(id){const car=S.warehouse.find(c=>c.id===id);if(!car||car.status!=="stock")return;
S.rateApply=null;const oldDate=car.date;
car.status="transit";car.date=new Date().toISOString();car.transitCheckAt=car.date;
addHist(car,"edited","склад → в пути");
touch(car);saveWH();cloudUpsert(car);render();
showToast("Машина в пути","Отменить",()=>{const c=S.warehouse.find(x=>x.id===id);if(!c)return;
if(Array.isArray(c.history))c.history.pop(); // убираем событие перехода, добавленное этим действием
c.status="stock";c.date=oldDate;c.transitCheckAt=null;touch(c);saveWH();cloudUpsert(c);render()})}

// В пути → на склад: машина пришла. Дата покупки/поступления = сегодня (дальше как обычный сток).
function transitToStock(id){const car=S.warehouse.find(c=>c.id===id);if(!car||car.status!=="transit")return;
S.rateApply=null;const oldDate=car.date,oldCheck=car.transitCheckAt;
car.status="stock";car.date=new Date().toISOString();car.transitCheckAt=null;
addHist(car,"edited","в пути → на склад (пришла)");
touch(car);saveWH();cloudUpsert(car);render();
showToast("Машина пришла — на складе","Отменить",()=>{const c=S.warehouse.find(x=>x.id===id);if(!c)return;
if(Array.isArray(c.history))c.history.pop(); // убираем событие перехода, добавленное этим действием
c.status="transit";c.date=oldDate;c.transitCheckAt=oldCheck;touch(c);saveWH();cloudUpsert(c);render()})}

// Еженедельное напоминание (в приложении, при открытии): для машин «в пути» старше недели с последней
// отметки спрашиваем «пришла или ещё в пути?». Очередь — по одной машине.
function checkTransitReminders(){
const WEEK=7*864e5;
const due=S.warehouse.filter(c=>c.status==="transit"&&Date.now()-(Date.parse(c.transitCheckAt||c.date)||0)>=WEEK);
askTransit(due,0)}
function askTransit(list,i){if(!list||i>=list.length)return;
// не перебиваем уже открытый диалог (напр. смены владельца облака) — ждём, пока закроют
if(S.confirmAction){setTimeout(()=>askTransit(list,i),600);return}
const car=list[i];const days=Math.max(0,Math.floor((Date.now()-(Date.parse(car.date)||Date.now()))/864e5));
showConfirm(`🚚 «${car.name}» в пути уже ${days} дн. Машина пришла или ещё едет?`,
()=>{transitToStock(car.id);setTimeout(()=>askTransit(list,i+1),120)},
()=>{const c=S.warehouse.find(x=>x.id===car.id);if(c&&c.status==="transit"){c.transitCheckAt=new Date().toISOString();touch(c);saveWH();cloudUpsert(c)}setTimeout(()=>askTransit(list,i+1),120)},
{yes:"✅ Пришла",no:"🚚 Ещё в пути",yesClass:"btn-green"})}

function startSell(id){S.sellingCarId=id;S.editingCarId=null;S.sellEditMode=false;S.clientQuote=null;S.rateApply=null;S.sellFormPrice="";S.sellFormCurr="RUB";
S.sellFormRate="";S.sellFormDate=todayStr();render()}
function cancelSell(){S.sellingCarId=null;S.sellEditMode=false;render()}
// смена валюты в форме продажи. Новая продажа — подставляем курс «сегодня». ПРАВКА — курс СДЕЛКИ
// для своей валюты, иначе пусто (не затираем историю курсом калькулятора; см. validateSaleForm)
function setSellFormCur(id,c){if(S.sellFormCurr===c)return;S.sellFormCurr=c;
if(S.sellEditMode){const car=S.warehouse.find(x=>x.id===id);
S.sellFormRate=(car&&c===car.sellCurrency&&c!=="RUB")?String(carSellRate(car)||""):""}
else S.sellFormRate=S.rates[c]||"";
render()}
// общая валидация и запись формы продажи (используют и продажа, и правка цены)
function validateSaleForm(){
if(!(parseRub(S.sellFormPrice)>0)){alert("Введите цену продажи");return false}
// При ПРАВКЕ продажи не подставляем курс из калькулятора (S.rates — это курс «сегодня», а не
// курс той сделки): пустое поле → ошибка, иначе исторический курс тихо затрётся текущим.
// При НОВОЙ продаже дефолт из S.rates уместен (сделка сегодняшняя).
const sRate=S.sellFormRate||(S.sellEditMode?"":S.rates[S.sellFormCurr])||"";
if(S.sellFormCurr!=="RUB"&&!(parseNum(sRate)>0)){alert("Введите курс продажи");return false}
return true}
// дата продажи из формы: yyyy-mm-dd → ISO (полдень выбранного дня, без сдвига пояса);
// пустая/битая → fallback (при продаже — сейчас, при правке — прежняя дата)
function sellFormDateISO(fb){
if(!/^\d{4}-\d{2}-\d{2}$/.test(S.sellFormDate||""))return fb;
const d=new Date(S.sellFormDate+"T12:00:00");return isNaN(d)?fb:d.toISOString()}
function applySaleForm(car){
car.sellPrice=String(parseRub(S.sellFormPrice)||0);car.sellCurrency=S.sellFormCurr; // целые единицы («500,000»=500000, не 500)
// правка продажи: без фолбэка на курс калькулятора (см. validateSaleForm), чтобы не затереть курс сделки
const sRate=S.sellFormRate||(S.sellEditMode?"":S.rates[S.sellFormCurr])||"";
car.sellRates={};
if(S.sellFormCurr!=="RUB")car.sellRates[S.sellFormCurr]=numStr(sRate);
// зеркала для совместимости со старыми версиями
car.sellEurRate=car.sellRates.EUR||"";car.sellUsdRate=car.sellRates.USD||""}
// краткая запись о продаже для истории/деталей: «1 500 000 ₽» или «20 000 € → 1 904 048 ₽»
function saleStr(car){const s=curInfo(car.sellCurrency);const p=fmt(parseNum(car.sellPrice)||0)+" "+s.symbol;
return car.sellCurrency!=="RUB"?p+" → "+fmt(carSellRub(car))+" ₽":p}
function doSell(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
if(!validateSaleForm())return;
S.rateApply=null;
applySaleForm(car);car.status="sold";car.sellDate=sellFormDateISO(new Date().toISOString());
addHist(car,"sold",saleStr(car));
S.sellingCarId=null;S.sellEditMode=false;touch(car);saveWH();cloudUpsert(car);render()}
// изменить цену уже проданной: статус и дату продажи не трогаем
function startEditSale(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.sellingCarId=id;S.sellEditMode=true;S.editingCarId=null;S.clientQuote=null;S.rateApply=null;
S.sellFormPrice=String(car.sellPrice||"");S.sellFormCurr=car.sellCurrency||"RUB";
S.sellFormRate=car.sellCurrency!=="RUB"?String(carSellRate(car)||""):"";
S.sellFormDate=car.sellDate?isoToDateInput(car.sellDate):todayStr();render()}
function saveSaleEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car||car.status!=="sold")return;
if(!validateSaleForm())return;
const was=saleStr(car),wasD=car.sellDate; // фиксируем «было» до применения новых значений
applySaleForm(car);
car.sellDate=sellFormDateISO(car.sellDate); // продал вчера, внёс сегодня — правится и дата
const now=saleStr(car),dCh=isoToDateInput(wasD||"")!==isoToDateInput(car.sellDate||"");
if(now!==was||dCh)addHist(car,"priceEdit",
(now!==was?was+" → "+now:"")+(dCh?(now!==was?" · ":"")+"дата: "+(wasD?dShort(wasD):"—")+" → "+(car.sellDate?dShort(car.sellDate):"—"):""));
S.sellingCarId=null;S.sellEditMode=false;touch(car);saveWH();cloudUpsert(car);render()}
function delCar(id){showConfirm("Удалить машину из базы?",()=>{
const idx=S.warehouse.findIndex(c=>c.id===id);if(idx<0)return;
const removed=S.warehouse[idx];const receipt=S.carReceipts[id];
S.warehouse.splice(idx,1);cloudDelete(id);
if(S.expandedCar===id)S.expandedCar=null;if(S.clientQuote&&S.clientQuote.id===id)S.clientQuote=null;S.rateApply=null;delete S.carReceipts[id];saveWH();render();
showToast("Машина удалена","Отменить",()=>{
S.warehouse.splice(Math.min(idx,S.warehouse.length),0,removed);
if(receipt)S.carReceipts[id]=receipt;touch(removed);cloudUpsert(removed);saveWH();render()})})}
function retStock(id){showConfirm("Вернуть машину на склад? Данные продажи будут стёрты.",()=>{
const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.sellingCarId=null;S.sellEditMode=false;S.rateApply=null; // закрыть форму правки цены, иначе СОХРАНИТЬ запишет данные продажи на сток
car.status="stock";car.sellPrice="";car.sellCurrency="RUB";car.sellDate=null;
car.sellRates=null;car.sellEurRate="";car.sellUsdRate="";
addHist(car,"returned","");
touch(car);saveWH();cloudUpsert(car);render()})}
function togExp(id){S.expandedCar=S.expandedCar===id?null:id;S.sellingCarId=null;S.sellEditMode=false;S.histOpen=false;S.clientQuote=null;S.rateApply=null;S.listBuilder=null;
if(S.editingCarId!==id)S.editingCarId=null;render()}
function togHist(){S.histOpen=!S.histOpen;render()}

// ===== ЦЕНА ДЛЯ КЛИЕНТА ПЕРЕД ОТПРАВКОЙ ЧЕКА (сток/прикидка) =====
// Форма: наценка % и/или +₽ к себестоимости, либо цена вручную. При отправке пишем событие
// «quoted» в историю машины (какую цену и когда отправили) — навсегда, для сверки с клиентом.
function openClientQuote(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
// цена для клиента уже задана (из «Расчёт прибыли», СПИСКА или прежней отправки) → шлём чек СРАЗУ, без формы наценки
if(parseNum(car.askPrice)>0){carClientShare(id);return}
// цены нет → форма: наценка % / +₽ / вручную
S.sellingCarId=null;S.sellEditMode=false;S.editingCarId=null;S.expandedCar=id;
S.clientQuote={id,pct:"",add:"",price:"",save:true};render()}
function closeClientQuote(){S.clientQuote=null;render()}
// живой предпросмотр итога (частичная перерисовка — фокус в поле цены не теряется)
function rClientQuotePv(){const el=document.getElementById("cq-pv");if(!el||!S.clientQuote)return;
const p=parseRub(S.clientQuote.price);el.textContent=p>0?"Итог клиенту: "+fmt(p)+" ₽":"—"}
// «→ РАССЧИТАТЬ»: себестоимость × (1+%/100) + ₽ сверху → в поле цены (та же математика, что в «СПИСОК»)
function calcClientQuote(id){const car=S.warehouse.find(c=>c.id===id);const q=S.clientQuote;if(!car||!q)return;
const cost=carCost(car);const p=lbNum(q.pct),a=parseRub(q.add); // % допускает дробь/скидку; +₽ — целые рубли (500,000 = 500 000)
const hasP=isFinite(p)&&p>-100,hasA=isFinite(a)&&a>0;
if(!hasP&&!hasA){alert("Введите наценку % или сумму +₽ сверху (или впишите цену вручную)");return}
const v=Math.max(0,Math.round(cost*(1+(hasP?p:0)/100)+(hasA?a:0)));
if(!(v>0)){alert("Не получилось рассчитать (себестоимость 0 — нет курсов?). Впишите цену вручную.");return}
q.price=String(v);render()}
// Отправка/скачивание чека клиенту с этой ценой + запись в историю. dl=true — скачать, иначе поделиться.
function sendClientQuote(id,dl){const car=S.warehouse.find(c=>c.id===id);const q=S.clientQuote;if(!car||!q)return;
const price=parseRub(q.price)||0;        // целые рубли: «500,000» = 500 000, а не 500
if(!(price>0)){alert("Введите цену клиенту или рассчитайте по наценке %");return}
if(q.save)car.askPrice=String(price);    // запомнить в карточке (иначе карточку не трогаем)
// чек рисуем по цене; для разового режима — по клону, чтобы НЕ мутировать карточку (и не оставить цену при сбое рисования)
const du=drawClientReceiptPNG(q.save?car:{...car,askPrice:String(price)});
pushQuoteHist(car,price);                // след в истории (дедуп одинаковых подряд)
touch(car);saveWH();cloudUpsert(car);    // сохраняем: цена в карточке и/или новое событие истории
S.clientQuote=null;
if(dl)downloadPNG(du,car.name+" клиенту");else shareReceipt(du,car.name+" клиенту");
render()}

// ===== МАССОВОЕ ПРИМЕНЕНИЕ РЫНОЧНОГО КУРСА (стоки + прикидки) =====
// Перебивает курс ВСЕХ валютных позиций выбранных машин на рыночный (Камкомбанк, можно поправить) —
// себестоимость пересчитывается. С подтверждением и отменой (снимок машин).
// scope: "stock" (склад) или "estimate" (прикидки) — курс применяем раздельно, не смешивая
function raCars(scope){return S.warehouse.filter(c=>scope?c.status===scope:(c.status==="stock"||c.status==="estimate"))}
const raR4=x=>String(Math.round(x*1e4)/1e4); // курс рынка → 4 знака (как applyMarket)
function openRateApply(scope){scope=scope==="estimate"?"estimate":"stock";const cars=raCars(scope);
if(!cars.length){alert(scope==="estimate"?"Нет прикидок":"Склад пуст");return}
if(!cars.some(c=>c.entries.some(e=>e.currency!=="RUB"))){alert("Нет валютных позиций — курс применять не к чему");return}
// панели/режимы взаимоисключаемы: открытая правка + применение курса иначе откатят друг друга
S.listBuilder=null;S.clientQuote=null;S.editingCarId=null;S.editCarEntries=null;S.sellingCarId=null;S.sellEditMode=false;
const mk=marketRates();
S.rateApply={scope,fromMarket:!!(mk&&mk.usd>0),rates:{USD:mk&&mk.usd>0?raR4(mk.usd):(numStr(S.rates.USD)||""),EUR:mk&&mk.eur>0?raR4(mk.eur):(numStr(S.rates.EUR)||"")},
items:cars.map(c=>({id:c.id,off:false}))};
render();
// рынок не прогрет — тянем в фоне; НЕ перетираем, если пользователь уже печатает в поле (как prefetchRates)
if(!mk&&navigator.onLine!==false)loadMarketShared().then(()=>{const m=marketRates();
if(m&&m.usd>0&&S.rateApply){const a=document.activeElement,busy=a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName);
if(!busy){S.rateApply.rates.USD=raR4(m.usd);if(m.eur>0)S.rateApply.rates.EUR=raR4(m.eur);S.rateApply.fromMarket=true;render()}}}).catch(()=>{});
setTimeout(()=>document.getElementById("rate-apply")?.scrollIntoView({behavior:"smooth",block:"start"}),100)}
function closeRateApply(){S.rateApply=null;render()}
function raRefresh(){if(!S.rateApply)return;
loadMarketShared().then(()=>{const m=marketRates();
if(m&&m.usd>0&&S.rateApply){S.rateApply.rates.USD=raR4(m.usd);if(m.eur>0)S.rateApply.rates.EUR=raR4(m.eur);S.rateApply.fromMarket=true;render()}
else alert("Рыночный курс недоступен — попробуйте позже или впишите вручную")}).catch(()=>alert("Не удалось получить рыночный курс"))}
function raToggle(id,on){const it=S.rateApply&&S.rateApply.items.find(x=>x.id===id);if(it){it.off=!on;render()}}
function raAll(on){if(!S.rateApply)return;S.rateApply.items.forEach(it=>it.off=!on);render()}
// себестоимость машины при курсах из панели: валютная позиция — по панели (если задан), иначе прежний курс
function raNewCost(car){const pr=S.rateApply?S.rateApply.rates:{};
return car.entries.reduce((s,e)=>{if(e.currency==="RUB")return s+e.amount;
const rp=parseNum(pr[e.currency]);const r=rp>0?rp:entryRate(e,carRates(car));
return s+e.amount*(r>0?r:0)},0)}
// применится ли рыночный курс к машине при текущих полях (есть валютная позиция под заданный курс)
function raWillApply(car,pr){return car.entries.some(e=>e.currency!=="RUB"&&pr[e.currency]>0)}
function raPr(){const r={};const u=parseNum(S.rateApply.rates.USD),e=parseNum(S.rateApply.rates.EUR);if(u>0)r.USD=u;if(e>0)r.EUR=e;return r}
// живой пересчёт превью и счётчика кнопки при правке курса (без полного render — фокус в поле не теряется)
function rRateApplyPv(){if(!S.rateApply)return;const pr=raPr();let n=0;
S.rateApply.items.forEach(it=>{const car=S.warehouse.find(c=>c.id===it.id);if(!car)return;
if(!it.off&&raWillApply(car,pr))n++;
if(!car.entries.some(e=>e.currency!=="RUB"))return;
const nc=document.getElementById("ra-nc-"+it.id),dl=document.getElementById("ra-d-"+it.id);
const cur=carCost(car),nw=raNewCost(car),d=Math.round(nw)-Math.round(cur);
if(nc)nc.textContent=fmt(Math.round(nw))+" ₽";
if(dl){dl.textContent=d?(d>0?"+":"")+fmt(d)+" ₽":"";dl.style.color=d>0?"var(--neg)":d<0?"var(--pos)":"var(--t4)"}});
const cEl=document.getElementById("ra-count");if(cEl)cEl.textContent=n}
function raApply(){const ra=S.rateApply;if(!ra)return;
const rUSD=parseNum(ra.rates.USD),rEUR=parseNum(ra.rates.EUR);
if(!(rUSD>0)&&!(rEUR>0)){alert("Введите рыночный курс (USD и/или EUR)");return}
const pr={};if(rUSD>0)pr.USD=rUSD;if(rEUR>0)pr.EUR=rEUR;
const sel=ra.items.filter(it=>!it.off).map(it=>S.warehouse.find(c=>c.id===it.id)).filter(Boolean)
.filter(c=>raWillApply(c,pr));
if(!sel.length){alert("Нет отмеченных машин с валютными позициями под этот курс");return}
showConfirm(`Применить рыночный курс к ${sel.length} маш.? Курс всех валютных позиций будет перебит, себестоимость пересчитается.`,()=>{
const undo=[]; // снимок только реально изменённых машин
sel.forEach(car=>{const old=carCost(car);
// «было» берём из самих позиций (e.rate) — как показывает чип и как считает себестоимость; car.rates мог отстать
const oldR={};car.entries.forEach(e=>{if(e.currency!=="RUB"&&!(e.currency in oldR)){const v=numStr(e.rate);if(v)oldR[e.currency]=v}});
const before={id:car.id,entries:JSON.parse(JSON.stringify(car.entries)),rates:{...(car.rates||{})},
eurRate:car.eurRate,usdRate:car.usdRate,history:JSON.parse(JSON.stringify(car.history||[]))};
let mut=false;
car.entries.forEach(e=>{if(e.currency!=="RUB"&&pr[e.currency]>0){const nr=numStr(pr[e.currency]);if(e.rate!==nr){e.rate=nr;mut=true}}});
// car.rates — только для валют, реально используемых машиной (не затираем чужие фолбэки — напр. EUR у USD-only машины)
if(!car.rates)car.rates={};const used=new Set(car.entries.map(e=>e.currency));
Object.keys(pr).forEach(k=>{if(used.has(k)){const nr=numStr(pr[k]);if(car.rates[k]!==nr){car.rates[k]=nr;mut=true}}});
car.eurRate=car.rates.EUR||"";car.usdRate=car.rates.USD||"";
if(!mut)return; // курс уже такой — не пишем историю и не синкаем
undo.push(before);
const nw=carCost(car),d=Math.round(nw)-Math.round(old);
// показываем какой курс был → стал (по каждой применённой валюте)
const sym={USD:"$",EUR:"€"},rc=[];["USD","EUR"].forEach(k=>{if(pr[k]>0&&used.has(k)){const o=numStr(oldR&&oldR[k]||""),n=numStr(pr[k]);if(o!==n)rc.push((sym[k])+" "+(o?fmtRate(Number(o)):"—")+"→"+fmtRate(Number(n)))}});
addHist(car,"edited","рыночный курс"+(rc.length?" "+rc.join(", "):"")+": "+fmt(nw)+" ₽"+(d?" ("+(d>0?"+":"")+fmt(d)+")":""));
touch(car);cloudUpsert(car)});
saveWH();S.rateApply=null;render();
if(!undo.length){showToast("Курс уже такой — ничего не изменилось");return}
showToast("Курс применён к "+undo.length+" маш.","Отменить",()=>{
undo.forEach(s=>{const c=S.warehouse.find(x=>x.id===s.id);if(!c)return;
c.entries=s.entries;c.rates=s.rates;c.eurRate=s.eurRate;c.usdRate=s.usdRate;c.history=s.history;
touch(c);cloudUpsert(c)}); // touch (не старый updatedAt) — иначе отмена проиграет LWW другому устройству
saveWH();render()})})}
function rateApplyHTML(forScope){const ra=S.rateApply;if(!ra)return"";
if(forScope&&ra.scope!==forScope)return""; // панель показываем в своём разделе (склад/прикидки)
const byId={};raCars(ra.scope).forEach(c=>byId[c.id]=c);
const items=ra.items.filter(it=>byId[it.id]);
const pr=raPr();
const nSel=items.filter(it=>!it.off&&raWillApply(byId[it.id],pr)).length;
let h=`<div class="coll-box" id="rate-apply"><div class="coll-header" style="cursor:default"><span>🏦 Рыночный курс → ${ra.scope==="estimate"?"прикидкам":"складу"}</span></div>
<div class="coll-body">
<div style="color:var(--t3);font-size:10px;line-height:1.5;margin-bottom:8px">Курс с рынка (Камкомбанк) — можно поправить. Применяется ко ВСЕМ валютным позициям отмеченных машин; себестоимость пересчитается (с отменой).</div>
${!ra.fromMarket?`<div style="color:var(--warn);font-size:10px;margin-bottom:8px">⚠ Рыночный курс не загрузился — в полях подставлены текущие курсы калькулятора. Жми «↻ РЫНОК» или впиши вручную.</div>`:""}
<div class="bulk-rate-row">
<div class="bulk-rate-field"><label class="edit-lbl">$ USD / ₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" value="${esc(ra.rates.USD)}" oninput="S.rateApply.rates.USD=this.value;rRateApplyPv()"></div>
<div class="bulk-rate-field"><label class="edit-lbl">€ EUR / ₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" value="${esc(ra.rates.EUR)}" oninput="S.rateApply.rates.EUR=this.value;rRateApplyPv()"></div>
<div class="bulk-apply" onclick="raRefresh()">↻ РЫНОК</div></div>
<div class="sort-row" style="margin-bottom:4px"><div class="sort-chip" onclick="raAll(true)">✓ ВСЕ</div><div class="sort-chip" onclick="raAll(false)">СНЯТЬ</div></div>`;
items.forEach(it=>{const car=byId[it.id];const cur=carCost(car);const willApply=raWillApply(car,pr);const nw=raNewCost(car);const d=Math.round(nw)-Math.round(cur);
const hasFx=car.entries.some(e=>e.currency!=="RUB");
h+=`<div class="edit-entry-card" style="padding:8px 10px;${it.off?"opacity:.5":""}">
<label style="display:flex;align-items:center;gap:8px;cursor:pointer">
<input type="checkbox" ${it.off?"":"checked"} onchange="raToggle('${esc(car.id)}',this.checked)">
<span style="flex:1;min-width:0;color:var(--t0);font-weight:600">🚗 ${esc(car.name)}${car.status==="estimate"?` · <span style="color:var(--t3);font-weight:400">прикидка</span>`:""}</span></label>
<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;margin-top:5px;padding-left:26px">
<span style="color:var(--t4)">${fmt(cur)} ₽${willApply?` → <b id="ra-nc-${esc(car.id)}" style="color:var(--gold)">${fmt(Math.round(nw))} ₽</b>`:` <span style="color:var(--t4)">(${hasFx?"нет курса для валюты":"нет валютных"})</span>`}</span>
${willApply?`<span id="ra-d-${esc(car.id)}" style="color:${d>0?"var(--neg)":d<0?"var(--pos)":"var(--t4)"}">${d?(d>0?"+":"")+fmt(d)+" ₽":""}</span>`:""}</div></div>`});
h+=`<div style="display:flex;gap:8px;margin-top:8px">
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="raApply()">✅ ПРИМЕНИТЬ (<span id="ra-count">${nSel}</span>)</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 16px" onclick="closeRateApply()">✕</div></div>
</div></div>`;
return h}
function cpToCalc(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
const doCopy=()=>{
S.carName=car.name;
S.carInfo=normCarInfo(car.info); // данные авто (VIN, цвета, год) едут вместе с расчётом
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
// ISO-строка → yyyy-mm-dd для input[type=date] (локальный день, без сдвига пояса)
function isoToDateInput(iso){try{const d=new Date(iso);if(isNaN(d))return"";
const p=n=>String(n).padStart(2,"0");return d.getFullYear()+"-"+p(d.getMonth()+1)+"-"+p(d.getDate())}catch(e){return""}}
function carDateInput(car){return isoToDateInput(car.date)}
// Человекочитаемый дифф правки для истории: что именно менялось (курсы валют, суммы позиций,
// добавленные/удалённые позиции). Возвращает массив коротких строк «поле: было→стало».
function editDiffNote(oldE,newE){
const sym={USD:"$",EUR:"€"};const parts=[];
// курс валюты берём из самих позиций (e.rate) — там правится в редакторе, не в car.rates
const ratesOf=arr=>{const r={};(arr||[]).forEach(e=>{if(e.currency&&e.currency!=="RUB"&&!(e.currency in r)){const v=numStr(e.rate);if(v)r[e.currency]=v}});return r};
const oR=ratesOf(oldE),nR=ratesOf(newE);
["USD","EUR"].forEach(c=>{const o=oR[c]||"",n=nR[c]||"";
if(o!==n&&(o||n))parts.push("курс "+(sym[c]||c)+" "+(o?fmtRate(Number(o)):"—")+"→"+(n?fmtRate(Number(n)):"—"))});
// позиции — сопоставляем по названию (label), запасной ключ — категория.
// Очередь старых на каждый ключ: дубли одного названия (две «Прочие расходы») мэтчим по ПОРЯДКУ.
const key=e=>(e.label||e.category||"позиция");
const oldByKey={};(oldE||[]).forEach(e=>{(oldByKey[key(e)]=oldByKey[key(e)]||[]).push(e)});
(newE||[]).forEach(e=>{const k=key(e);const o=(oldByKey[k]||[]).shift();
const cur=e.currency==="RUB"?"₽":(sym[e.currency]||e.currency);
const na=Math.round(parseNum(e.amount));
if(!o)parts.push("+ "+k+": "+fmt(na)+" "+cur);
else{const oa=Math.round(parseNum(o.amount));if(oa!==na)parts.push(k+": "+fmt(oa)+"→"+fmt(na)+" "+cur)}});
// не разобранные из очередей = удалённые позиции
Object.keys(oldByKey).forEach(k=>{(oldByKey[k]||[]).forEach(()=>parts.push("− "+k))});
return parts}

function startCarEdit(id){const car=S.warehouse.find(c=>c.id===id);if(!car)return;
S.editingCarId=id;S.sellingCarId=null;S.sellEditMode=false;S.clientQuote=null;S.rateApply=null;S.listBuilder=null;S.expandedCar=id;
S.editName=car.name;S.editDate=carDateInput(car);S.editAskPrice=car.askPrice||"";S.editNote=car.note||"";
S.editInfo=normCarInfo(car.info);
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
// снимок ДО перезаписи — чтобы в истории показать что именно менялось (курсы, суммы позиций).
// rate с тем же фолбэком, что в редакторе (легаси-курс мог лежать в car.rates) — иначе фантом «—→X».
const _ocr=carRates(car);
const oldEntriesSnap=car.entries.map(e=>({label:e.label,category:e.category,amount:e.amount,currency:e.currency,
rate:e.rate||(e.currency==="RUB"?"":(_ocr[e.currency]||""))}));
const oldNameSnap=car.name;
// сигнатура значимых полей (дата — на уровне дня): событие пишем, только если реально что-то изменилось
const sig=c=>JSON.stringify({n:c.name||"",no:c.note||"",a:c.askPrice||"",d:carDateInput(c),e:c.entries,i:c.info||null});
const before=sig(car);
car.entries=S.editCarEntries.map(e=>{const{_new,...rest}=e;
return{...rest,amount:parseNum(e.amount),rate:e.currency==="RUB"?"":numStr(e.rate)}});
// ресинк карты курсов машины из позиций (иначе car.rates устаревает → cpToCalc/raApply берут старый курс)
car.rates=car.rates||{};car.entries.forEach(e=>{if(e.currency!=="RUB"&&e.rate)car.rates[e.currency]=e.rate});
car.eurRate=car.rates.EUR||"";car.usdRate=car.rates.USD||"";
car.name=S.editName.trim();
car.note=String(S.editNote||"").trim().slice(0,500);
car.info=normCarInfo(S.editInfo);
const ap=parseRub(S.editAskPrice);car.askPrice=ap>0?String(ap):""; // целые рубли («500,000»=500000)
// пустую/битую дату не трогаем; иначе фиксируем полдень выбранного дня (без сдвига пояса)
if(/^\d{4}-\d{2}-\d{2}$/.test(S.editDate||"")){const d=new Date(S.editDate+"T12:00:00");if(!isNaN(d))car.date=d.toISOString()}
if(sig(car)!==before){const newCost=carCost(car);const dCost=Math.round(newCost)-Math.round(oldCost); // дельта на уровне ₽
const parts=editDiffNote(oldEntriesSnap,car.entries); // что именно менялось (курсы из позиций, суммы)
if(car.name!==oldNameSnap)parts.unshift("название");
let det=parts.join(" · ");if(det.length>88)det=det.slice(0,87)+"…"; // оставляем место для итоговой суммы (лимит 120)
addHist(car,"edited",(det?det+" · ":"")+fmt(newCost)+" ₽"+(dCost?" ("+(dCost>0?"+":"")+fmt(dCost)+")":""));}
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
del.style.color=diff>0?"var(--neg)":diff<0?"var(--pos)":"var(--t4)"}}
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
// выбор цвета кузова/салона в правке машины (свотч или палитра); "" — сброс. Пишется в car при СОХРАНИТЬ.
function setEditColor(field,hex){if(!S.editInfo)return;S.editInfo[field]=normColor(hex);S.colorOpen=null;render()}

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
if(!stk.length)return `<div class="empty-state"><div class="em-icon">🏭</div><div class="em-text">${S.whSearch.trim()?"Ничего не найдено":"Склад пуст"}<br><span style="color:var(--t5);font-size:11px">${S.whSearch.trim()?"Поправьте запрос":"Добавьте машину через калькулятор"}</span></div></div>`;
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
<div class="backup-btn" onclick="openListBuilder()">📤 СПИСОК</div></div>`;
h+=listBuilderHTML();
h+=rateApplyHTML("stock");
if(stk.length)h+=`<div class="stats-bar">
<div class="stat-card"><div class="stat-num gold">${fmt(frozen)}</div><div class="stat-lbl">ЗАМОРОЖЕНО ₽</div></div>
<div class="stat-card"><div class="stat-num blue">${avgAge}</div><div class="stat-lbl">СР. ДНЕЙ НА СКЛАДЕ</div></div></div>`;
if(S.warehouse.length)h+=`<input type="text" class="wh-search" placeholder="🔍 Поиск по названию" value="${esc(S.whSearch)}" oninput="S.whSearch=this.value;rLists()">
<div class="sort-row">${[["new","СНАЧАЛА НОВЫЕ"],["old","СТАРЫЕ"],["exp","ДОРОЖЕ"],["cheap","ДЕШЕВЛЕ"]].map(([k,lbl])=>`<div class="sort-chip ${S.whSort===k?"active":""}" onclick="S.whSort='${k}';render()">${lbl}</div>`).join("")}<div class="sort-chip rate-chip" onclick="openRateApply('stock')">🏦 КУРС РЫНКА</div></div>`;
h+=`<div id="wh-list">${stockListHTML()}</div>`;
return h}

function estHTML(){
const est=S.warehouse.filter(c=>c.status==="estimate");
if(!est.length)return ""; // нет прикидок — секцию не показываем вовсе
let h=`<div class="section-divider est" id="est-section"><span>📝 Прикидки (${est.length})</span></div>`;
// отдельная кнопка курса рынка для прикидок (не смешивается со складом) — только если есть валютные позиции
if(est.some(c=>c.entries.some(e=>e.currency!=="RUB")))
h+=`<div class="sort-row" style="justify-content:flex-end;margin-bottom:8px"><div class="sort-chip rate-chip" onclick="openRateApply('estimate')">🏦 КУРС РЫНКА</div></div>`;
h+=rateApplyHTML("estimate");
h+=est.map(c=>carCardHTML(c)).join("");
return h}

function transitHTML(){
const tr=S.warehouse.filter(c=>c.status==="transit");
if(!tr.length)return ""; // нет машин в пути — секцию не показываем
let h=`<div class="section-divider transit" id="transit-section"><span>🚚 В пути (${tr.length})</span></div>`;
h+=tr.map(c=>carCardHTML(c)).join("");
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

// Подсветка зависшего стока: 60+ дней — оранжево ⏳, 90+ — красно 🔥 (деньги заморожены слишком долго)
function staleDaysHTML(car){const d=daysBetween(car.date,new Date());
const c=d>=90?"var(--neg)":d>=60?"var(--warn)":"";
return c?` · <span style="color:${c};font-weight:700">${d} дн. на складе ${d>=90?"🔥":"⏳"}</span>`:` · ${d} дн. на складе`}
// зафиксированный курс машины по валютам (из позиций): {USD:80.39, EUR:92.1}. Первый непустой курс на валюту
// (после «курса рынка» они единые). RUB-only машина → пусто.
function carFixRates(car){const by={};(car.entries||[]).forEach(e=>{
if(e.currency&&e.currency!=="RUB"&&by[e.currency]===undefined){const r=parseNum(e.rate);if(r>0)by[e.currency]=r}});return by}
function carRateChipHTML(car){const by=carFixRates(car);const sym={USD:"$",EUR:"€"};
const parts=["USD","EUR"].filter(c=>by[c]>0).map(c=>`${sym[c]} ${fmtRate(by[c])}`);
Object.keys(by).forEach(c=>{if(c!=="USD"&&c!=="EUR"&&by[c]>0)parts.push(`${c} ${fmtRate(by[c])}`)});
return parts.length?`<span class="wh-rate-chip">💱 ${parts.join(" · ")}</span>`:""}
function carCardHTML(car){
const cost=carCost(car),exp=S.expandedCar===car.id,selling=S.sellingCarId===car.id,editing=S.editingCarId===car.id;
const sellR=carSellRub(car),pr=sellR-cost;
const rateChip=carRateChipHTML(car); // зафиксированный за позициями курс — под ценой справа
const mk=cost>0?marketRates():null; // справочный эквивалент цены в валюте по рыночному курсу банка
let h=`<div class="wh-card ${car.status==="sold"?"sold":""}"><div class="wh-card-header" onclick="togExp('${esc(car.id)}')">
<div style="min-width:0"><div class="wh-car-name">🚗 ${esc(car.name)}</div>
<div class="wh-card-sub"><span class="wh-status ${car.status}">${car.status==="stock"?"СКЛАД":car.status==="estimate"?"ПРИКИДКА":car.status==="transit"?"В ПУТИ":"ПРОДАНО"}</span><span>${dShort(car.date)}${car.status==="stock"?staleDaysHTML(car):""}</span></div>
${(()=>{const vin=car.info&&car.info.vin?`<span class="wh-vin-chip"># ${esc(car.info.vin)}</span>`:"",cols=car.info&&carColorsHTML(car.info,false)?`<span class="wh-meta-colors">${carColorsHTML(car.info,false)}</span>`:"";
return(vin||cols)?`<div class="wh-card-meta">${vin}${cols}</div>`:""})()}</div>
<div style="text-align:right"><div class="wh-car-cost">${fmt(cost)} ₽</div>
${mk?`<div style="color:var(--t4);font-size:9px;margin-top:1px">≈ ${fmt(cost/mk.usd)} $${mk.eur?` · ${fmt(cost/mk.eur)} €`:""}</div>`:""}
${rateChip?`<div style="margin-top:4px">${rateChip}</div>`:""}
${car.status==="sold"?`<div style="color:${pr>=0?"var(--pos)":"var(--neg)"};font-size:11px;font-weight:600">${pr>=0?"+":""}${fmt(pr)} ₽</div>`:""}</div></div>`;

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
<div class="edit-field"><label class="edit-lbl">ЗАМЕТКА (контакты, детали — только для себя)</label>
<textarea class="edit-input edit-area" rows="2" maxlength="500" placeholder="пусто" oninput="S.editNote=this.value">${esc(S.editNote)}</textarea></div></div>
<div style="color:var(--t4);font-size:9px;margin-bottom:6px;letter-spacing:.5px">ДАННЫЕ АВТО — попадают в чек клиенту (кроме VIN, он внутренний):</div>
<div class="edit-fields" style="align-items:flex-end;margin-bottom:8px">
<div class="edit-field" style="flex:2"><label class="edit-lbl">VIN (внутренний)</label>
<input type="text" maxlength="20" class="edit-input" placeholder="WBA..." value="${esc(S.editInfo.vin)}" oninput="S.editInfo.vin=this.value"></div>
<div class="bulk-apply" onclick="vinFillEdit()">🔎 ПО VIN</div></div>
<div class="edit-fields" style="margin-bottom:8px">
<div class="edit-field"><label class="edit-lbl">ГОД ВЫПУСКА</label>
<input type="text" inputmode="numeric" maxlength="4" class="edit-input" placeholder="2023" value="${esc(S.editInfo.year)}" oninput="S.editInfo.year=this.value"></div>
<div class="edit-field"><label class="edit-lbl">ОБЪЁМ, Л</label>
<input type="text" inputmode="decimal" maxlength="10" class="edit-input" placeholder="3.5" value="${esc(S.editInfo.vol)}" oninput="S.editInfo.vol=this.value"></div></div>
<div style="margin-bottom:8px"><label class="edit-lbl">ЦВЕТ КУЗОВА</label>${colorPickerHTML("body",S.editInfo.body,"setEditColor","edit:body")}</div>
<div style="margin-bottom:8px"><label class="edit-lbl">ЦВЕТ САЛОНА</label>${colorPickerHTML("inter",S.editInfo.inter,"setEditColor","edit:inter")}</div>
<div class="edit-fields" style="margin-bottom:10px">
<div class="edit-field"><label class="edit-lbl">КОМПЛЕКТАЦИЯ (видит клиент)</label>
<input type="text" maxlength="80" class="edit-input" placeholder="Premium, панорама" value="${esc(S.editInfo.trim)}" oninput="S.editInfo.trim=this.value"></div></div>
<div style="color:var(--t4);font-size:9px;margin-bottom:6px;letter-spacing:.5px">КУРСЫ ПО ФАКТУ ОПЛАТЫ:</div>`;
if(bulkCurs.length){
h+=`<div style="color:var(--t4);font-size:9px;margin-bottom:6px;letter-spacing:.5px">БЫСТРО ПРИМЕНИТЬ КУРС КО ВСЕМ ПОЗИЦИЯМ:</div>`;
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
<div id="edit-cost-diff" style="font-size:9px;color:${editDiff>0?"var(--neg)":editDiff<0?"var(--pos)":"var(--t4)"}">${editDiff===0?"без изменений":(editDiff>0?"+":"")+fmt(editDiff)+" ₽ к исходной"}</div></div></div>
<div style="display:flex;gap:8px">
<div class="btn-action btn-green" style="flex:1;margin:0;font-size:11px;padding:11px 0" onclick="saveCarEdit('${esc(car.id)}')">✅ СОХРАНИТЬ</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:11px 16px;font-size:11px" onclick="cancelCarEdit()">✕ ОТМЕНА</div></div></div>`;
}else if(exp){
// ===== ОБЫЧНЫЙ ПРОСМОТР =====
const cr=carRates(car);
h+=`<div class="wh-detail">
<div style="color:var(--t4);font-size:10px;font-weight:600;margin-bottom:8px;letter-spacing:1px">РАЗБИВКА РАСХОДОВ (курс на дату оплаты)</div>`;
car.entries.forEach(e=>{const cm=curInfo(e.currency);const r=entryRate(e,cr);
const rv=entryRub(e,cr);
h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">${esc(e.icon)} ${esc(e.label)}</span>
<span class="wh-detail-val">${esc(fmt(e.amount))} ${cm.symbol}${e.currency!=="RUB"?" × "+(r?fmtRate(r):"⚠ нет курса")+" = "+fmt(rv)+" ₽":""}</span></div>`});
h+=`<div class="wh-detail-row" style="border-top:2px solid var(--br2);padding-top:8px;margin-top:4px">
<span style="color:var(--gold);font-size:12px;font-weight:700">СЕБЕСТОИМОСТЬ</span>
<span style="color:var(--gold);font-size:15px;font-weight:700;font-variant-numeric:tabular-nums">${fmt(cost)} ₽</span></div>`;
if(mk)h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">💱 В валюте по рынку (${fmtRate(mk.usd)} ₽/$)</span>
<span class="wh-detail-val">≈ ${fmt(cost/mk.usd)} $${mk.eur?` · ${fmt(cost/mk.eur)} €`:""}</span></div>`;
if(car.status==="stock"&&parseNum(car.askPrice)>0)h+=`<div class="wh-detail-row">
<span class="wh-detail-lbl">💰 Цена для клиента</span>
<span class="wh-detail-val">${fmt(parseNum(car.askPrice))} ₽</span></div>`;
const specs=carSpecsStr(car.info);
if(specs||(car.info&&car.info.trim))h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">🔧 Авто</span>
<span class="wh-detail-val">${esc(specs)}${car.info.trim?(specs?" · ":"")+esc(car.info.trim):""}</span></div>`;
if(car.note)h+=`<div class="wh-note">📝 ${esc(car.note)}</div>`;
if(car.status==="sold"){const mg=cost>0?(pr/cost)*100:0,ip=pr>=0;
const sCur=curInfo(car.sellCurrency);
h+=`<div class="wh-detail-row"><span class="wh-detail-lbl">💰 Продажа</span>
<span class="wh-detail-val">${fmt(parseNum(car.sellPrice)||0)} ${sCur.symbol}${car.sellCurrency!=="RUB"?" → "+fmt(sellR)+" ₽":""}</span></div>
${car.sellCurrency!=="RUB"?`<div class="wh-detail-row"><span class="wh-detail-lbl">📈 Курс продажи</span>
<span class="wh-detail-val">${fmtRate(carSellRate(car))} ₽/${sCur.symbol}</span></div>`:""}
<div class="wh-detail-row"><span class="wh-detail-lbl">📊 Прибыль</span>
<span class="wh-detail-val" style="color:${ip?"var(--pos)":"var(--neg)"}">${ip?"+":""}${fmt(pr)} ₽ (${ip?"+":""}${fmtD(mg,1)}%)</span></div>
${car.sellDate?`<div class="wh-detail-row"><span class="wh-detail-lbl">📅 Продана</span>
<span class="wh-detail-val">${dShort(car.sellDate)} · стояла ${daysBetween(car.date,car.sellDate)} дн.</span></div>`:""}`}
h+=`<div class="wh-actions">`;
// ИЕРАРХИЯ: одно золотое действие-деньги (продать/на склад/цена) во всю ширину; остальное — стальные призраки; удаление — красный контур
if(car.status==="stock"){h+=`<div class="btn-action btn-primary" title="Оформить продажу" onclick="event.stopPropagation();startSell('${esc(car.id)}')">💰 ПРОДАТЬ</div>`}
if(car.status==="estimate"){h+=`<div class="btn-action btn-primary" title="Купил — перевести на склад (дата покупки станет сегодняшней)" onclick="event.stopPropagation();estToStock('${esc(car.id)}')">🏭 НА СКЛАД</div>`}
if(car.status==="transit"){h+=`<div class="btn-action btn-primary" title="Машина пришла — перевести на склад (дата поступления = сегодня)" onclick="event.stopPropagation();transitToStock('${esc(car.id)}')">✅ ПРИШЛА</div>`}
if(car.status==="sold"){h+=`<div class="btn-action btn-primary" title="Изменить цену или дату продажи" onclick="event.stopPropagation();startEditSale('${esc(car.id)}')">💰 ЦЕНА</div>`}
if(car.status==="estimate"){h+=`<div class="btn-action btn-order" title="Заказал — машина едет, отправить в раздел «В пути»" onclick="event.stopPropagation();estToTransit('${esc(car.id)}')">🚚 ЗАКАЗАЛ</div>`}
h+=`<div class="btn-action btn-ghost g-blue" title="Название, дата, курсы и суммы" onclick="event.stopPropagation();startCarEdit('${esc(car.id)}')">✏️ ПРАВКА</div>`;
if(car.status!=="sold"){h+=`<div class="btn-action btn-ghost g-violet" title="Скопировать расчёт в калькулятор" onclick="event.stopPropagation();cpToCalc('${esc(car.id)}')">📋 В КАЛЬКУЛЯТОР</div>`}
else{h+=`<div class="btn-action btn-ghost g-violet" title="Вернуть на склад" onclick="event.stopPropagation();retStock('${esc(car.id)}')">↩️ ВЕРНУТЬ</div>`}
// со склада можно вернуть в прикидку или отправить в путь (ошибочно оформил / ещё не приехала)
if(car.status==="stock"){h+=`<div class="btn-action btn-ghost g-blue" title="Вернуть в прикидки (ошибочно оформил как покупку)" onclick="event.stopPropagation();stockToEstimate('${esc(car.id)}')">📝 В ПРИКИДКУ</div>
<div class="btn-action btn-ghost g-amber" title="Ещё не приехала — отправить в раздел «В пути»" onclick="event.stopPropagation();stockToTransit('${esc(car.id)}')">🚚 В ПУТЬ</div>`}
if(car.status==="stock"||car.status==="sold")h+=`<div class="btn-action btn-ghost g-green" title="Чек с ценой для клиента — БЕЗ себестоимости" onclick="event.stopPropagation();${car.status==="sold"?"carClientShare":"openClientQuote"}('${esc(car.id)}')">👤 ЧЕК КЛИЕНТУ</div>`;
h+=`
<div class="btn-action btn-ghost g-amber" title="Скачать внутренний чек (с себестоимостью)" onclick="event.stopPropagation();carReceipt('${esc(car.id)}')">⬇️ ЧЕК СЕБЕ</div>
<div class="btn-action btn-danger" title="Удалить машину" onclick="event.stopPropagation();delCar('${esc(car.id)}')">🗑 УДАЛИТЬ</div></div>`;
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
<div style="color:var(--t3);font-size:11px;font-weight:600;margin-bottom:8px">${S.sellEditMode?"ИЗМЕНИТЬ ПРОДАЖУ":"ОФОРМИТЬ ПРОДАЖУ"}</div>
<input type="text" inputmode="decimal" maxlength="16" class="wh-sell-input" placeholder="Цена продажи" value="${esc(S.sellFormPrice)}" oninput="S.sellFormPrice=this.value">
<div class="profit-curr-row">
${[...new Set(["RUB",...S.activeCur,S.sellFormCurr])].map(c=>`<div class="pcb ${S.sellFormCurr===c?"a-"+curInfo(c).cls:""}"
onclick="setSellFormCur('${esc(car.id)}','${esc(c)}')">${curInfo(c).symbol} ${esc(c)}</div>`).join("")}</div>
${S.sellFormCurr!=="RUB"?`<label class="sell-rate-lbl">КУРС НА ДАТУ ПРОДАЖИ ${curInfo(S.sellFormCurr).symbol}/₽</label>
<input type="text" inputmode="decimal" maxlength="16" class="wh-sell-input" value="${esc(S.sellFormRate)}" oninput="S.sellFormRate=this.value">`:""}
<label class="sell-rate-lbl">ДАТА ПРОДАЖИ (продал вчера — поставь вчера)</label>
<input type="date" class="wh-sell-input" value="${esc(S.sellFormDate)}" min="${carDateInput(car)}" max="${todayStr()}" oninput="S.sellFormDate=this.value">
<div style="display:flex;gap:8px;margin-top:4px">
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="${S.sellEditMode?"saveSaleEdit":"doSell"}('${esc(car.id)}')">${S.sellEditMode?"✅ СОХРАНИТЬ":"✅ ПРОДАТЬ"}</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 16px" onclick="cancelSell()">✕</div></div></div>`}

if(S.clientQuote&&S.clientQuote.id===car.id&&S.expandedCar===car.id){const q=S.clientQuote;const cqCost=carCost(car);const cqPv=parseRub(q.price);
h+=`<div class="wh-sell-form" onclick="event.stopPropagation()">
<div style="color:var(--t3);font-size:11px;font-weight:600;margin-bottom:6px">📤 ЦЕНА ДЛЯ КЛИЕНТА — ЧЕК</div>
<div style="color:var(--t4);font-size:10px;margin-bottom:10px">Себестоимость: ${fmt(cqCost)} ₽ (клиенту не видна). Наценка % и/или +₽ — к себестоимости, либо впиши цену вручную.</div>
<div class="bulk-rate-row">
<div class="bulk-rate-field"><label class="edit-lbl">НАЦЕНКА %</label>
<input type="text" inputmode="decimal" maxlength="8" class="edit-input" placeholder="15" value="${esc(q.pct)}" oninput="S.clientQuote.pct=this.value"></div>
<div class="bulk-rate-field"><label class="edit-lbl">+ ₽ СВЕРХУ</label>
<input type="text" inputmode="decimal" maxlength="16" class="edit-input" placeholder="0" value="${esc(q.add)}" oninput="S.clientQuote.add=this.value"></div>
<div class="bulk-apply" onclick="calcClientQuote('${esc(car.id)}')">→ РАССЧИТАТЬ</div></div>
<label class="sell-rate-lbl">ЦЕНА КЛИЕНТУ ₽ (можно вписать вручную)</label>
<input type="text" inputmode="decimal" maxlength="16" class="wh-sell-input" placeholder="0" value="${esc(q.price)}" oninput="S.clientQuote.price=this.value;rClientQuotePv()">
<div id="cq-pv" style="color:var(--gold);font-size:13px;font-weight:700;margin:2px 0 8px">${cqPv>0?"Итог клиенту: "+fmt(Math.round(cqPv))+" ₽":"—"}</div>
<label style="display:flex;align-items:center;gap:8px;color:var(--t3);font-size:10px;margin-bottom:8px;cursor:pointer">
<input type="checkbox" ${q.save?"checked":""} onchange="S.clientQuote.save=this.checked"> Запомнить цену в карточке</label>
<div style="display:flex;gap:8px">
<div class="btn-action btn-green" style="flex:1;margin:0" onclick="sendClientQuote('${esc(car.id)}',false)">📤 ОТПРАВИТЬ</div>
<div class="btn-action btn-yellow" style="flex:0 0 auto;margin:0;padding:10px 14px" title="Скачать чек" onclick="sendClientQuote('${esc(car.id)}',true)">⬇️</div>
<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 14px" onclick="closeClientQuote()">✕</div></div></div>`}
h+=`</div>`;
return h}
