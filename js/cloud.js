// ===== CLOUD SYNC (Supabase) =====
// synced=true ТОЛЬКО после полностью успешного fullSync (локальное == облако). Любая мутация/
// импорт/ошибка сбрасывают его. На выходе по нему решаем, безопасно ли стирать локальные данные.
let CL={url:"",key:"",sb:null,user:null,email:"",pass:"",queue:[],busy:false,syncing:false,pendingFullSync:false,loggingOut:false,ownerGate:false,localRev:0,synced:false,status:"",showSetup:false};
function loadCloud(){
try{const c=localStorage.getItem("autoCalc_cloud");if(c){const cc=JSON.parse(c);CL.url=cc.url||"";CL.key=cc.key||""}}catch(e){}
try{const q=localStorage.getItem("autoCalc_queue");if(q){const a=JSON.parse(q);
// битые операции (старые версии/повреждённая запись) отбрасываем: кривая головная
// операция вечно роняла бы flushQueue и намертво стопорила всю очередь
CL.queue=(Array.isArray(a)?a:[]).filter(o=>o&&((o.t==="u"&&o.car&&o.car.id)||(o.t==="d"&&o.id)))}}catch(e){}}
function saveCloudCfg(){try{localStorage.setItem("autoCalc_cloud",JSON.stringify({url:CL.url,key:CL.key}))}catch(e){}}
function saveQueue(){try{localStorage.setItem("autoCalc_queue",JSON.stringify(CL.queue))}catch(e){}}
loadCloud();
const SB_URL_DEFAULT="https://sqgqydgtgugwzdsvsvnc.supabase.co";
const SB_KEY_DEFAULT="sb_publishable_K0XaShzvYG4gb7OEJm8SNQ_sCyIiCZr";
if(!CL.url)CL.url=SB_URL_DEFAULT;
if(!CL.key)CL.key=SB_KEY_DEFAULT;

// Версия зафиксирована + SRI-хэш: ни CDN, ни автор пакета не смогут незаметно подменить
// код, у которого есть доступ ко всем данным. При обновлении версии пересчитать хэш:
//   curl -s <URL> | openssl dgst -sha384 -binary | openssl base64 -A
// Пиновать только оригинальный файл пакета (dist/umd/supabase.js — он уже минифицирован):
// .min.js у jsdelivr автогенерируется и байтово нестабилен, SRI с ним однажды сломается.
const SB_LIB_URL="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.0/dist/umd/supabase.js";
const SB_LIB_SRI="sha384-3wY11tldQ5+yWqAvmTN4XtQvnjoTva0cV15O/O/O5NTtp0ivVopSzLOzsVXWZse9";
function loadSbLib(cb){
if(window.supabase)return cb();
const s=document.createElement("script");
s.src=SB_LIB_URL;s.integrity=SB_LIB_SRI;s.crossOrigin="anonymous";
s.onload=cb;s.onerror=()=>{setStatus("нет интернета");};
document.head.appendChild(s)}

function initCloud(){
if(!CL.url||!CL.key)return;
loadSbLib(()=>{
try{CL.sb=window.supabase.createClient(CL.url,CL.key);
CL.sb.auth.getSession().then(({data})=>{
if(data&&data.session){CL.user=data.session.user;setStatus("вход выполнен");afterAuth()}
else{setStatus("нужен вход");renderCloudBox()}});
}catch(e){setStatus("ошибка настроек")}})}

function setStatus(t){CL.status=t;const el=document.getElementById("cloud-status");if(el)el.textContent=t}

function cloudSaveCfg(){
const u=document.getElementById("cl-url"),k=document.getElementById("cl-key");
if(!u||!k||!u.value.trim()||!k.value.trim()){alert("Заполни оба поля");return}
CL.url=u.value.trim();CL.key=k.value.trim();saveCloudCfg();CL.showSetup=false;initCloud();render()}

// Перевод технических ошибок Supabase в понятный текст
function humanAuthError(m){m=String(m||"");
if(/load failed|failed to fetch|network|timeout|fetch/i.test(m))
return "нет связи с облаком. Проверь интернет (попробуй сменить Wi-Fi/LTE, выключить VPN) и нажми ещё раз — сервер мог «спать» и уже проснулся";
if(/invalid login credentials/i.test(m))return "неверная почта или пароль";
if(/email not confirmed/i.test(m))return "почта не подтверждена — найди письмо и перейди по ссылке";
if(/already registered/i.test(m))return "такая почта уже зарегистрирована — жми ВОЙТИ";
if(/at least 6 characters/i.test(m))return "пароль минимум 6 символов";
if(/rate limit|too many/i.test(m))return "слишком много попыток — подожди минуту";
return m||"проверь данные"}

