/* SIB Gestion — assistant IA flottant multi-fournisseur. */
(function () {
  "use strict";
  if (window.__SIB_AI_AGENT_LOADED) return;
  window.__SIB_AI_AGENT_LOADED = true;
  const css = `
  body.lo #sib-ai-launch,body.lo #sib-ai-panel{display:none!important;visibility:hidden!important;pointer-events:none!important}
  #sib-ai-launch{position:fixed;right:22px;bottom:22px;z-index:9998;width:112px;height:62px;display:grid;place-items:center;border:2px solid #fff;border-radius:18px;background:#fff;padding:5px;box-shadow:0 8px 28px #071a3640;cursor:pointer;transition:transform .2s,box-shadow .2s}
  #sib-ai-launch:hover{transform:translateY(-2px);box-shadow:0 12px 32px #071a3660}#sib-ai-launch img{display:block;width:100%;height:100%;object-fit:contain;border-radius:12px}
  #sib-ai-launch:focus-visible{outline:3px solid #ff7800;outline-offset:3px}
  #sib-ai-panel{position:fixed;right:22px;bottom:82px;z-index:9999;width:min(380px,calc(100vw - 28px));height:min(540px,calc(100vh - 115px));background:#ffffff!important;color:#071a36!important;opacity:1!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 18px 60px #071a3670;display:none;overflow:hidden;font:14px system-ui;isolation:isolate}
  #sib-ai-panel.open{display:flex;flex-direction:column}
  #sib-ai-head{flex:0 0 auto;padding:14px 16px;background:#071a36!important;color:#fff!important;display:flex;align-items:center;justify-content:space-between}
  #sib-ai-head strong{font-size:15px} #sib-ai-head small{display:block;opacity:.85;margin-top:3px}
  #sib-ai-close{border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer}
  #sib-ai-messages{flex:1;min-height:0;overflow:auto;padding:14px;background:#ffffff!important;color:#071a36!important;display:flex;flex-direction:column;gap:10px}
  .sib-ai-msg{padding:10px 12px;border-radius:12px;max-width:90%;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45;opacity:1}
  .sib-ai-msg.bot{background:#eef4fb!important;align-self:flex-start;color:#071a36!important}.sib-ai-msg.user{background:#0057b9!important;color:#ffffff!important;align-self:flex-end}
  #sib-ai-form{flex:0 0 auto;display:flex;gap:8px;padding:12px;background:#ffffff!important;border-top:1px solid #d9e2ef}
  #sib-ai-input{min-width:0;flex:1;padding:11px;border:1px solid #b9c8da;border-radius:10px;background:#fff!important;color:#071a36!important;font:inherit;opacity:1}
  #sib-ai-input::placeholder{color:#64748b;opacity:1}
  #sib-ai-send{border:0;border-radius:10px;background:#ff7800;color:#fff;font-weight:700;padding:0 14px;cursor:pointer}
  #sib-ai-send:disabled{opacity:.65;cursor:wait}
  #sib-ai-note{flex:0 0 auto;font-size:11px;padding:0 12px 10px;background:#fff!important;color:#475569!important;opacity:1}
  @media(max-width:480px){#sib-ai-panel{right:10px;bottom:76px;width:calc(100vw - 20px);height:min(540px,calc(100vh - 100px))}#sib-ai-launch{right:14px;bottom:14px;width:104px;height:56px;border-radius:15px}}
  `;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
  const launch = document.createElement("button"); launch.id = "sib-ai-launch"; launch.type = "button";
  const logo = document.createElement("img");
  logo.src = new URL("assets/sib-logo.svg", document.currentScript.src).href;
  logo.alt = ""; logo.loading = "eager"; logo.decoding = "async";
  launch.appendChild(logo);
  launch.setAttribute("aria-label","Ouvrir Maya, l’assistant de SIB Gestion");
  launch.title = "Ouvrir Maya · SIB Gestion";
  const panel = document.createElement("section"); panel.id = "sib-ai-panel"; panel.setAttribute("aria-label","Assistant IA SIB Gestion");
  panel.innerHTML = '<div id="sib-ai-head"><div><strong>Maya · Assistant SIB</strong><small>Propulsé par l’IA SIB</small></div><button id="sib-ai-close" type="button" aria-label="Fermer">×</button></div><div id="sib-ai-messages" aria-live="polite"></div><form id="sib-ai-form"><input id="sib-ai-input" maxlength="2000" autocomplete="off" placeholder="Posez votre question…" aria-label="Votre message" required><button id="sib-ai-send" type="submit">Envoyer</button></form><div id="sib-ai-note">Les actions financières et envois externes nécessitent votre validation.</div>';
  document.body.appendChild(launch); document.body.appendChild(panel);
  const messages = panel.querySelector("#sib-ai-messages"), input = panel.querySelector("#sib-ai-input"), send = panel.querySelector("#sib-ai-send");
  const history = [];
  function add(role,text){const el=document.createElement("div");el.className="sib-ai-msg "+(role==="user"?"user":"bot");el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;}
  function open(){panel.classList.add("open");if(!messages.childElementCount)add("bot","Bonjour ! Je suis Maya, l’assistant IA de SIB Gestion, connecté au service IA SIB. Comment puis-je vous aider ?");input.focus();}
  launch.addEventListener("click",()=>panel.classList.contains("open")?panel.classList.remove("open"):open());
  panel.querySelector("#sib-ai-close").addEventListener("click",()=>panel.classList.remove("open"));
  panel.querySelector("#sib-ai-form").addEventListener("submit",async function(e){
    e.preventDefault();const message=input.value.trim();if(!message||send.disabled)return;
    add("user",message);history.push({role:"user",content:message});input.value="";send.disabled=true;send.textContent="…";
    try{
      const cloud=window.SIBCloud, client=cloud&&cloud.client&&cloud.client();
      if(!cloud||!cloud.ready||!client)throw new Error("Le service Supabase n’est pas configuré.");
      const {data:sessionData,error:sessionError}=await client.auth.getSession();
      if(sessionError)throw sessionError;if(!sessionData.session)throw new Error("Connectez-vous à SIB Gestion pour utiliser l’assistant.");
      const {data,error}=await client.functions.invoke("sib-ai-agent",{body:{message,history:history.slice(-10)}});
      if(error){
        let detail=(data&&data.error)||error.message||"Service IA indisponible.";
        try{const response=error.context;if(response&&typeof response.json==="function"){const payload=await response.clone().json();if(payload&&payload.error)detail=payload.error;else if(payload&&payload.message)detail=payload.message;}}catch(_ignored){}
        throw new Error(detail);
      }
      if(!data||!data.reply)throw new Error("Réponse vide du service IA.");
      add("bot",data.reply);history.push({role:"assistant",content:data.reply});
    }catch(err){add("bot","Je ne peux pas répondre pour le moment : "+String(err.message||err));}
    finally{send.disabled=false;send.textContent="Envoyer";input.focus();}
  });
})();