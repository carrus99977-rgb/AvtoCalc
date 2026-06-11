// ===== CLOUD SYNC (Supabase) =====
let CL={url:"",key:"",sb:null,user:null,email:"",pass:"",queue:[],busy:false,status:"",showSetup:false};
function loadCloud(){
try{const c=localStorage.getItem("autoCalc_cloud");if(c){const cc=JSON.parse(c);CL.url=cc.url||"";CL.key=cc.key||""}}catch(e){}
try{const q=localStorage.getItem("autoCalc_queue");if(q)CL.queue=JSON.parse(q)}catch(e){}}
function saveCloudCfg(){try{localStorage.setItem("autoCalc_cloud",JSON.stringify({url:CL.url,key:CL.key}))}catch(e){}}
function saveQueue(){try{localStorage.setItem("autoCalc_queue",JSON.stringify(CL.queue))}catch(e){}}
loadCloud();
const SB_URL_DEFAULT="https://sqgqydgtgugwzdsvsvnc.supabase.co";
const SB_KEY_DEFAULT="sb_publishable_K0XaShzvYG4gb7OEJm8SNQ_sCyIiCZr";
if(!CL.url)CL.url=SB_URL_DEFAULT;
if(!CL.key)CL.key=SB_KEY_DEFAULT;

function loadSbLib(cb){
if(window.supabase)return cb();
const s=document.createElement("script");
s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
s.onload=cb;s.onerror=()=>{setStatus("нет интернета");};
document.head.appendChild(s)}

function initCloud(){
if(!CL.url||!CL.key)return;
loadSbLib(()=>{
try{CL.sb=window.supabase.createClient(CL.url,CL.key);
CL.sb.auth.getSession().then(({data})=>{
if(data&&data.session){CL.user=data.session.user;setStatus("вход выполнен");fullSync()}
else{setStatus("нужен вход");renderCloudBox()}});
}catch(e){setStatus("ошибка настроек")}})}

function setStatus(t){CL.status=t;const el=document.getElementById("cloud-status");if(el)el.textContent=t}

function cloudSaveCfg(){
const u=document.getElementById("cl-url"),k=document.getElementById("cl-key");
if(!u||!k||!u.value.trim()||!k.value.trim()){alert("Заполни оба поля");return}
CL.url=u.value.trim();CL.key=k.value.trim();saveCloudCfg();CL.showSetup=false;initCloud();render()}

function cloudLogin(reg){
const e=document.getElementById("cl-email"),p=document.getElementById("cl-pass");
if(!e||!p||!e.value.trim()||!p.value){alert("Введи почту и пароль");return}
if(p.value.length<6){alert("Пароль минимум 6 символов");return}
if(!CL.sb){alert("Сначала сохрани настройки облака");return}
setStatus(reg?"регистрация...":"вход...");
const cred={email:e.value.trim(),password:p.value};
const fn=reg?CL.sb.auth.signUp(cred):CL.sb.auth.signInWithPassword(cred);
fn.then(({data,error})=>{
if(error){setStatus("ошибка: "+(error.message||""));alert("Ошибка: "+(error.message||"проверь данные"));return}
if(reg&&data&&data.user&&!data.session){setStatus("проверь почту");alert("Письмо отправлено — подтверди почту и нажми Войти");return}
CL.user=(data&&data.user)||null;setStatus("вход выполнен");fullSync();render()})}

function cloudLogout(){if(CL.sb)CL.sb.auth.signOut();CL.user=null;setStatus("вышел");render()}
function cloudReset(){showConfirm("Удалить настройки облака с этого устройства? (данные в облаке останутся)",()=>{
CL.url=SB_URL_DEFAULT;CL.key=SB_KEY_DEFAULT;CL.user=null;CL.sb=null;saveCloudCfg();initCloud();render()})}

function qOp(op){if(!CL.url)return;CL.queue.push(op);saveQueue();flushQueue()}
function cloudUpsert(car){qOp({t:"u",car:JSON.parse(JSON.stringify(car))})}
function cloudDelete(id){qOp({t:"d",id})}

async function flushQueue(){
if(CL.busy||!CL.sb||!CL.user||!navigator.onLine||!CL.queue.length)return;
CL.busy=true;setStatus("синхронизация...");
try{
while(CL.queue.length){
const op=CL.queue[0];
if(op.t==="u"){const{error}=await CL.sb.from("cars").upsert({id:op.car.id,data:op.car,updated_at:new Date().toISOString()});if(error)throw error}
else if(op.t==="d"){const{error}=await CL.sb.from("cars").delete().eq("id",op.id);if(error)throw error}
CL.queue.shift();saveQueue()}
setStatus("синхронизировано ✓")}
catch(e){setStatus("ошибка сети — повторю позже")}
CL.busy=false}

async function fullSync(){
if(!CL.sb||!CL.user||!navigator.onLine)return;
setStatus("синхронизация...");
try{
// 1) отправляем локальные изменения
await flushQueue();
// 2) забираем облако
const{data,error}=await CL.sb.from("cars").select("id,data");
if(error)throw error;
// данные из облака могут быть произвольными — нормализуем (защита от битых/вредоносных записей)
const cloudCars=(data||[]).map(r=>normalizeCar(r.data)).filter(Boolean);
const cloudIds=new Set(cloudCars.map(c=>c.id));
// 3) машины, которых нет в облаке (созданы офлайн до входа) — отправляем
const toPush=S.warehouse.filter(c=>!cloudIds.has(c.id));
for(const car of toPush){
const{error:e2}=await CL.sb.from("cars").upsert({id:car.id,data:car,updated_at:new Date().toISOString()});
if(e2)throw e2;cloudCars.push(car)}
// 4) облако — источник истины
S.warehouse=cloudCars.sort((a,b)=>(b.date||"").localeCompare(a.date||""));
saveWH();markBackup();setStatus("синхронизировано ✓");render()}
catch(e){setStatus("ошибка синхронизации")}}

window.addEventListener("online",()=>{flushQueue()});

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
inner=`<div style="color:#778;font-size:10px;margin-bottom:8px">Войди или зарегистрируйся (первый раз — жми Регистрация):</div>
<input type="email" class="wh-sell-input" id="cl-email" placeholder="Почта" value="${esc(CL.email)}" oninput="CL.email=this.value">
<input type="password" class="wh-sell-input" id="cl-pass" placeholder="Пароль (мин. 6 симв.)" oninput="CL.pass=this.value">
<div style="display:flex;gap:8px;margin-bottom:8px">
<div class="btn-action btn-green" style="flex:1;margin:0;font-size:11px;padding:10px 0" onclick="cloudLogin(false)">ВОЙТИ</div>
<div class="btn-action btn-blue" style="flex:1;margin:0;font-size:11px;padding:10px 0" onclick="cloudLogin(true)">РЕГИСТРАЦИЯ</div></div>
<div style="display:flex;gap:8px">
<div class="backup-btn" onclick="CL.showSetup=true;render()">⚙️ НАСТРОЙКИ</div>
<div class="backup-btn" onclick="cloudReset()">🗑 УДАЛИТЬ НАСТРОЙКИ</div></div>`;
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
