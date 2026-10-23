/* SIB Gestion — assistant IA flottant. Clé OpenAI conservée côté serveur. */
(function () {
  "use strict";
  if (window.__SIB_AI_AGENT_LOADED) return;
  window.__SIB_AI_AGENT_LOADED = true;
  const css = `
  #sib-ai-launch{position:fixed;right:22px;bottom:22px;z-index:9998;border:0;border-radius:999px;background:#0057b9;color:#fff;padding:14px 18px;font:600 14px system-ui;box-shadow:0 8px 28px #071a3640;cursor:pointer}
  #sib-ai-panel{position:fixed;right:22px;bottom:82px;z-index:9999;width:min(380px,calc(100vw - 28px));height:min(540px,calc(100vh - 115px));background:var(--card,#fff);color:var(--text,#071a36);border:1px solid #0057b933;border-radius:16px;box-shadow:0 18px 60px #071a3640;display:none;overflow:hidden;font:14px system-ui}
  #sib-ai-panel.open{display:flex;flex-direction:column}
  #sib-ai-head{padding:14px 16px;background:#071a36;color:#fff;display:flex;align-items:center;justify-content:space-between}
  #sib-ai-head strong{font-size:15px} #sib-ai-head small{display:block;opacity:.8;margin-top:3px}
  #sib-ai-close{border:0;background:transparent;color:#fff;font-size:24px;cursor:pointer}
  #sib-ai-messages{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}
  .sib-ai-msg{padding:10px 12px;border-radius:12px;max-width:90%;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45}
  .sib-ai-msg.bot{background:#eef4fb;align-self:flex-start;color:#071a36}.sib-ai-msg.user{background:#0057b9;color:white;align-self:flex-end}
  #sib-ai-form{display:flex;gap:8px;padding:12px;border-top:1px solid #d9e2ef}
  #sib-ai-input{min-width:0;flex:1;padding:11px;border:1px solid #b9c8da;border-radius:10px;background:transparent;color:inherit;font:inherit}
  #sib-ai-send{border:0;border-radius:10px;background:#ff7800;color:#fff;font-weight:700;padding:0 14px;cursor:pointer}
  #sib-ai-send:disabled{opacity:.5;cursor:wait}
  #sib-ai-note{font-size:11px;padding:0 12px 10px;opacity:.7}
  `;
  const style = document.createElement("style"); style.textContent = css; document.head.appendChild(style);
  const launch = document.createElement("button"); launch.id = "sib-ai-launch"; launch.type = "button"; launch.textContent = "✦ Assistant IA";
  launch.setAttribute("aria-label","Ouvrir l’assistant IA SIB");
  const panel = document.createElement("section"); panel.id = "sib-ai-panel"; panel.setAttribute("aria-label","Assistant IA SIB Gestion");
  panel.innerHTML = '<div id="sib-ai-head"><div><strong>Maya · Assistant SIB</strong><small>Aide à l’utilisation de SIB Gestion</small></div><button id="sib-ai-close" type="button" aria-label="Fermer">×</button></div><div id="sib-ai-messages" aria-live="polite"></div><form id="sib-ai-form"><input id="sib-ai-input" maxlength="2000" autocomplete="off" placeholder="Posez votre question…" aria-label="Votre message" required><button id="sib-ai-send" type="submit">Envoyer</button></form><div id="sib-ai-note">Les actions financières et envois externes nécessitent votre validation.</div>';
  document.body.appendChild(launch); document.body.appendChild(panel);
  const messages = panel.querySelector("#sib-ai-messages"), input = panel.querySelector("#sib-ai-input"), send = panel.querySelector("#sib-ai-send");
  const history = [];
  function add(role,text){const el=document.createElement("div");el.className="sib-ai-msg "+(role==="user"?"user":"bot");el.textContent=text;messages.appendChild(el);messages.scrollTop=messages.scrollHeight;}
  function open(){panel.classList.add("open");if(!messages.childElementCount)add("bot","Bonjour ! Je suis Maya, l’assistant IA de SIB Gestion. Je peux vous aider à comprendre les modules, préparer des relances et vous guider dans les opérations. Que souhaitez-vous faire ?");input.focus();}
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
      if(error)throw new Error(data&&data.error||error.message||"Service IA indisponible.");
      if(!data||!data.reply)throw new Error("Réponse vide du service IA.");
      add("bot",data.reply);history.push({role:"assistant",content:data.reply});
    }catch(err){add("bot","Je ne peux pas répondre pour le moment : "+String(err.message||err));}
    finally{send.disabled=false;send.textContent="Envoyer";input.focus();}
  });
})();