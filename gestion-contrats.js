(function () {
  "use strict";
  if (window.__SIB_CONTRACTS_LOADED) return;
  window.__SIB_CONTRACTS_LOADED = true;
  var rootId = "contracts";
  var h = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var money = function (v) { return Math.round(Number(v) || 0).toLocaleString("fr-FR") + " " + ((S.set && S.set.sym) || "GNF"); };
  var uid = function () { return "ctr_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); };
  var list = function () { if (!Array.isArray(S.contracts)) S.contracts = []; return S.contracts; };
  var say = function (m, t) { if (typeof toast === "function") toast(m, t || "ok"); else alert(m); };
  var log = function (m) { try { if (typeof lg === "function") lg(m); } catch (e) { console.warn(e); } };
  var dateLabel = function (v) { if (!v) return "—"; var d = new Date(v + "T00:00:00"); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("fr-FR"); };
  var status = function (x) { return x.status === "Actif" && x.endDate && x.endDate < today() ? "Expiré" : (x.status || "Brouillon"); };
  var badge = function (v) { return '<span class="bd ' + (v === "Actif" ? "ok" : (v === "Expiré" || v === "Résilié" ? "no" : (v === "Terminé" ? "mu" : "wa"))) + '">' + h(v) + '</span>'; };
  var reference = function () {
    var year = new Date().getFullYear(), max = list().reduce(function (n, x) {
      var m = String(x.reference || "").match(/^CTR-\d{4}-(\d+)$/); return m ? Math.max(n, Number(m[1]) || 0) : n;
    }, 0);
    return "CTR-" + year + "-" + String(max + 1).padStart(5, "0");
  };
  var partyNames = function () {
    var a = [];
    (S.c || []).forEach(function (x) { if (x && (x.n || x.name || x.nom)) a.push(x.n || x.name || x.nom); });
    (S.fo || []).forEach(function (x) { if (x && (x.n || x.name || x.nom)) a.push(x.n || x.name || x.nom); });
    (S.us || []).forEach(function (x) { if (x && (x.nom || x.name || x.mail)) a.push(x.nom || x.name || x.mail); });
    return Array.from(new Set(a)).sort();
  };
  var render = function () {
    var root = document.getElementById(rootId); if (!root) return;
    var all = list().slice().sort(function (a, b) { return String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")); });
    var q = (root.querySelector("#sc-search") || {}).value || "";
    var f = (root.querySelector("#sc-filter") || {}).value || "Tous";
    var active = all.filter(function (x) { return status(x) === "Actif"; });
    var soon = active.filter(function (x) { if (!x.endDate) return false; var d = Math.ceil((new Date(x.endDate + "T00:00:00") - new Date(today() + "T00:00:00")) / 86400000); return d >= 0 && d <= 30; });
    var expired = all.filter(function (x) { return status(x) === "Expiré"; });
    var commitment = active.reduce(function (n, x) { return n + (Number(x.amount) || 0); }, 0);
    var rows = all.filter(function (x) {
      return (!q || [x.reference,x.contractType,x.category,x.party,x.title,x.status].join(" ").toLowerCase().indexOf(q.toLowerCase()) >= 0) && (f === "Tous" || status(x) === f);
    }).map(function (x) {
      return '<tr><td><b>' + h(x.reference) + '</b></td><td>' + h(x.title) + '<small class="sc-sub">' + h(x.contractType || x.category || "Autre") + '</small></td><td>' + h(x.party) + '</td><td>' + dateLabel(x.startDate) + '</td><td>' + dateLabel(x.endDate) + '</td><td class="r">' + money(x.amount) + '</td><td>' + badge(status(x)) + '</td><td class="sc-actions"><button class="s" data-sc-action="edit" data-id="' + h(x.id) + '">Modifier</button> <button class="s" data-sc-action="print" data-id="' + h(x.id) + '">PDF</button> <button class="s" data-sc-action="close" data-id="' + h(x.id) + '">Clôturer</button></td></tr>';
    }).join("");
    root.innerHTML = '<div class="sc-head"><div><h2>Gestion des contrats</h2><p>Suivi des engagements, des dates de validité, des renouvellements et des échéances.</p></div><button class="p" id="sc-new">＋ Nouveau contrat</button></div>' +
      '<div class="sc-kpis"><div class="k"><span>Contrats enregistrés</span><b>' + all.length + '</b></div><div class="k"><span>Contrats actifs</span><b>' + active.length + '</b></div><div class="k"><span>Échéances sous 30 jours</span><b>' + soon.length + '</b></div><div class="k"><span>Contrats expirés</span><b>' + expired.length + '</b></div><div class="k"><span>Engagements actifs</span><b>' + money(commitment) + '</b></div></div>' +
      '<div id="sc-editor"></div><div class="box"><div class="sc-toolbar"><input id="sc-search" type="search" placeholder="Rechercher un contrat, une référence, une partie…" value="' + h(q) + '"><select id="sc-filter"><option' + (f === "Tous" ? " selected" : "") + '>Tous</option>' + ["Brouillon","À signer","Actif","Suspendu","Expiré","Terminé","Résilié"].map(function (x) { return '<option' + (f === x ? " selected" : "") + '>' + x + '</option>'; }).join("") + '</select></div><div class="tw"><table><thead><tr><th>Référence</th><th>Objet</th><th>Partie concernée</th><th>Début</th><th>Fin</th><th class="r">Montant</th><th>Statut</th><th>Actions</th></tr></thead><tbody>' + (rows || '<tr><td colspan="8" class="sc-empty">Aucun contrat enregistré.</td></tr>') + '</tbody></table></div></div>';
    root.querySelector("#sc-new").onclick = function () { editor(null); };
    root.querySelector("#sc-search").oninput = function () { var value = this.value, pos = this.selectionStart; render(); var input = root.querySelector("#sc-search"); if (input) { input.focus(); input.setSelectionRange(pos, pos); } };
    root.querySelector("#sc-filter").onchange = render;
    root.querySelectorAll("[data-sc-action]").forEach(function (b) { b.onclick = function () { action(b.dataset.scAction, b.dataset.id); }; });
  };
  var editor = function (item) {
    var x = item || {}, root = document.getElementById("sc-editor"), names = partyNames();
    var options = names.map(function (n) { return '<option value="' + h(n) + '"></option>'; }).join("");
    var categories = ["Client","Fournisseur","Employé","Partenaire","Prestataire","Autre"];
    var contractTypes = ["Prestation de services","Contrat de travail","Fourniture / vente","Maintenance informatique","Location / bail","Partenariat","Sous-traitance","Confidentialité (NDA)","Courtage / commission","Autre"];
    var states = ["Brouillon","À signer","Actif","Suspendu","Terminé","Résilié"];
    var detailFields = {
      "Prestation de services":[["serviceScope","Périmètre des prestations","text",true],["deliverables","Livrables attendus","textarea"],["serviceFrequency","Fréquence / calendrier","text",true],["serviceLocation","Lieu d’exécution","text"]],
      "Contrat de travail":[["jobTitle","Poste / fonction","text",true],["workLocation","Lieu de travail","text",true],["workSchedule","Horaires / durée du travail","text",true],["salary","Rémunération mensuelle (GNF)","number",true],["probation","Période d’essai","text"]],
      "Fourniture / vente":[["goods","Produits / matériels concernés","textarea",true],["quantity","Quantité / lots","text",true],["deliveryDate","Date de livraison prévue","date",true],["warranty","Garantie","text"],["deliveryLocation","Lieu de livraison","text"]],
      "Maintenance informatique":[["equipment","Équipements / systèmes couverts","textarea",true],["maintenanceScope","Préventif, correctif, assistance…","textarea",true],["interventionTime","Délai d’intervention","text",true],["maintenanceFrequency","Fréquence des visites","text"]],
      "Location / bail":[["property","Bien / local loué","text",true],["propertyAddress","Adresse du bien","text",true],["rent","Loyer périodique (GNF)","number",true],["deposit","Caution / dépôt (GNF)","number"],["charges","Charges et responsabilités","textarea"]],
      "Partenariat":[["partnershipPurpose","Objet du partenariat","textarea",true],["contributions","Contributions de chaque partie","textarea",true],["revenueShare","Répartition des revenus / bénéfices","text"],["governance","Organisation et responsabilités","textarea"]],
      "Sous-traitance":[["subcontractScope","Travaux / mission sous-traités","textarea",true],["mainContract","Référence du marché principal","text"],["subcontractDeadline","Délai d’exécution","date",true],["acceptance","Conditions de réception","textarea"]],
      "Confidentialité (NDA)":[["confidentialInfo","Informations couvertes","textarea",true],["authorizedUse","Usage autorisé","textarea",true],["ndaDuration","Durée de confidentialité","text",true],["exceptions","Exceptions / divulgations autorisées","textarea"]],
      "Courtage / commission":[["brokerMission","Mission de courtage","textarea",true],["commissionRate","Taux ou montant de commission","text",true],["commissionTrigger","Fait générateur de la commission","text",true],["exclusivity","Exclusivité","text"]],
      "Autre":[["specificTerms","Informations spécifiques au contrat","textarea"]]
    };
    var fieldMarkup = function (f, value) {
      var required = f[3] ? " required" : "";
      var tag = f[2] === "textarea" ? '<textarea data-detail="' + f[0] + '" rows="2"' + required + '>' + h(value || "") + '</textarea>' : '<input data-detail="' + f[0] + '" type="' + f[2] + '" value="' + h(value || "") + '"' + required + '>';
      return '<div' + (f[2] === "textarea" ? ' class="wide"' : '') + '><label>' + h(f[1]) + (f[3] ? ' *' : '') + '</label>' + tag + '</div>';
    };
    var details = function (type) { return (detailFields[type] || detailFields["Autre"]).map(function (f) { return fieldMarkup(f, (x.typeDetails || {})[f[0]]); }).join(""); };
    var profiles = {
      "Prestation de services":{category:"Client",party:"Client / bénéficiaire",amount:"Montant total du contrat (GNF)",showAmount:true,showPayment:true,showRenew:true},
      "Contrat de travail":{category:"Employé",party:"Employé / salarié",amount:"Rémunération définie dans les détails",showAmount:false,showPayment:false,showRenew:false},
      "Fourniture / vente":{category:"Fournisseur",party:"Fournisseur / acheteur",amount:"Valeur totale de la fourniture (GNF)",showAmount:true,showPayment:true,showRenew:false},
      "Maintenance informatique":{category:"Client",party:"Client bénéficiaire",amount:"Montant du contrat (GNF)",showAmount:true,showPayment:true,showRenew:true},
      "Location / bail":{category:"Autre",party:"Bailleur / locataire",amount:"Loyer défini dans les détails",showAmount:false,showPayment:true,showRenew:true},
      "Partenariat":{category:"Partenaire",party:"Partenaire contractuel",amount:"Valeur estimée de l’accord (GNF)",showAmount:true,showPayment:true,showRenew:false},
      "Sous-traitance":{category:"Prestataire",party:"Sous-traitant / donneur d’ordre",amount:"Montant de la sous-traitance (GNF)",showAmount:true,showPayment:true,showRenew:false},
      "Confidentialité (NDA)":{category:"Partenaire",party:"Partie signataire",amount:"Sans objet",showAmount:false,showPayment:false,showRenew:false},
      "Courtage / commission":{category:"Client",party:"Client / mandant",amount:"Montant estimé de l’opération (GNF)",showAmount:true,showPayment:true,showRenew:false},
      "Autre":{category:"Autre",party:"Partie concernée",amount:"Montant du contrat (GNF)",showAmount:true,showPayment:true,showRenew:true}
    };
    var applyProfile = function (type, setCategory) {
      var p = profiles[type] || profiles.Autre;
      var category = root.querySelector("#sc-category"), partyLabel = root.querySelector("#sc-party-label"), amountLabel = root.querySelector("#sc-amount-label");
      if (setCategory && category) category.value = p.category;
      if (partyLabel) partyLabel.textContent = p.party + " *";
      if (amountLabel) amountLabel.textContent = p.amount;
      ["sc-amount-wrap","sc-payment-wrap","sc-renew-wrap"].forEach(function (id, i) {
        var el = root.querySelector("#" + id); if (el) el.hidden = ![p.showAmount,p.showPayment,p.showRenew][i];
      });
    };
    root.innerHTML = '<div class="box sc-form-box"><div class="sc-form-title"><h3>' + (x.id ? "Modifier le contrat" : "Nouveau contrat") + '</h3><span class="bd mu">' + h(x.reference || reference()) + '</span></div><div class="sc-form">' +
      '<div><label>Nature du contrat *</label><select id="sc-type">' + contractTypes.map(function (v) { return '<option' + ((x.contractType || "Prestation de services") === v ? " selected" : "") + '>' + v + '</option>'; }).join("") + '</select></div>' +
      '<div><label>Catégorie de la partie *</label><select id="sc-category">' + categories.map(function (v) { return '<option' + ((x.category || "Client") === v ? " selected" : "") + '>' + v + '</option>'; }).join("") + '</select></div>' +
      '<div><label id="sc-party-label">Partie concernée *</label><input id="sc-party" list="sc-parties" value="' + h(x.party || "") + '" placeholder="Nom de la partie"><datalist id="sc-parties">' + options + '</datalist></div>' +
      '<div class="wide"><label>Objet du contrat *</label><input id="sc-title" value="' + h(x.title || "") + '" placeholder="Ex. Maintenance informatique annuelle"></div>' +
      '<div class="wide"><strong>Informations propres au contrat</strong></div><div id="sc-type-details" class="wide sc-type-details">' + details(x.contractType || "Prestation de services") + '</div>' +
      '<div><label>Date de signature</label><input id="sc-sign" type="date" value="' + h(x.signDate || "") + '"></div><div><label>Date de début *</label><input id="sc-start" type="date" value="' + h(x.startDate || today()) + '"></div><div><label>Date de fin</label><input id="sc-end" type="date" value="' + h(x.endDate || "") + '"></div>' +
      '<div id="sc-amount-wrap"><label id="sc-amount-label">Montant du contrat (GNF)</label><input id="sc-amount" type="number" min="0" step="1" value="' + h(x.amount == null ? 0 : x.amount) + '"></div><div><label>Statut</label><select id="sc-status">' + states.map(function (v) { return '<option' + ((x.status || "Brouillon") === v ? " selected" : "") + '>' + v + '</option>'; }).join("") + '</select></div><div><label>Préavis (jours)</label><input id="sc-notice" type="number" min="0" value="' + h(x.noticeDays == null ? 30 : x.noticeDays) + '"></div>' +
      '<div id="sc-renew-wrap"><label>Renouvellement automatique</label><select id="sc-renew"><option value="non"' + (x.autoRenew ? "" : " selected") + '>Non</option><option value="oui"' + (x.autoRenew ? " selected" : "") + '>Oui</option></select></div><div id="sc-payment-wrap"><label>Modalités de paiement</label><input id="sc-payment" value="' + h(x.paymentTerms || "") + '" placeholder="Mensuel, à la livraison…"></div><div class="wide"><label>Lien du document signé (facultatif)</label><input id="sc-url" type="url" value="' + h(x.documentUrl || "") + '" placeholder="https://…"></div>' +
      '<div class="wide"><div class="sc-ai-row"><label for="sc-description">Description / clauses importantes</label><button type="button" class="s sc-ai-btn" id="sc-ai-generate">✦ Générer avec SIB</button></div><textarea id="sc-description" rows="5" placeholder="Décrivez les engagements, obligations, délais, garanties et conditions particulières…">' + h(x.description || "") + '</textarea><small class="sc-ai-help">SIB rédige un texte adapté au contrat. Relisez et validez les clauses avant signature.</small><div id="sc-ai-status" class="sc-ai-status" aria-live="polite"></div></div><div class="wide"><label>Observations internes</label><textarea id="sc-notes" rows="3">' + h(x.notes || "") + '</textarea></div></div><div class="sc-form-actions"><button class="p" id="sc-save">Enregistrer le contrat</button><button class="s" id="sc-cancel">Annuler</button></div></div>';
    root.scrollIntoView({behavior:"smooth",block:"start"});
    applyProfile(x.contractType || "Prestation de services", false);
    root.querySelector("#sc-type").onchange = function () { root.querySelector("#sc-type-details").innerHTML = details(this.value); applyProfile(this.value, true); };
    root.querySelector("#sc-ai-generate").onclick = async function () {
      var button = this, statusBox = root.querySelector("#sc-ai-status"), description = root.querySelector("#sc-description");
      if (description.value.trim() && !confirm("La génération remplacera le texte actuellement présent dans Description / clauses importantes. Continuer ?")) return;
      var cloud = window.SIBCloud, client = cloud && typeof cloud.client === "function" ? cloud.client() : null;
      if (!cloud || !client || !cloud.ready) return say("Le service IA nécessite une connexion SIB et une configuration Supabase active.", "wa");
      var type = root.querySelector("#sc-type").value, detailsText = [];
      root.querySelectorAll("[data-detail]").forEach(function (field) { var label = field.previousElementSibling ? field.previousElementSibling.textContent.replace(/\\s*\\*$/, "") : field.dataset.detail; if (field.value.trim()) detailsText.push(label + " : " + field.value.trim()); });
      var context = [
        "Type de contrat : " + type,
        "Catégorie : " + root.querySelector("#sc-category").value,
        "Partie(s) : " + root.querySelector("#sc-party").value.trim(),
        "Objet : " + root.querySelector("#sc-title").value.trim(),
        "Date de signature : " + (root.querySelector("#sc-sign").value || "Non précisée"),
        "Début : " + (root.querySelector("#sc-start").value || "Non précisé"),
        "Fin : " + (root.querySelector("#sc-end").value || "Non précisée"),
        "Montant : " + (root.querySelector("#sc-amount").value || "Non précisé") + " GNF",
        "Modalités de paiement : " + (root.querySelector("#sc-payment").value.trim() || "Non précisées"),
        "Renouvellement automatique : " + (root.querySelector("#sc-renew").value === "oui" ? "Oui" : "Non"),
        "Préavis : " + (root.querySelector("#sc-notice").value || "30") + " jours",
        "Détails propres au contrat : " + (detailsText.join("; ") || "Aucun détail supplémentaire")
      ].join("\n");
      var message = "Rédige maintenant un projet complet de clauses contractuelles adapté au type de contrat ci-dessous. Fournis les clauses rédigées, numérotées et directement intégrables au contrat. Ne réponds pas par de simples conseils.\n\n" + context;
      if (message.length > 5800) message = message.slice(0, 5800) + "\n[Informations complémentaires tronquées : insérer [À PRÉCISER] si nécessaire.]";
      button.disabled = true; button.textContent = "Génération en cours…"; statusBox.textContent = "SIB prépare le contrat…";
      try {
        var result = await client.functions.invoke("sib-ai-agent", { body: { message: message, mode: "contract_draft" } });
        if (result.error) {
          var detail = result.data && result.data.error;
          if (!detail && result.error.context && typeof result.error.context.clone === "function") { try { var payload = await result.error.context.clone().json(); detail = payload.error || payload.message; } catch (_) {} }
          throw new Error(detail || result.error.message || "Le service IA n’a pas répondu.");
        }
        if (!result.data || result.data.ok !== true || typeof result.data.reply !== "string" || !result.data.reply.trim()) throw new Error((result.data && result.data.error) || "Réponse IA invalide.");
        description.value = result.data.reply.trim();
        description.focus();
        statusBox.textContent = "Proposition générée (" + description.value.length.toLocaleString("fr-FR") + " caractères). Relisez les clauses et complétez les éléments [À PRÉCISER] avant l’enregistrement.";
        say("Texte contractuel généré par SIB.", "ok");
      } catch (error) {
        statusBox.textContent = "Échec de la génération : " + (error && error.message ? error.message : "erreur inconnue");
        say("SIB : " + (error && error.message ? error.message : "génération impossible"), "wa");
      } finally {
        button.disabled = false; button.textContent = "✦ Générer avec SIB";
      }
    };
    root.querySelector("#sc-cancel").onclick = function () { root.innerHTML = ""; };
    root.querySelector("#sc-save").onclick = function () {
      var party = root.querySelector("#sc-party").value.trim(), title = root.querySelector("#sc-title").value.trim();
      var typeDetails = {}, missing = []; root.querySelectorAll("[data-detail]").forEach(function (field) { typeDetails[field.dataset.detail] = field.value.trim(); if (field.required && !field.value.trim()) missing.push(field.previousElementSibling ? field.previousElementSibling.textContent.replace(/\s*\*$/, "") : field.dataset.detail); });
      if (missing.length) return say("Complétez les champs obligatoires pour ce type de contrat : " + missing.join(", ") + ".", "wa");
      var start = root.querySelector("#sc-start").value, end = root.querySelector("#sc-end").value, amount = Number(root.querySelector("#sc-amount").value || 0);
      if (!party || !title || !start) return say("Renseignez la partie concernée, l'objet et la date de début.", "wa");
      if (end && end < start) return say("La date de fin doit être postérieure ou égale à la date de début.", "wa");
      if (!Number.isFinite(amount) || amount < 0) return say("Le montant du contrat est invalide.", "wa");
      var now = new Date().toISOString(), data = {
        id:x.id || uid(), reference:x.reference || reference(), contractType:root.querySelector("#sc-type").value, typeDetails:typeDetails, category:root.querySelector("#sc-category").value, party:party, title:title,
        signDate:root.querySelector("#sc-sign").value, startDate:start, endDate:end, amount:Math.round(amount), status:root.querySelector("#sc-status").value,
        noticeDays:Math.max(0, Number(root.querySelector("#sc-notice").value) || 0), autoRenew:root.querySelector("#sc-renew").value === "oui",
        paymentTerms:root.querySelector("#sc-payment").value.trim(), documentUrl:root.querySelector("#sc-url").value.trim(),
        description:root.querySelector("#sc-description").value.trim(), notes:root.querySelector("#sc-notes").value.trim(),
        createdAt:x.createdAt || now, updatedAt:now
      };
      var i = list().findIndex(function (v) { return String(v.id) === String(data.id); });
      if (i < 0) list().unshift(data); else list()[i] = data;
      log((x.id ? "Modification" : "Création") + " du contrat " + data.reference + " — " + data.party); save();
      render(); say(x.id ? "Contrat mis à jour." : "Contrat enregistré.");
    };
  };
  var action = function (kind, id) {
    var x = list().find(function (v) { return String(v.id) === String(id); }); if (!x) return;
    if (kind === "edit") return editor(x);
    if (kind === "print") return print(x);
    if (kind === "close") {
      if (!confirm("Clôturer le contrat " + x.reference + " ?")) return;
      x.status = "Terminé"; x.updatedAt = new Date().toISOString(); log("Clôture du contrat " + x.reference + " — " + x.party); save(); render(); say("Contrat clôturé.");
    }
  };
  var print = function (x) {
    var settings = S.set || {};
    var company = settings.nom || "SORITECH INNOV BUSINESS";
    var address = settings.adresse || "Kipé, Ratoma · Conakry, Guinée";
    var phone = settings.tel || settings.telephone || "";
    var labels = {jobTitle:"Poste / fonction",workLocation:"Lieu de travail",workSchedule:"Horaires / durée du travail",salary:"Rémunération mensuelle",probation:"Période d’essai",serviceScope:"Périmètre des prestations",deliverables:"Livrables attendus",serviceFrequency:"Fréquence / calendrier",serviceLocation:"Lieu d’exécution",goods:"Produits / matériels",quantity:"Quantité / lots",deliveryDate:"Date de livraison",warranty:"Garantie",deliveryLocation:"Lieu de livraison",equipment:"Équipements couverts",maintenanceScope:"Périmètre de maintenance",interventionTime:"Délai d’intervention",maintenanceFrequency:"Fréquence des visites",property:"Bien loué",propertyAddress:"Adresse du bien",rent:"Loyer périodique",deposit:"Caution / dépôt",charges:"Charges",partnershipPurpose:"Objet du partenariat",contributions:"Contributions",revenueShare:"Répartition des revenus",governance:"Organisation et responsabilités",subcontractScope:"Mission sous-traitée",mainContract:"Marché principal",subcontractDeadline:"Délai d’exécution",acceptance:"Conditions de réception",confidentialInfo:"Informations confidentielles",authorizedUse:"Usage autorisé",ndaDuration:"Durée de confidentialité",exceptions:"Exceptions",brokerMission:"Mission de courtage",commissionRate:"Commission",commissionTrigger:"Fait générateur",exclusivity:"Exclusivité",specificTerms:"Conditions spécifiques"};
    var details = Object.keys(x.typeDetails || {}).map(function (key) {
      return x.typeDetails[key] ? '<tr><th>' + h(labels[key] || key) + '</th><td>' + h(x.typeDetails[key]) + '</td></tr>' : '';
    }).join("");
    var body = '<div class="doc-ref">Référence : ' + h(x.reference) + '</div>' +
      '<h1>' + h((x.contractType || "CONTRAT").toLocaleUpperCase("fr-FR")) + '</h1>' +
      '<p class="subtitle">' + h(x.title || "Convention contractuelle") + '</p>' +
      '<p>ENTRE LES SOUSSIGNÉS :</p><p><b>' + h(company) + '</b>, sis à ' + h(address) + ', ci-après désigné « la première partie »,</p>' +
      '<p>ET</p><p><b>' + h(x.party || "[À PRÉCISER]") + '</b>, ci-après désigné(e) « la seconde partie »,</p>' +
      '<p>Ensemble désignés « les Parties », il a été convenu ce qui suit :</p>' +
      '<h2>Informations contractuelles</h2><table><tbody><tr><th>Nature du contrat</th><td>' + h(x.contractType || x.category || "—") + '</td></tr><tr><th>Date de signature</th><td>' + dateLabel(x.signDate) + '</td></tr><tr><th>Date de début</th><td>' + dateLabel(x.startDate) + '</td></tr><tr><th>Date de fin</th><td>' + dateLabel(x.endDate) + '</td></tr><tr><th>Montant</th><td>' + money(x.amount) + '</td></tr><tr><th>Modalités de paiement</th><td>' + h(x.paymentTerms || "Selon les clauses ci-dessous") + '</td></tr><tr><th>Préavis</th><td>' + (Number(x.noticeDays) || 0) + ' jours</td></tr>' + details + '</tbody></table>' +
      '<h2>Clauses et dispositions contractuelles</h2><div class="contract-text">' + h(x.description || "Clauses à compléter avant signature.").replace(/\n/g, "<br>") + '</div>' +
      (x.notes ? '<h2>Observations complémentaires</h2><p>' + h(x.notes).replace(/\n/g, "<br>") + '</p>' : '') +
      '<p class="closing">Fait à Conakry, le ' + dateLabel(x.signDate || today()) + ', en deux exemplaires originaux, un pour chacune des Parties.</p>' +
      '<div class="sign"><div><b>Pour ' + h(company) + '</b><br><br><br><br>Nom, qualité, signature et cachet</div><div><b>La partie contractante</b><br><br><br><br>Nom, signature et cachet</div></div>';
    var popup = window.open("", "_blank");
    if (!popup) { say("Autorisez les fenêtres contextuelles pour imprimer le contrat.", "wa"); return; }
    var html = '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>' + h(x.reference) + ' - Contrat SIB</title><style>' +
      '@page{size:A4 portrait;margin:29mm 18mm 25mm}' +
      '*{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#111;font:10.5pt/1.55 Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact}' +
      '.page-header{position:fixed;top:-21mm;left:0;right:0;height:17mm;border-bottom:2.5pt solid #0057B9;display:flex;align-items:center;justify-content:space-between;gap:10mm;background:#fff}' +
      '.brand b{display:block;color:#0057B9;font-size:17pt;line-height:1.15}.brand span{display:block;color:#FF7800;font-size:8pt;font-weight:bold;letter-spacing:.5px;margin-top:2mm}.contact{text-align:right;color:#444;font-size:8pt;max-width:48%;line-height:1.4}' +
      '.page-footer{position:fixed;bottom:-18mm;left:0;right:0;border-top:.7pt solid #999;padding-top:3mm;display:flex;justify-content:space-between;gap:8mm;color:#555;font-size:8pt;background:#fff}' +
      '.doc-ref{text-align:right;color:#555;font-size:9pt}h1{text-align:center;font-size:15pt;line-height:1.25;margin:5mm 0 3mm;color:#071A36;text-transform:uppercase}.subtitle{text-align:center;font-size:12pt;font-weight:bold;margin:0 0 9mm}p{margin:3mm 0;text-align:justify}h2{font-size:11pt;color:#0057B9;border-bottom:.7pt solid #d5dfeb;padding-bottom:2mm;margin:7mm 0 3mm;break-after:avoid;page-break-after:avoid}table{width:100%;border-collapse:collapse;margin:4mm 0;break-inside:auto}tr{break-inside:avoid;page-break-inside:avoid}th,td{border:.6pt solid #999;padding:2mm;text-align:left;vertical-align:top}th{width:34%;background:#f1f4f8}.contract-text{text-align:justify;overflow-wrap:anywhere}.closing{margin-top:9mm}.sign{display:grid;grid-template-columns:1fr 1fr;gap:20mm;margin-top:16mm;text-align:center;break-inside:avoid;page-break-inside:avoid}.sign div{border-top:.7pt solid #333;padding-top:3mm}' +
      '@media screen{body{max-width:210mm;min-height:297mm;margin:12mm auto;padding:29mm 18mm 25mm;box-shadow:0 2px 18px #0002}.page-header{top:12mm;left:calc(50% - 87mm);right:calc(50% - 87mm)}.page-footer{bottom:12mm;left:calc(50% - 87mm);right:calc(50% - 87mm)}}' +
      '@media print{.page-header,.page-footer{position:fixed}body{width:auto;margin:0;padding:0}}' +
      '</style></head><body><header class="page-header"><div class="brand"><b>' + h(company) + '</b><span>INNOVER • DÉVELOPPER • CONNECTER</span></div><div class="contact">' + h(address) + (phone ? '<br>' + h(phone) : '') + '</div></header><footer class="page-footer"><span>' + h(company) + ' · ' + h(x.reference) + '</span><span>Document contractuel</span></footer><main>' + body + '</main><script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350)};<\/script></body></html>';
    popup.document.open(); popup.document.write(html); popup.document.close();
  };
  var css = document.createElement("style");
  css.textContent = "#contracts{max-width:1600px;margin:auto}#contracts .sc-head{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}#contracts .sc-head p{color:var(--mu);margin:4px 0 14px}#contracts .sc-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:14px 0}#contracts .sc-toolbar{display:flex;gap:10px;margin-bottom:14px}#contracts .sc-toolbar input{flex:1;min-width:160px}#contracts .sc-sub{display:block;color:var(--mu);font-size:12px}#contracts .sc-actions{white-space:nowrap}#contracts .sc-empty{padding:24px;text-align:center;color:var(--mu)}#contracts .sc-form-box{margin:14px 0}#contracts .sc-form-title{display:flex;align-items:center;justify-content:space-between;gap:10px}#contracts .sc-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:12px}#contracts .sc-form .wide{grid-column:1/-1}#contracts .sc-type-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}#contracts .sc-form input,#contracts .sc-form select,#contracts .sc-form textarea{width:100%;min-width:0}#contracts .sc-form-actions{display:flex;gap:8px;margin-top:16px}#contracts .sc-ai-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:7px}#contracts .sc-ai-row label{margin:0}#contracts .sc-ai-btn{border-color:var(--pri,#0057B9);color:var(--pri,#0057B9);font-weight:600}#contracts .sc-ai-btn:disabled{opacity:.65;cursor:wait}#contracts .sc-ai-help{display:block;color:var(--mu);font-size:12px;margin-top:6px}#contracts .sc-ai-status{font-size:12px;color:var(--mu);margin-top:5px;white-space:pre-wrap}#sc-print{display:none}@media(max-width:900px){#contracts .sc-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#contracts .sc-form{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){#contracts .sc-form{grid-template-columns:1fr}#contracts .sc-form .wide{grid-column:auto}#contracts .sc-type-details{grid-template-columns:1fr}#contracts .sc-toolbar{flex-direction:column}}@media print{@page{size:A4 portrait;margin:30mm 18mm 25mm}html,body{margin:0!important;padding:0!important;background:#fff!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}body *{visibility:hidden!important}#sc-print,#sc-print *{visibility:visible!important}#sc-print{display:block!important;position:static!important;inset:auto!important;width:auto!important;margin:0!important;padding:0!important;background:#fff!important;color:#111!important;font:10.5pt/1.6 Arial,sans-serif}#sc-print .sc-doc-header{position:fixed;top:-23mm;left:0;right:0;height:18mm;box-sizing:border-box;border-bottom:3px solid #0057B9;display:flex;align-items:center;justify-content:space-between;gap:12px;padding-bottom:4mm;background:#fff!important}#sc-print .sc-doc-brand b{display:block;font-size:17pt;color:#0057B9}#sc-print .sc-doc-brand span{font-size:8pt;color:#FF7800;font-weight:bold}#sc-print .sc-doc-contact{text-align:right;font-size:8pt;color:#444}#sc-print .sc-doc-footer{position:fixed;bottom:-19mm;left:0;right:0;border-top:1px solid #aaa;padding-top:4mm;display:flex;justify-content:space-between;font-size:8pt;color:#555;background:#fff!important}#sc-print .sc-doc-ref{text-align:right;font-size:9pt;color:#555}#sc-print h1{text-align:center;font-size:15pt;margin:5mm 0 4mm;text-transform:uppercase;color:#071A36}#sc-print .sc-doc-subtitle{text-align:center;font-weight:bold;font-size:12pt;margin-bottom:10mm}#sc-print h2{font-size:11pt;color:#0057B9;border-bottom:1px solid #d5dfeb;padding-bottom:3px;margin:8mm 0 3mm;break-after:avoid}#sc-print p{margin:3mm 0;text-align:justify}#sc-print table{width:100%;border-collapse:collapse;margin:5mm 0}#sc-print tr{break-inside:avoid}#sc-print th,#sc-print td{border:1px solid #aaa;padding:6px;text-align:left;vertical-align:top}#sc-print th{width:34%;background:#f2f5fa}#sc-print .sc-contract-text{text-align:justify}#sc-print .sc-sign{display:grid;grid-template-columns:1fr 1fr;gap:25mm;margin-top:18mm;text-align:center;break-inside:avoid}#sc-print .sc-sign div{border-top:1px solid #333;padding-top:3mm}#sc-print .sc-doc-closing{margin-top:10mm}}}";
  document.head.appendChild(css);
  var main = document.querySelector("main");
  if (main && !document.getElementById(rootId)) { var section = document.createElement("section"); section.id = rootId; section.className = "hide"; main.appendChild(section); }
  if (!Array.isArray(S.contracts)) S.contracts = [];
  if (typeof P !== "undefined" && !P.some(function (x) { return x[0] === rootId; })) P.push([rootId, "Contrats"]);
  if (typeof GR !== "undefined" && !GR.some(function (x) { return x[0] === "Juridique"; })) GR.push(["Juridique", [rootId]]);
  if (typeof IC !== "undefined") IC[rootId] = "M8 3h8l4 4v14H4V3zM8 12h8M8 16h8M14 3v5h6";
  if (typeof PM !== "undefined") ["Direction","Comptable","Commercial","RH"].forEach(function (role) { if (Array.isArray(PM[role]) && PM[role].indexOf(rootId) < 0) PM[role].push(rootId); });
  var oldNav = window.nav;
  if (typeof oldNav === "function" && !window.__sibContractsNavWrapped) {
    window.__sibContractsNavWrapped = true;
    window.nav = function (v) { var result = oldNav.apply(this, arguments); if (v === rootId) render(); return result; };
  }
  document.addEventListener("click", function (e) { var b = e.target.closest('#nv button[data-v="contracts"]'); if (b) setTimeout(render, 0); });
  if (typeof mk === "function") mk();
  window.sibRenderContracts = render;
})();