function cloudLogin(reg){
const e=document.getElementById("cl-email"),p=document.getElementById("cl-pass");
if(!e||!p||!e.value.trim()||!p.value){alert("Введи почту и пароль");return}
if(p.value.length<6){alert("Пароль минимум 6 символов");return}
if(!CL.sb){alert("Сначала сохрани настройки облака");return}
setStatus(reg?"регистрация...":"вход...");
const cred={email:e.value.trim(),password:p.value};
const fn=reg?CL.sb.auth.signUp(cred):CL.sb.auth.signInWithPassword(cred);
fn.then(({data,error})=>{
if(error){setStatus("ошибка входа");alert("Ошибка: "+humanAuthError(error.message));return}
if(reg&&data&&data.user&&!data.session){setStatus("проверь почту");alert("Письмо отправлено — подтверди почту и нажми Войти");return}
CL.user=(data&&data.user)||null;setStatus("вход выполнен");afterAuth();render()})
.catch(err=>{setStatus("нет связи");alert("Ошибка: "+humanAuthError(err&&err.message))})}

// Диагностика: доходят ли запросы до облака с ЭТОГО устройства
async function diagCloud(){
setStatus("проверка связи...");
const t0=Date.now();
try{
const r=await fetch(CL.url+"/auth/v1/health",{headers:{apikey:CL.key},signal:AbortSignal.timeout(15000)});
const ms=Date.now()-t0;
if(r.ok){setStatus("связь ок");
alert("✅ Связь с облаком есть (ответ за "+(ms/1000).toFixed(1)+" сек).\nЕсли вход не проходит — дело в почте или пароле, а не в сети.")}
else{setStatus("ошибка "+r.status);
alert("⚠️ Сервер отвечает, но с ошибкой "+r.status+". Подожди пару минут и попробуй снова.")}
}catch(e){const ms=Date.now()-t0;setStatus("нет связи");
alert("❌ Запрос до облака не дошёл"+(ms>14000?" (ждали 15 сек — не дождались)":"")+".\nСкорее всего, сеть блокирует доступ: попробуй переключить Wi-Fi ↔ мобильный интернет или выключить VPN, затем нажми проверку ещё раз.")}}

