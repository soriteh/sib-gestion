/* SIB Gestion — assistant IA flottant multi-fournisseur. */
(function () {
  "use strict";
  if (window.__SIB_AI_AGENT_LOADED) return;
  window.__SIB_AI_AGENT_LOADED = true;
  const css = `
  body.lo #sib-ai-launch,body.lo #sib-ai-panel{display:none!important;visibility:hidden!important;pointer-events:none!important}
  #sib-ai-launch{position:fixed;right:22px;bottom:22px;z-index:9998;width:64px;height:64px;min-width:64px;min-height:64px;aspect-ratio:1/1;box-sizing:border-box;display:grid;place-items:center;border:1px solid rgba(255,255,255,.9);border-radius:12px;background:#fff;padding:3px;overflow:hidden;box-shadow:0 8px 28px #071a3640;cursor:pointer;transition:transform .2s,box-shadow .2s}
  #sib-ai-launch:hover{transform:translateY(-2px);box-shadow:0 12px 32px #071a3660}#sib-ai-launch img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important;object-position:center!important;aspect-ratio:1/1!important;border-radius:8px!important;padding:0!important;margin:0!important;flex:none!important;transform:none!important;filter:none!important}
  #sib-ai-launch.sib-ai-logo-failed{background:#fff}#sib-ai-launch:focus-visible{outline:3px solid #ff7800;outline-offset:3px}
  #sib-ai-panel{position:fixed;right:22px;bottom:82px;z-index:9999;width:min(380px,calc(100vw - 28px));height:min(540px,calc(100vh - 115px));background:#ffffff!important;color:#071a36!important;opacity:1!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important;border:1px solid #cbd5e1;border-radius:16px;box-shadow:0 18px 60px #071a3670;display:none;overflow:hidden;font:14px system-ui;isolation:isolate}
  #sib-ai-panel.open{display:flex;flex-direction:column}
  #sib-ai-head{flex:0 0 auto;padding:12px 14px;background:linear-gradient(115deg,#071a36,#0057b9)!important;color:#fff!important;display:flex;align-items:center;justify-content:space-between;gap:12px;border-bottom:1px solid #4abaff70}
  #sib-ai-brand{display:flex;align-items:center;gap:10px;min-width:0}#sib-ai-brand-copy{min-width:0}#sib-ai-avatar{display:block;width:42px;height:42px;flex:none;border-radius:12px;box-shadow:0 0 0 1px #78d9ff80,0 0 18px #149fff55;animation:sibMayaGlow 2.8s ease-in-out infinite}
  #sib-ai-head strong{font-size:15px;letter-spacing:.1px} #sib-ai-head small{display:block;opacity:.9;margin-top:3px}
  @keyframes sibMayaGlow{0%,100%{filter:drop-shadow(0 0 2px #35baff55)}50%{filter:drop-shadow(0 0 7px #35baffaa)}}
  .sib-ai-thinking{display:flex;align-items:center;gap:9px;align-self:flex-start;max-width:90%;padding:8px 12px;border-radius:12px;background:#eef4fb;color:#071a36;font-size:12px}
  .sib-ai-thinking img{width:30px;height:30px;border-radius:9px;animation:sibMayaGlow 1.2s ease-in-out infinite}
  .sib-ai-dots{display:inline-flex;gap:4px}.sib-ai-dots i{width:5px;height:5px;border-radius:50%;background:#ff7800;animation:sibMayaDot 1s ease-in-out infinite}.sib-ai-dots i:nth-child(2){animation-delay:.15s}.sib-ai-dots i:nth-child(3){animation-delay:.3s}
  @keyframes sibMayaDot{0%,60%,100%{opacity:.35;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)} }
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
  @media(max-width:480px){#sib-ai-panel{right:10px;bottom:76px;width:calc(100vw - 20px);height:min(540px,calc(100vh - 100px))}#sib-ai-launch{right:14px;bottom:14px;width:58px;height:58px;min-width:58px;min-height:58px;border-radius:12px}}
  `;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
  const launch = document.createElement("button"); launch.id = "sib-ai-launch"; launch.type = "button";
  const logo = document.createElement("img");
  /* Use the exact same square mark as the sidebar. Resolve from the app document and bypass stale asset caches. */
  const logoUrl = new URL("./assets/maya-ai.svg?v=20261026-maya-ai-1", document.baseURI).href;
  logo.src = logoUrl;
  logo.onerror = function () { this.onerror = null; launch.classList.add("sib-ai-logo-failed"); this.remove(); };
  logo.alt = "Maya, intelligence artificielle SIB"; logo.loading = "eager"; logo.decoding = "async";
  logo.addEventListener("load", function () { launch.classList.add("sib-ai-logo-loaded"); });
  logo.addEventListener("error", function () { launch.classList.add("sib-ai-logo-failed"); });
  launch.appendChild(logo);
  launch.setAttribute("aria-label","Ouvrir Maya, l’assistant de SIB Gestion");
  launch.title = "Ouvrir Maya · SIB Gestion";
  const panel = document.createElement("section"); panel.id = "sib-ai-panel"; panel.setAttribute("aria-label","Assistant IA SIB Gestion");
  panel.innerHTML = '<div id="sib-ai-head"><div id="sib-ai-brand"><img id="sib-ai-avatar" src="./assets/maya-ai.svg?v=20261026-maya-ai-1" alt="Avatar lumineux de Maya"><div id="sib-ai-brand-copy"><strong>Maya · Assistant IA</strong><small>Votre copilote SIB Gestion</small></div></div><button id="sib-ai-close" type="button" aria-label="Fermer">×</button></div><div id="sib-ai-messages" aria-live="polite"></div><form id="sib-ai-form"><input id="sib-ai-input" maxlength="2000" autocomplete="off" placeholder="Posez votre question…" aria-label="Votre message" required><button id="sib-ai-send" type="submit">Envoyer</button></form><div id="sib-ai-note">Les actions financières et envois externes nécessitent votre validation.</div>';
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
    let thinking=null;
    try{
      thinking=document.createElement("div");thinking.className="sib-ai-thinking";thinking.setAttribute("role","status");thinking.setAttribute("aria-label","Maya prépare une réponse");
      const thinkingLogo=document.createElement("img");thinkingLogo.src=new URL("./assets/maya-ai.svg?v=20261026-maya-ai-1",document.baseURI).href;thinkingLogo.alt="";thinkingLogo.setAttribute("aria-hidden","true");
      const thinkingLabel=document.createElement("span");thinkingLabel.textContent="Maya réfléchit";
      const dots=document.createElement("span");dots.className="sib-ai-dots";dots.setAttribute("aria-hidden","true");dots.innerHTML="<i></i><i></i><i></i>";
      thinking.append(thinkingLogo,thinkingLabel,dots);messages.appendChild(thinking);messages.scrollTop=messages.scrollHeight;
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
    finally{if(thinking)thinking.remove();send.disabled=false;send.textContent="Envoyer";input.focus();}
  });
})();