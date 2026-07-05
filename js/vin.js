// ===== VIN-ДЕКОДЕР (NHTSA vPIC — бесплатный публичный API, без ключей и лимитов) =====
// Тянет марку/модель/год/объём по VIN. Хорошо знает америку и европейские VIN,
// JDM frame numbers не декодирует — тогда честно говорим «введите вручную».
// ВАЖНО: найденное подставляем ТОЛЬКО в пустые поля — у одной модели и года бывает
// несколько вариантов двигателя, заполненное менеджером вручную не перетираем.
async function vinDecode(vin){
const v=normVin(vin);
if(v.replace(/-/g,"").length<11)throw new Error("короткий VIN");
const r=await fetch("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/"+encodeURIComponent(v)+"?format=json",
{signal:AbortSignal.timeout(15000)});
if(!r.ok)throw new Error("vin http "+r.status);
const d=await r.json();const res=(d&&d.Results&&d.Results[0])||{};
const yr=parseInt(res.ModelYear,10);
const volL=parseFloat(res.DisplacementL);
const pick=s=>(typeof s==="string"&&s&&s!=="null")?s:"";
return{name:[pick(res.Make),pick(res.Model)].filter(Boolean).join(" "),
year:(yr>=1950&&yr<=2100)?String(yr):"",
vol:(volL>0&&volL<20)?String(Math.round(volL*10)/10):"",
hp:parseInt(res.EngineHP,10)||0}}

// target — объект с полями vin/year/vol (S.carInfo в калькуляторе или S.editInfo в правке)
async function vinFill(target){
if(!target)return;
if(!normVin(target.vin)){alert("Сначала введите VIN в поле выше");return}
setTimeout(()=>showToast("⏳ Ищу по VIN..."),0);
try{
const d=await vinDecode(target.vin);
const got=[];
if(d.year&&!String(target.year||"").trim()){target.year=d.year;got.push("год "+d.year)}
if(d.vol&&!String(target.vol||"").trim()){target.vol=d.vol;got.push("объём "+d.vol+" л")}
if(d.name&&target===S.carInfo&&!S.carName.trim()){S.carName=d.name+(d.year?" "+d.year:"");got.push("название")}
saveDraft();render();
showToast(got.length?"Найдено: "+got.join(", ")+(d.hp?" · "+d.hp+" л.с.":"")
:(d.name?"База знает авто ("+d.name+"), но поля уже заполнены — не трогаю":"По этому VIN данных нет — введите вручную"));
}catch(e){render();showToast("VIN не расшифровался (нет сети или не в базе) — введите данные вручную")}}
function vinFillCalc(){vinFill(S.carInfo)}
function vinFillEdit(){vinFill(S.editInfo)}