// Выход: СНАЧАЛА сливаем накопленную очередь в облако текущего аккаунта (пока ещё авторизованы),
// иначе afterAuth при входе другого аккаунта сотрёт несинхронизированные правки → потеря данных.
function cloudLogout(){
if(CL.loggingOut)return; // защита от повторного тапа ВЫЙТИ, пока идёт синхронизация
// Выход стирает локальные данные с устройства (на общем устройстве чужой склад виден быть не должен),
// НО только если они подтверждённо в облаке (CL.synced). Иначе — досинхронизируем (онлайн) или
// спрашиваем подтверждение: «очередь пуста» НЕ доказывает, что всё в облаке (импорт/push минуют очередь).
const out=(wipe)=>{CL.loggingOut=false;if(wipe)clearLocalData();if(CL.sb)CL.sb.auth.signOut();CL.user=null;setStatus("вышел");render()};
const askWipe=()=>{CL.loggingOut=false;showConfirm("Есть несинхронизированные данные — при выходе они пропадут с этого устройства. Выйти и стереть? «Отмена» — остаться (можно сперва синхронизировать).",()=>out(true))};
if(CL.synced){out(true);return}                       // всё в облаке → стираем безопасно
if(CL.user&&navigator.onLine){                         // не синхронизировано, но онлайн → синкаем и решаем по факту
CL.loggingOut=true;setStatus("синхронизация перед выходом...");
fullSync().then(()=>{CL.loggingOut=false;CL.synced?out(true):askWipe()});return}
askWipe()}                                              // офлайн / не удалось синхронизировать → спрашиваем
// Привязка локальных данных к аккаунту-владельцу. На общем устройстве вход под ДРУГИМ
// аккаунтом не должен сливать чужой локальный склад/очередь в новый аккаунт (утечка):
// при смене владельца чистим локальные данные и тянем заново из облака нового аккаунта.
// полностью стереть локальные данные с устройства (склад, очередь, чеки, черновик калькулятора).
// используется при смене аккаунта и при выходе — чтобы на общем устройстве не светить чужой склад.
function clearLocalData(){
S.warehouse=[];CL.queue=[];S.carReceipts={};
S.carName="";S.entries=[];S.display="0";S.curCat=0;S.sellPrice="";S.targetMarkup="";S.sellCurrency="RUB";
S.rates={...DEFAULT_RATES};S.activeCur=[...DEFAULT_ACTIVE];
try{localStorage.removeItem("autoCalc_queue");localStorage.removeItem("autoCalc_draft")}catch(e){}
saveWH()}
function afterAuth(){
const uid=CL.user&&CL.user.id;
if(!uid){fullSync();return}
let owner="";try{owner=localStorage.getItem("autoCalc_owner")||""}catch(e){}
if(owner&&owner!==uid&&(S.warehouse.length||CL.queue.length)){
// На устройстве живые данные ДРУГОГО аккаунта: молча стирать нельзя (внезапная потеря,
// напр. свежего офлайн-импорта), сливать в новый аккаунт тоже нельзя (утечка чужого
// склада) — спрашиваем. Пока вопрос открыт, ownerGate глушит flushQueue/fullSync,
// иначе фоновый синк (реконнект и т.п.) успел бы отправить чужую очередь в новый аккаунт.
CL.ownerGate=true;
showConfirm("На этом устройстве — данные другого аккаунта. Войти и стереть их с устройства? (в облаке прежнего аккаунта они остаются, если синхронизировались)",
()=>{CL.ownerGate=false;clearLocalData();
try{localStorage.setItem("autoCalc_owner",uid)}catch(e){}
setStatus("новый аккаунт — загрузка из облака");fullSync();render()},
()=>{CL.ownerGate=false;if(CL.sb)CL.sb.auth.signOut();CL.user=null;
setStatus("вход отменён — данные не тронуты");render()});
return}
if(owner&&owner!==uid){
clearLocalData(); // другой аккаунт без локальных данных — просто тянем его облако
setStatus("новый аккаунт — загрузка из облака");
}
try{localStorage.setItem("autoCalc_owner",uid)}catch(e){}
fullSync()}
function cloudReset(){showConfirm("Удалить настройки облака с этого устройства? (данные в облаке останутся)",()=>{
CL.url=SB_URL_DEFAULT;CL.key=SB_KEY_DEFAULT;CL.user=null;CL.sb=null;saveCloudCfg();initCloud();render()})}

// touch — отметить машину как изменённую сейчас (метка свежести для слияния).
// Зовётся при пользовательской правке; синк-отправка (pushCar) метку НЕ двигает.
function touch(car){if(car)car.updatedAt=new Date().toISOString()}
// канон. метки времени для сравнения свежести (сырое облако может быть с офсетом, не Z)
function tsKey(s){if(typeof s!=="string"||!s)return"";const d=new Date(s);return isNaN(d)?"":d.toISOString()}

// localRev++ на каждой локальной мутации (upsert/delete) — fullSync ловит по нему изменения,
// случившиеся во время сетевого select, и не сливается против устаревшего снимка облака
function qOp(op){if(!CL.url)return;CL.localRev++;CL.synced=false;
// Компактация: в облаке важна только ПОСЛЕДНЯЯ операция по машине (и upsert, и надгробие
// целиком перезаписывают строку), поэтому прежние операции того же id выкидываем.
// Без этого у пользователя, ни разу не входившего в облако, очередь росла бы бесконечно
// (полная копия машины на каждую правку) и добивала квоту localStorage, после чего
// setItem молча падает и перестаёт сохраняться уже сам склад.
const id=op.t==="u"?String(op.car.id):String(op.id);
const from=CL.busy?1:0; // головную не трогаем: flushQueue сейчас отправляет её и снимет своим shift()
for(let i=CL.queue.length-1;i>=from;i--){const q=CL.queue[i];
if((q.t==="u"?String(q.car&&q.car.id):String(q.id))===id)CL.queue.splice(i,1)}
CL.queue.push(op);saveQueue();flushQueue()}
function cloudUpsert(car){qOp({t:"u",car:JSON.parse(JSON.stringify(car))})}
// удаление — мягкое: фиксируем момент, в облако пойдёт надгробие (не delete)
function cloudDelete(id){qOp({t:"d",id,ts:new Date().toISOString()})}

// upsert машины в облако с ЕЁ меткой времени, без перебивки (для слияния).
// пустой updatedAt проштамповываем, иначе в облаке метка в data разойдётся с колонкой
// и машина будет вечно проигрывать сравнения свежести (cloudTs="")
function pushCar(car){if(!car.updatedAt)car.updatedAt=new Date().toISOString();
return CL.sb.from("cars").upsert({id:car.id,data:car,updated_at:car.updatedAt})}
// upsert надгробия: строка остаётся в облаке, помечена удалённой
function pushTomb(id,ts){const t=ts||new Date().toISOString();
return CL.sb.from("cars").upsert({id,data:{id,deletedAt:t,updatedAt:t},updated_at:t})}

