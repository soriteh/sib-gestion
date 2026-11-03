/* SIB Gestion — Documents administratifs */
(function(){
 "use strict";
 const TYPES=[
  ["demande","Demande"],["attestation","Attestation"],["recommandation","Lettre de recommandation"],["note","Note de service"]
 ];
 const $=id=>document.getElementById(id);
 const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 const today=()=>new Date().toISOString().slice(0,10);
 const fmt=d=>d?new Date(d+"T00:00:00").toLocaleDateString("fr-FR"):"";
 function init(){
  if(typeof S==="undefined")return;
  if(!Array.isArray(S.docs))S.docs=[];
  if(!P.some(x=>x[0]==="docs"))P.push(["docs","Documents administratifs"]);
  const adminGroup=GR.find(x=>String(x[0]).toLowerCase()==="administration");
  if(adminGroup){if(!adminGroup[1].includes("docs"))adminGroup[1].push("docs");}
  else GR.push(["Administration",["docs"]]);
  if(typeof IC!=="undefined")IC.docs="M7 3h7l5 5v13H7a2 2 0 01-2-2V5a2 2 0 012-2zM14 3v6h6M9 13h6M9 17h6";
  const sec=$("docs");if(!sec)return;
  sec.innerHTML='<div class="docs-head"><div><h2>Documents administratifs</h2><p>Rédigez, archivez et imprimez vos documents officiels au format A4.</p></div><button class="p" id="docNew">＋ Nouveau document</button></div><div class="docs-tools"><input id="docSearch" placeholder="Rechercher par référence, objet ou destinataire…"><select id="docFilter"><option value="">Tous les types</option>'+TYPES.map(t=>'<option value="'+t[0]+'">'+t[1]+'</option>').join("")+'</select></div><div id="docEditor" class="hide"></div><div id="docList"></div>';
  $("docNew").addEventListener("click",()=>editor());
  $("docSearch").addEventListener("input",list);
  $("docFilter").addEventListener("change",list);
  list();
  const style=document.createElement("style");style.textContent=`
  #docs{max-width:1180px;margin:auto}#docs .docs-head{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}#docs .docs-head h2{margin:0 0 6px}#docs .docs-head p{margin:0;color:var(--mu)}#docs .docs-tools{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0}#docs .docs-tools input{flex:1;min-width:230px}#docs .docs-tools select{min-width:190px}#docs .doc-card{background:var(--card, var(--bg2));border:1px solid var(--bd);border-radius:14px;padding:15px;margin:10px 0;display:flex;justify-content:space-between;gap:14px;align-items:center;flex-wrap:wrap}#docs .doc-card p{margin:5px 0;color:var(--mu)}#docs .doc-actions{display:flex;gap:7px;flex-wrap:wrap}#docs .doc-editor{border:1px solid var(--bd);border-radius:14px;padding:18px;margin:16px 0;background:var(--card,var(--bg2))}#docs .doc-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#docs label{display:block;font-size:13px;font-weight:600;margin:8px 0 5px}#docs input,#docs select,#docs textarea{width:100%;box-sizing:border-box}#docs textarea{min-height:130px;resize:vertical}#docs .doc-wide{grid-column:1/-1}#docs .doc-empty{text-align:center;padding:35px;color:var(--mu)}@media(max-width:650px){#docs .doc-grid{grid-template-columns:1fr}#docs .doc-wide{grid-column:auto}}@media print{body *{visibility:hidden!important}#docPrint,#docPrint *{visibility:visible!important}#docPrint{position:absolute!important;inset:0!important;width:100%!important;color:#111!important;background:#fff!important;padding:22mm!important;font:12pt/1.55 Arial,sans-serif!important}#docPrint .doc-print-head{border-bottom:3px solid #0057B9;padding-bottom:12px;margin-bottom:26px}#docPrint h1{text-align:center;font-size:17pt;margin:28px 0}#docPrint .doc-sign{margin-top:55px;display:flex;justify-content:space-between}#docPrint .doc-body{white-space:pre-wrap;min-height:220px}#docPrint .doc-ref{font-size:10pt;color:#444}}`;
  document.head.appendChild(style);
  if(typeof mk==="function")mk();
  if(!window.__sibDocsNavWrapped){window.__sibDocsNavWrapped=true;const old=nav;window.nav=nav=function(v){old(v);if(v==="docs")list();};}
 }
 function nextRef(){const y=new Date().getFullYear();const n=S.docs.filter(d=>String(d.ref||"").includes("/"+y+"/")).length+1;return "SIB/DOC/"+y+"/"+String(n).padStart(3,"0");}
 function editor(d){
  d=d||{};const ed=$("docEditor");ed.classList.remove("hide");
  ed.innerHTML='<div class="doc-editor"><h3>'+(d.id?"Modifier":"Nouveau document")+'</h3><div class="doc-grid"><div><label>Type de document</label><select id="dType">'+TYPES.map(t=>'<option value="'+t[0]+'" '+(d.type===t[0]?"selected":"")+'>'+t[1]+'</option>').join("")+'</select></div><div><label>Référence</label><input id="dRef" value="'+esc(d.ref||nextRef())+'"></div><div><label>Date</label><input id="dDate" type="date" value="'+esc(d.date||today())+'"></div><div><label>Destinataire</label><input id="dTo" value="'+esc(d.to||"")+'" placeholder="Nom, fonction ou organisme"></div><div class="doc-wide"><label>Objet</label><input id="dSubject" value="'+esc(d.subject||"")+'" placeholder="Objet du document"></div><div><label>Personne concernée (facultatif)</label><input id="dPerson" value="'+esc(d.person||"")+'"></div><div><label>Fonction / qualité</label><input id="dRole" value="'+esc(d.role||"")+'"></div><div class="doc-wide"><label>Contenu du document</label><textarea id="dBody" placeholder="Rédigez le texte du document…">'+esc(d.body||"")+'</textarea></div><div><label>Nom du signataire</label><input id="dSigner" value="'+esc(d.signer||"Soriba Camara")+'"></div><div><label>Fonction du signataire</label><input id="dSignerRole" value="'+esc(d.signerRole||"Gérant")+'"></div></div><div class="doc-actions" style="margin-top:16px"><button class="p" id="dSave">Enregistrer</button><button class="s" id="dPreview">Aperçu / Imprimer</button><button class="dg" id="dCancel">Annuler</button></div></div>';
  $("dCancel").onclick=()=>ed.classList.add("hide");
  $("dSave").onclick=()=>{const x={id:d.id||("doc_"+Date.now()),type:$("dType").value,ref:$("dRef").value.trim(),date:$("dDate").value,to:$("dTo").value.trim(),subject:$("dSubject").value.trim(),person:$("dPerson").value.trim(),role:$("dRole").value.trim(),body:$("dBody").value,signer:$("dSigner").value.trim(),signerRole:$("dSignerRole").value.trim(),updatedAt:new Date().toISOString()};if(!x.ref||!x.subject||!x.body.trim()){toast("Renseignez au minimum la référence, l’objet et le contenu.","wa");return;}const i=S.docs.findIndex(z=>z.id===x.id);if(i>=0)S.docs[i]=x;else S.docs.unshift(x);save();ed.classList.add("hide");list();toast("Document enregistré.","ok");};
  $("dPreview").onclick=()=>{const x=readEditor(d);printDoc(x);};
 }
 function readEditor(d){return {id:d.id||"",type:$("dType").value,ref:$("dRef").value,date:$("dDate").value,to:$("dTo").value,subject:$("dSubject").value,person:$("dPerson").value,role:$("dRole").value,body:$("dBody").value,signer:$("dSigner").value,signerRole:$("dSignerRole").value};}
 function list(){
  if(!$("docList")||typeof S==="undefined")return;
  const q=($("docSearch")?.value||"").toLowerCase(),f=$("docFilter")?.value||"";
  const rows=S.docs.filter(d=>(!f||d.type===f)&&[d.ref,d.subject,d.to,d.person].some(v=>String(v||"").toLowerCase().includes(q)));
  $("docList").innerHTML=rows.length?rows.map(d=>'<article class="doc-card"><div><b>'+esc(d.subject)+'</b><p>'+esc(d.ref)+' · '+esc(TYPES.find(t=>t[0]===d.type)?.[1]||d.type)+' · '+fmt(d.date)+'</p><small>'+esc(d.to||"Sans destinataire")+'</small></div><div class="doc-actions"><button class="s" data-doc-edit="'+esc(d.id)+'">Modifier</button><button class="p" data-doc-print="'+esc(d.id)+'">Imprimer</button><button class="dg" data-doc-del="'+esc(d.id)+'">Supprimer</button></div></article>').join(""):'<div class="doc-empty">Aucun document administratif enregistré.</div>';
  $("docList").querySelectorAll("[data-doc-edit]").forEach(b=>b.onclick=()=>editor(S.docs.find(d=>d.id===b.dataset.docEdit)));
  $("docList").querySelectorAll("[data-doc-print]").forEach(b=>b.onclick=()=>printDoc(S.docs.find(d=>d.id===b.dataset.docPrint)));
  $("docList").querySelectorAll("[data-doc-del]").forEach(b=>b.onclick=()=>{const d=S.docs.find(x=>x.id===b.dataset.docDel);if(!d)return;if(confirm("Supprimer le document « "+d.subject+" » ?")){S.docs=S.docs.filter(x=>x.id!==d.id);save();list();toast("Document supprimé.","ok");}});
 }
 function printDoc(d){
  if(!d)return;
  let p=document.getElementById("docPrint");if(!p){p=document.createElement("div");p.id="docPrint";document.body.appendChild(p);}
  const label=TYPES.find(t=>t[0]===d.type)?.[1]||"Document";
  p.innerHTML='<div class="doc-print-head"><strong style="font-size:20pt;color:#0057B9">SIB</strong><br><b>SORITECH INNOV BUSINESS</b><br><span>INNOVER • DÉVELOPPER • CONNECTER</span><br><small>Kipé, Ratoma · Conakry, Guinée</small></div><div class="doc-ref">Réf. : '+esc(d.ref)+' <span style="float:right">Conakry, le '+fmt(d.date)+'</span></div><h1>'+esc(label.toUpperCase())+'</h1><p><b>À l’attention de :</b> '+esc(d.to||"")+'</p><p><b>Objet :</b> '+esc(d.subject)+'</p>'+(d.person?'<p><b>Personne concernée :</b> '+esc(d.person)+(d.role?' — '+esc(d.role):"")+'</p>':"")+'<div class="doc-body">'+esc(d.body)+'</div><div class="doc-sign"><div></div><div style="text-align:center"><b>'+esc(d.signer||"Soriba Camara")+'</b><br>'+esc(d.signerRole||"Gérant")+'<br><br><br><span>Signature et cachet</span></div></div>';
  window.print();
 }
 if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();
})();