// ===== РЕНДЕР И ЗАПУСК =====
function render(){renderConfirm();renderToast();
document.getElementById("app").innerHTML=calcHTML()+whHTML()+soldHTML()+statsHTML()}

// Физическая клавиатура на десктопе для калькулятора
window.addEventListener("keydown",e=>{
const t=e.target;
if(t&&(t.tagName==="INPUT"||t.tagName==="TEXTAREA"||t.tagName==="SELECT"||t.isContentEditable))return;
if(e.metaKey||e.ctrlKey||e.altKey)return;
if(e.key>="0"&&e.key<="9"){digit(e.key);e.preventDefault()}
else if(e.key==="."||e.key===","){digit(".");e.preventDefault()}
else if(e.key==="Backspace"){bsp();e.preventDefault()}
else if(e.key==="Escape"){clr();e.preventDefault()}});

loadAll();
initCloud();
render();
// тихий прогрев курсов (ЦБ + рынок): кнопки будут срабатывать мгновенно
setTimeout(()=>{try{prefetchRates()}catch(e){}},1200);

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}
