// ===== РЕНДЕР И ЗАПУСК =====
function render(){renderConfirm();
document.getElementById("app").innerHTML=calcHTML()+whHTML()+soldHTML()+statsHTML()}

loadAll();
initCloud();
render();

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}
