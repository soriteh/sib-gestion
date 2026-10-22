/* SIB offline cache registration — external file for CSP compatibility. */
(function(){
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("./service-worker.js", {scope:"./"}).catch(function(err){
      console.warn("SIB offline cache registration failed:", err);
    });
  });
})();
