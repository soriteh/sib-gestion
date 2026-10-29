/* SIB Gestion: enregistre le service worker uniquement pour les notifications push.
 * Le worker ne met plus en cache les pages ou les données de l'application.
 */
(function(){
  "use strict";
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", function(){
    navigator.serviceWorker.register("./service-worker.js", {scope:"./"}).catch(function(err){
      console.warn("SIB push notification worker registration failed:", err);
    });
  });
})();