async function flushQueue(){
if(CL.busy||CL.ownerGate||!CL.sb||!CL.user||!navigator.onLine||!CL.queue.length)return;
const acting=CL.user.id; // от чьего имени отправляем (общий клиент CL.sb может перелогиниться)
CL.busy=true;setStatus("синхронизация...");
try{
while(CL.queue.length){
if(!CL.user||CL.user.id!==acting)break; // вход под другим аккаунтом во время отправки — стоп, не сливаем чужое
const op=CL.queue[0];
if(op.t==="u"){const{error}=await pushCar(op.car);if(error)throw error}
else if(op.t==="d"){const{error}=await pushTomb(op.id,op.ts);if(error)throw error}
CL.queue.shift();saveQueue()}
setStatus("синхронизировано ✓")}
catch(e){setStatus("ошибка сети — повторю позже")}
CL.busy=false;
// если во время flush кто-то запросил полное слияние — выполняем его теперь (очередь опустела)
if(CL.pendingFullSync&&!CL.queue.length&&CL.sb&&CL.user&&navigator.onLine){CL.pendingFullSync=false;fullSync()}}

async function fullSync(){
if(CL.syncing||CL.ownerGate||!CL.sb||!CL.user||!navigator.onLine)return; // второе слияние поверх идущего не запускаем; ownerGate — открыт вопрос о смене владельца
const acting=CL.user.id; // аккаунт, от чьего имени синхронизируемся — стережёмся перелогина в процессе
CL.syncing=true;
setStatus("синхронизация...");
try{
// 1) отправляем накопленные локальные операции
await flushQueue();
// очередь не опустела (busy/flush в полёте) — НЕ сливаемся против устаревшего снимка облака:
// иначе только что удалённая машина, чьё надгробие ещё в очереди, вернулась бы живой (воскрешение)
if(CL.queue.length){if(CL.busy)CL.pendingFullSync=true;return} // flush в полёте — дослиться после него
// вход под другим аккаунтом во время отправки — не сливаем локальные данные предыдущего владельца
if(!CL.user||CL.user.id!==acting)return;
const rev0=CL.localRev; // ревизия локальных мутаций ДО сетевого ожидания
// 2) забираем облако (включая надгробия — у них есть data.deletedAt)
const{data,error}=await CL.sb.from("cars").select("id,data");
if(error)throw error;
if(!CL.user||CL.user.id!==acting)return; // вход под другим аккаунтом во время select
// во время select появилась локальная правка/удаление → снимок облака устарел: НЕ сливаемся
// (иначе только что удалённая машина воскреснет из живой облачной записи), откладываем синк
if(CL.localRev!==rev0||CL.queue.length){CL.pendingFullSync=true;return}
const cloudMap=new Map();
(data||[]).forEach(r=>{const d=r&&r.data;if(d&&d.id)cloudMap.set(String(d.id),d)});
const localMap=new Map();
S.warehouse.forEach(c=>localMap.set(String(c.id),c));
const ids=new Set([...cloudMap.keys(),...localMap.keys()]);
// 3) слияние по свежести: новее побеждает; надгробие убирает машину
const result=[],pushes=[];
ids.forEach(id=>{
const cd=cloudMap.get(id),lc=localMap.get(id);
const cloudTomb=!!(cd&&cd.deletedAt);
const cloudTs=tsKey(cd?(cd.updatedAt||cd.deletedAt||""):"");
const localTs=tsKey(lc?(lc.updatedAt||""):"");
if(cd&&lc){
if(cloudTomb&&cloudTs>=localTs)return;          // удалено в облаке не раньше локальной правки → убрать локально
if(localTs>cloudTs){result.push(lc);pushes.push(lc);return} // локальная новее → оставить и отправить
if(cloudTomb)return;                            // облачное надгробие новее → убрать локально
const n=normalizeCar(cd);result.push(n||lc);    // облачная новее → принять (битую — оставить локальную)
}else if(cd){
if(!cloudTomb){const n=normalizeCar(cd);if(n)result.push(n)} // только в облаке (не надгробие) → принять
}else if(lc){
result.push(lc);pushes.push(lc);                // только локально → отправить
}});
// применяем слияние СРАЗУ (синхронно, до сетевых push) — иначе удаление во время push-цикла
// затрётся снимком result (та же гонка-воскрешение, что и при select)
S.warehouse=result.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
saveWH();markBackup();render();
// 4) отправляем «локально-новее» и «только-локально» в облако
for(const car of pushes){if(!CL.user||CL.user.id!==acting)return; const{error:e2}=await pushCar(car);if(e2)throw e2}
// мутация во время отправки → состояние снова грязное, дослиёмся; иначе локальное == облако
if(CL.localRev!==rev0||CL.queue.length){CL.pendingFullSync=true}
else{CL.synced=true}
setStatus("синхронизировано ✓")}
catch(e){CL.synced=false;setStatus("ошибка синхронизации")}
finally{CL.syncing=false;
// сменился аккаунт во время синка → чистый синк для нового владельца;
// либо был отложен (устаревший снимок / занятый flush) и очередь уже пуста → дослиться
if(CL.user&&CL.user.id!==acting)fullSync();
else if(CL.pendingFullSync&&!CL.queue.length&&CL.sb&&CL.user&&navigator.onLine){CL.pendingFullSync=false;fullSync()}}}

