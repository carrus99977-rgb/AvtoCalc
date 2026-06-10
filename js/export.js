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
const cr=carRates(car),st=car.status==="sold"?"Продано":"Склад";
car.entries.forEach(e=>{const r=entryRate(e,cr);
rows.push([car.name,st,e.label,e.currency,csvNum(e.amount),
e.currency==="RUB"?"":(r?csvNum(r):"⚠ нет курса"),
(e.currency==="RUB"||r)?csvNum(entryRub(e,cr)):"⚠ нет курса"])})});
const csv="\uFEFF"+rows.map(r=>r.map(csvEsc).join(";")).join("\r\n");
const blob=new Blob([csv],{type:"text/csv;charset=utf-8"});
const a=document.createElement("a");a.href=URL.createObjectURL(blob);
a.download="АвтоСклад_"+new Date().toLocaleDateString("ru-RU").replace(/\./g,"-")+".csv";
document.body.appendChild(a);a.click();document.body.removeChild(a);
setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