// на реконнекте — полное слияние (flush очереди + merge по свежести), а не только flush:
// иначе импортированные офлайн машины (они не в очереди, а в складе) не уедут в облако
window.addEventListener("online",()=>{fullSync()});

function cloudBoxHTML(){
const configured=!!(CL.url&&CL.key);
let inner="";
if(!configured||CL.showSetup){
inner=`<div style="color:#778;font-size:10px;line-height:1.5;margin-bottom:10px">Вставь два значения из Supabase (Settings → API):</div>
<label class="edit-lbl">PROJECT URL</label>
<input type="text" class="wh-sell-input" id="cl-url" placeholder="https://xxxx.supabase.co" value="${esc(CL.url)}">
<label class="edit-lbl">ANON PUBLIC KEY</label>
<input type="text" class="wh-sell-input" id="cl-key" placeholder="eyJhbG..." value="${esc(CL.key)}">
<div style="display:flex;gap:8px">
<div class="btn-action btn-blue" style="flex:1;margin:0;font-size:11px;padding:10px 0" onclick="cloudSaveCfg()">💾 СОХРАНИТЬ</div>
${configured?`<div class="btn-action btn-outline" style="flex:0 0 auto;margin:0;padding:10px 14px;font-size:11px" onclick="CL.showSetup=false;render()">✕</div>`:""}
</div>`;
}else if(!CL.user){
// Кнопки настроек проекта (URL/ключ) скрыты: обычному пользователю они не нужны,
// подключение другого облака — через правку SB_URL_DEFAULT/SB_KEY_DEFAULT в коде
inner=`<div style="color:#778;font-size:10px;margin-bottom:8px">Войди или зарегистрируйся (первый раз — жми Регистрация):</div>
<input type="email" class="wh-sell-input" id="cl-email" placeholder="Почта" value="${esc(CL.email)}" oninput="CL.email=this.value">
<input type="password" class="wh-sell-input" id="cl-pass" placeholder="Пароль (мин. 6 симв.)" oninput="CL.pass=this.value">
<div style="display:flex;gap:8px;margin-bottom:8px">
<div class="btn-action btn-green" style="flex:1;margin:0;font-size:11px;padding:10px 0" onclick="cloudLogin(false)">ВОЙТИ</div>
<div class="btn-action btn-blue" style="flex:1;margin:0;font-size:11px;padding:10px 0" onclick="cloudLogin(true)">РЕГИСТРАЦИЯ</div></div>
<div class="backup-btn" onclick="diagCloud()">🩺 ПРОВЕРИТЬ СВЯЗЬ С ОБЛАКОМ</div>`;
}else{
inner=`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
<div><div style="color:var(--ok2);font-size:11px;font-weight:600">✓ ${esc((CL.user.email||""))}</div>
<div style="color:#667;font-size:9px;margin-top:2px" id="cloud-status">${esc(CL.status)}</div></div>
<div class="backup-btn" style="flex:0 0 auto;padding:8px 12px" onclick="cloudLogout()">ВЫЙТИ</div></div>
<div class="backup-btn" onclick="fullSync()">🔄 СИНХРОНИЗИРОВАТЬ СЕЙЧАС</div>`;
}
return `<div class="coll-box"><div class="coll-header" style="cursor:default"><span>☁️ Облако ${CL.user?"— подключено":configured?"— войди":"— не настроено"}</span></div>
<div class="coll-body" id="cloud-box">${inner}</div></div>`}
function renderCloudBox(){render()}
