/* SIB Gestion — Module Achats & Fournisseurs
 * Compatible avec l'état central SIB (S) et la sauvegarde Supabase existante.
 * Les réceptions alimentent le stock ; les règlements alimentent la trésorerie.
 */
(function () {
  "use strict";
  if (window.__sibPurchasesModuleLoaded) return;
  window.__sibPurchasesModuleLoaded = true;

  var $ = function (id) { return document.getElementById(id); };
  var root = function () { return $("fo"); };
  var esc = function (v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  };
  var today = function () { return new Date().toISOString().slice(0, 10); };
  var money = function (v) { return (Number(v) || 0).toLocaleString("fr-FR") + " " + ((typeof S !== "undefined" && S.set && S.set.sym) || "GNF"); };
  var uid = function (p) { return p + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8); };
  var total = function (lines) { return (lines || []).reduce(function (a, x) { return a + (Number(x.qty) || 0) * (Number(x.price) || 0); }, 0); };
  var dateLabel = function (d) { return d ? new Date(d + "T00:00:00").toLocaleDateString("fr-FR") : "—"; };
  var toastMsg = function (m, t) { if (typeof toast === "function") toast(m, t || "ok"); else alert(m); };
  var ensure = function () {
    if (typeof S === "undefined" || !S || typeof S !== "object") return false;
    ["fo", "ac", "st", "e", "n", "purchaseOrders", "purchaseReceipts", "supplierInvoices", "supplierPayments"].forEach(function (k) {
      if (!Array.isArray(S[k])) S[k] = [];
    });
    S.fo.forEach(function (s, i) {
      if (!s || typeof s !== "object") S.fo[i] = {n:String(s || ""),t:"",active:true};
      if (!S.fo[i].id) S.fo[i].id = "sup_legacy_" + i + "_" + String(S.fo[i].n || "fournisseur").replace(/[^a-z0-9]/gi, "").slice(0, 12);
      if (S.fo[i].active == null) S.fo[i].active = true;
    });
    return true;
  };
  var saveState = function () {
    if (typeof save === "function") save();
  };
  var suppliers = function () { return S.fo; };
  var orders = function () { return S.purchaseOrders; };
  var receipts = function () { return S.purchaseReceipts; };
  var invoices = function () { return S.supplierInvoices; };
  var payments = function () { return S.supplierPayments; };
  var supplierById = function (id) { return suppliers().find(function (x) { return String(x.id) === String(id); }); };
  var invoicePaid = function (inv) {
    return payments().filter(function (p) { return String(p.invoiceId) === String(inv.id); })
      .reduce(function (a, p) { return a + (Number(p.amount) || 0); }, 0);
  };
  var invoiceDue = function (inv) { return Math.max(0, (Number(inv.amount) || 0) - invoicePaid(inv)); };
  var statusBadge = function (status) {
    var cls = status === "Payée" || status === "Réceptionné" ? "ok" : status === "En retard" ? "no" : "wa";
    return '<span class="bd ' + cls + '">' + esc(status) + '</span>';
  };
  var lineRow = function (line) {
    line = line || {};
    return '<tr class="sib-purchase-line"><td><input class="sp-name" placeholder="Désignation / article" value="' + esc(line.name || "") + '"></td>' +
      '<td><input class="sp-qty" type="number" min="0.01" step="0.01" value="' + esc(line.qty == null ? 1 : line.qty) + '"></td>' +
      '<td><input class="sp-price" type="number" min="0" step="1" value="' + esc(line.price == null ? 0 : line.price) + '"></td>' +
      '<td class="sp-line-total">0</td><td><button type="button" class="s dg sp-remove-line" title="Retirer">×</button></td></tr>';
  };
  var readLines = function (body) {
    return Array.prototype.slice.call(body ? body.querySelectorAll(".sib-purchase-line") : []).map(function (tr) {
      return {name:tr.querySelector(".sp-name").value.trim(), qty:Number(tr.querySelector(".sp-qty").value), price:Number(tr.querySelector(".sp-price").value)};
    }).filter(function (x) { return x.name && Number.isFinite(x.qty) && x.qty > 0 && Number.isFinite(x.price) && x.price >= 0; });
  };
  var refreshLines = function (body, totalNode) {
    if (!body) return;
    var sum = 0;
    Array.prototype.forEach.call(body.querySelectorAll(".sib-purchase-line"), function (tr) {
      var q = Number(tr.querySelector(".sp-qty").value) || 0;
      var p = Number(tr.querySelector(".sp-price").value) || 0;
      var v = q * p; sum += v;
      tr.querySelector(".sp-line-total").textContent = money(v);
    });
    if (totalNode) totalNode.textContent = money(sum);
  };
  var lineEditor = function (lines, prefix) {
    var rows = lines && lines.length ? lines : [{name:"",qty:1,price:0}];
    return '<div class="sib-purchase-lines"><div class="sib-purchase-line-head"><b>Articles / prestations</b><button type="button" class="s" data-sp-add-line="' + prefix + '">＋ Ajouter une ligne</button></div>' +
      '<div class="tw"><table><thead><tr><th>Désignation</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th><th></th></tr></thead>' +
      '<tbody id="' + prefix + '-lines">' + rows.map(lineRow).join("") + '</tbody><tfoot><tr><th colspan="3">Total général</th><th id="' + prefix + '-total">0 GNF</th><th></th></tr></tfoot></table></div></div>';
  };
  var bindLineEditor = function (prefix) {
    var body = $(prefix + "-lines");
    if (!body) return;
    body.addEventListener("input", function () { refreshLines(body, $(prefix + "-total")); });
    body.addEventListener("click", function (e) {
      var b = e.target.closest(".sp-remove-line");
      if (!b) return;
      if (body.querySelectorAll(".sib-purchase-line").length > 1) b.closest("tr").remove();
      else {
        b.closest("tr").querySelector(".sp-name").value = "";
        b.closest("tr").querySelector(".sp-qty").value = "1";
        b.closest("tr").querySelector(".sp-price").value = "0";
      }
      refreshLines(body, $(prefix + "-total"));
    });
    refreshLines(body, $(prefix + "-total"));
  };
  var supplierOptions = function (selected) {
    return suppliers().filter(function (s) { return s && s.active !== false; }).map(function (s) {
      return '<option value="' + esc(s.id) + '" ' + (String(s.id) === String(selected) ? "selected" : "") + '>' + esc(s.n) + '</option>';
    }).join("");
  };
  var accountOptions = function (selected) {
    var list = Array.isArray(window.AC) ? AC : ["Caisse", "Banque", "Mobile Money"];
    return list.map(function (a) { return '<option ' + (a === selected ? "selected" : "") + '>' + esc(a) + '</option>'; }).join("");
  };
  var orderStatus = function (o) {
    var related = receipts().filter(function (r) { return String(r.orderId) === String(o.id); });
    var anyReceived = false;
    var allReceived = (o.lines || []).length > 0 && (o.lines || []).every(function (line, index) {
      var received = related.reduce(function (sum, receipt) {
        return sum + (receipt.lines || []).filter(function (item) {
          if (item.orderLineIndex != null) return Number(item.orderLineIndex) === index;
          return String(item.name || "").trim().toLowerCase() === String(line.name || "").trim().toLowerCase();
        }).reduce(function (qty, item) { return qty + (Number(item.qty) || 0); }, 0);
      }, 0);
      if (received > 0) anyReceived = true;
      return received >= Number(line.qty || 0);
    });
    if (allReceived) return "Réceptionné";
    if (anyReceived) return "Partiellement reçu";
    return o.status || "Brouillon";
  };
  var render = function () {
    if (!ensure() || !root()) return;
    var supplierRows = suppliers().map(function (s, i) {
      return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(s.n || "") + '</b></td><td>' + esc(s.t || "—") + '</td><td>' + esc(s.mail || "—") + '</td><td>' + esc(s.adr || "—") + '</td><td>' + (s.active === false ? statusBadge("Désactivé") : statusBadge("Actif")) + '</td><td><button class="s" data-sp-supplier-toggle="' + esc(s.id) + '">' + (s.active === false ? "Activer" : "Désactiver") + '</button></td></tr>';
    }).join("");
    var orderRows = orders().slice().reverse().map(function (o, i) {
      var st = orderStatus(o);
      return '<tr><td>' + (orders().length - i) + '</td><td><b>' + esc(o.ref) + '</b></td><td>' + esc(o.supplierName) + '</td><td>' + dateLabel(o.date) + '</td><td>' + dateLabel(o.expectedDate) + '</td><td class="r">' + money(total(o.lines)) + '</td><td>' + statusBadge(st) + '</td><td class="sib-purchase-actions"><button class="s" data-sp-receive="' + esc(o.id) + '">Réceptionner</button> <button class="s" data-sp-invoice-from-order="' + esc(o.id) + '">Facture</button> <button class="s" data-sp-print-order="' + esc(o.id) + '">PDF</button></td></tr>';
    }).join("");
    var receiptRows = receipts().slice().reverse().map(function (r, i) {
      return '<tr><td>' + (receipts().length - i) + '</td><td><b>' + esc(r.ref) + '</b></td><td>' + esc(r.supplierName) + '</td><td>' + esc(r.orderRef || "Sans commande") + '</td><td>' + dateLabel(r.date) + '</td><td>' + (r.lines || []).map(function (l) { return esc(l.name) + " × " + esc(l.qty); }).join("<br>") + '</td><td class="sib-purchase-actions"><button class="s" data-sp-print-receipt="' + esc(r.id) + '">PDF</button></td></tr>';
    }).join("");
    var invoiceRows = invoices().slice().reverse().map(function (inv, i) {
      var due = invoiceDue(inv), st = due <= 0 ? "Payée" : (inv.dueDate && inv.dueDate < today() ? "En retard" : "À payer");
      return '<tr><td>' + (invoices().length - i) + '</td><td><b>' + esc(inv.ref) + '</b></td><td>' + esc(inv.supplierName) + '</td><td>' + dateLabel(inv.date) + '</td><td>' + dateLabel(inv.dueDate) + '</td><td class="r">' + money(inv.amount) + '</td><td class="r">' + money(invoicePaid(inv)) + '</td><td class="r"><b>' + money(due) + '</b></td><td>' + statusBadge(st) + '</td><td class="sib-purchase-actions">' + (due > 0 ? '<button class="s" data-sp-pay="' + esc(inv.id) + '">Régler</button>' : '') + ' <button class="s" data-sp-print-invoice="' + esc(inv.id) + '">PDF</button></td></tr>';
    }).join("");
    var unpaid = invoices().reduce(function (a, inv) { return a + invoiceDue(inv); }, 0);
    var overdue = invoices().filter(function (inv) { return invoiceDue(inv) > 0 && inv.dueDate && inv.dueDate < today(); }).reduce(function (a, inv) { return a + invoiceDue(inv); }, 0);
    var monthOrders = orders().filter(function (o) { return String(o.date || "").slice(0, 7) === today().slice(0, 7); });
    root().innerHTML =
      '<div class="sib-purchase-top"><div><h2>Achats & fournisseurs</h2><p>Suivez les fournisseurs, commandes, réceptions, factures et règlements. Les réceptions mettent à jour le stock et les paiements alimentent la caisse ou la banque.</p></div></div>' +
      '<div class="sib-purchase-kpis"><div class="k"><span>Fournisseurs actifs</span><b>' + suppliers().filter(function (s) { return s.active !== false; }).length + '</b></div><div class="k"><span>Commandes ce mois</span><b>' + monthOrders.length + '</b></div><div class="k"><span>Dettes fournisseurs</span><b>' + money(unpaid) + '</b></div><div class="k"><span>Échéances dépassées</span><b class="out">' + money(overdue) + '</b></div></div>' +
      '<div class="sib-purchase-tabs"><button type="button" class="s on" data-sp-tab="suppliers">Fournisseurs</button><button type="button" class="s" data-sp-tab="orders">Commandes</button><button type="button" class="s" data-sp-tab="receipts">Réceptions</button><button type="button" class="s" data-sp-tab="invoices">Factures & règlements</button></div>' +
      '<section class="sib-purchase-pane" data-sp-pane="suppliers"><div class="box"><h3>Ajouter un fournisseur</h3><div class="sib-purchase-form"><div><label>Raison sociale / nom</label><input id="sp-s-name" placeholder="Nom du fournisseur"></div><div><label>Téléphone</label><input id="sp-s-phone" placeholder="Téléphone"></div><div><label>E-mail</label><input id="sp-s-mail" type="email" placeholder="Adresse e-mail"></div><div><label>Adresse</label><input id="sp-s-address" placeholder="Adresse"></div><div><label>NIF / RCCM</label><input id="sp-s-tax" placeholder="Identifiant fiscal / RCCM"></div></div><button type="button" class="p" id="sp-s-save">Enregistrer le fournisseur</button></div><div class="box"><h3>Répertoire fournisseurs</h3><div class="tw"><table><thead><tr><th>N°</th><th>Fournisseur</th><th>Téléphone</th><th>E-mail</th><th>Adresse</th><th>État</th><th>Action</th></tr></thead><tbody>' + (supplierRows || '<tr><td colspan="7">Aucun fournisseur enregistré.</td></tr>') + '</tbody></table></div></div></section>' +
      '<section class="sib-purchase-pane hide" data-sp-pane="orders"><div class="box"><h3>Créer une commande fournisseur</h3><div class="sib-purchase-form"><div><label>Fournisseur</label><select id="sp-o-supplier"><option value="">Choisir un fournisseur</option>' + supplierOptions() + '</select></div><div><label>Date de commande</label><input id="sp-o-date" type="date" value="' + today() + '"></div><div><label>Livraison prévue</label><input id="sp-o-expected" type="date"></div><div><label>Référence</label><input id="sp-o-ref" value="' + esc(nextReference("BCF", orders())) + '"></div></div>' + lineEditor([], "sp-o") + '<div class="sib-purchase-form"><div class="wide"><label>Observations / conditions</label><input id="sp-o-notes" placeholder="Conditions de livraison, délai, etc."></div></div><button type="button" class="p" id="sp-o-save">Enregistrer la commande</button></div><div class="box"><h3>Historique des commandes</h3><div class="tw"><table><thead><tr><th>N°</th><th>Référence</th><th>Fournisseur</th><th>Commande</th><th>Prévue</th><th class="r">Montant</th><th>État</th><th>Actions</th></tr></thead><tbody>' + (orderRows || '<tr><td colspan="8">Aucune commande fournisseur.</td></tr>') + '</tbody></table></div></div></section>' +
      '<section class="sib-purchase-pane hide" data-sp-pane="receipts"><div class="box"><h3>Réceptionner une commande</h3><div class="sib-purchase-form"><div><label>Commande fournisseur</label><select id="sp-r-order"><option value="">Choisir une commande</option>' + orders().map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.ref + " — " + o.supplierName) + '</option>'; }).join("") + '</select></div><div><label>Date de réception</label><input id="sp-r-date" type="date" value="' + today() + '"></div><div><label>Référence réception</label><input id="sp-r-ref" value="' + esc(nextReference("BR", receipts())) + '"></div></div><div id="sp-r-lines" class="tw"><p class="sib-purchase-muted">Sélectionnez une commande pour afficher les quantités à réceptionner.</p></div><button type="button" class="p" id="sp-r-save">Valider la réception et mettre à jour le stock</button></div><div class="box"><h3>Historique des réceptions</h3><div class="tw"><table><thead><tr><th>N°</th><th>Référence</th><th>Fournisseur</th><th>Commande liée</th><th>Date</th><th>Articles reçus</th><th>Document</th></tr></thead><tbody>' + (receiptRows || '<tr><td colspan="7">Aucune réception enregistrée.</td></tr>') + '</tbody></table></div></div></section>' +
      '<section class="sib-purchase-pane hide" data-sp-pane="invoices"><div class="box"><h3>Enregistrer une facture fournisseur</h3><div class="sib-purchase-form"><div><label>Fournisseur</label><select id="sp-i-supplier"><option value="">Choisir un fournisseur</option>' + supplierOptions() + '</select></div><div><label>Commande liée (facultatif)</label><select id="sp-i-order"><option value="">Sans commande liée</option>' + orders().map(function (o) { return '<option value="' + esc(o.id) + '">' + esc(o.ref + " — " + o.supplierName) + '</option>'; }).join("") + '</select></div><div><label>Référence facture fournisseur</label><input id="sp-i-ref" placeholder="N° de facture fournisseur"></div><div><label>Date facture</label><input id="sp-i-date" type="date" value="' + today() + '"></div><div><label>Échéance</label><input id="sp-i-due" type="date"></div><div><label>Montant total (' + esc((S.set && S.set.sym) || "GNF") + ')</label><input id="sp-i-amount" type="number" min="1" step="1"></div></div><button type="button" class="p" id="sp-i-save">Enregistrer la facture</button></div><div class="box"><h3>Factures fournisseurs et dettes</h3><div class="tw"><table><thead><tr><th>N°</th><th>Référence</th><th>Fournisseur</th><th>Date</th><th>Échéance</th><th class="r">Montant</th><th class="r">Payé</th><th class="r">Reste dû</th><th>État</th><th>Actions</th></tr></thead><tbody>' + (invoiceRows || '<tr><td colspan="10">Aucune facture fournisseur.</td></tr>') + '</tbody></table></div></div><div class="box"><h3>Règlements fournisseurs</h3><div class="tw"><table><thead><tr><th>Date</th><th>Facture</th><th>Fournisseur</th><th>Compte</th><th class="r">Montant</th><th>Référence</th></tr></thead><tbody>' + (payments().slice().reverse().map(function (p) { return '<tr><td>' + dateLabel(p.date) + '</td><td>' + esc(p.invoiceRef) + '</td><td>' + esc(p.supplierName) + '</td><td>' + esc(p.account) + '</td><td class="r">' + money(p.amount) + '</td><td>' + esc(p.reference || "—") + '</td></tr>'; }).join("") || '<tr><td colspan="6">Aucun règlement enregistré.</td></tr>') + '</tbody></table></div></div></section>';
    root().insertAdjacentHTML("beforeend", '<div class="box"><h3>Achats enregistrés avant cette mise à jour</h3><p class="sib-purchase-muted">Historique conservé des achats saisis dans l’ancienne version du module.</p><div class="tw"><table><thead><tr><th>N°</th><th>Date</th><th>Fournisseur</th><th>Article</th><th>Quantité</th><th class="r">Total</th></tr></thead><tbody>' +
      (S.ac.slice().reverse().map(function (a, i) { return '<tr><td>' + (S.ac.length - i) + '</td><td>' + dateLabel(a.d) + '</td><td>' + esc(a.fo) + '</td><td>' + esc(a.art) + '</td><td>' + esc(a.q) + '</td><td class="r">' + money(a.m) + '</td></tr>'; }).join("") || '<tr><td colspan="6">Aucun ancien achat enregistré.</td></tr>') +
      '</tbody></table></div></div>');
    bindLineEditor("sp-o");
    root().querySelectorAll("[data-sp-add-line]").forEach(function (b) {
      b.onclick = function () {
        var body = $(b.dataset.spAddLine + "-lines");
        if (!body) return;
        body.insertAdjacentHTML("beforeend", lineRow({name:"",qty:1,price:0}));
        refreshLines(body, $(b.dataset.spAddLine + "-total"));
      };
    });
    root().querySelectorAll("[data-sp-tab]").forEach(function (b) {
      b.onclick = function () {
        root().querySelectorAll("[data-sp-tab]").forEach(function (x) { x.classList.toggle("on", x === b); });
        root().querySelectorAll("[data-sp-pane]").forEach(function (p) { p.classList.toggle("hide", p.dataset.spPane !== b.dataset.spTab); });
      };
    });
    bindEvents();
  };
  var nextReference = function (prefix, list) {
    var year = new Date().getFullYear();
    var n = list.filter(function (x) { return String(x.ref || "").indexOf(prefix + "/" + year + "/") === 0; }).length + 1;
    return "SIB/" + prefix + "/" + year + "/" + String(n).padStart(4, "0");
  };
  var bindEvents = function () {
    var r = root(); if (!r) return;
    var supplierSave = $("sp-s-save");
    if (supplierSave) supplierSave.onclick = function () {
      var name = $("sp-s-name").value.trim();
      if (!name) return toastMsg("Le nom du fournisseur est obligatoire.", "wa");
      if (suppliers().some(function (s) { return String(s.n).toLowerCase() === name.toLowerCase(); })) return toastMsg("Ce fournisseur existe déjà.", "wa");
      suppliers().push({id:uid("sup"),n:name,t:$("sp-s-phone").value.trim(),mail:$("sp-s-mail").value.trim(),adr:$("sp-s-address").value.trim(),tax:$("sp-s-tax").value.trim(),active:true,createdAt:new Date().toISOString()});
      saveState(); render(); toastMsg("Fournisseur enregistré.");
    };
    var orderSave = $("sp-o-save");
    if (orderSave) orderSave.onclick = function () {
      var supplier = supplierById($("sp-o-supplier").value), lines = readLines($("sp-o-lines"));
      if (!supplier) return toastMsg("Choisissez un fournisseur.", "wa");
      if (!lines.length) return toastMsg("Ajoutez au moins un article avec une quantité et un prix valides.", "wa");
      var ref = $("sp-o-ref").value.trim();
      if (!ref || orders().some(function (o) { return o.ref === ref; })) return toastMsg("La référence est obligatoire et doit être unique.", "wa");
      orders().push({id:uid("po"),ref:ref,supplierId:supplier.id,supplierName:supplier.n,date:$("sp-o-date").value || today(),expectedDate:$("sp-o-expected").value,notes:$("sp-o-notes").value.trim(),lines:lines,status:"Envoyée",createdAt:new Date().toISOString()});
      if (typeof lg === "function") lg("Commande fournisseur créée : " + ref + " · " + supplier.n + " · " + money(total(lines)));
      saveState(); render(); toastMsg("Commande fournisseur enregistrée.");
    };
    var orderSelect = $("sp-r-order");
    if (orderSelect) orderSelect.onchange = function () {
      var o = orders().find(function (x) { return String(x.id) === String(orderSelect.value); });
      var box = $("sp-r-lines");
      if (!o || !box) { if (box) box.innerHTML = '<p class="sib-purchase-muted">Sélectionnez une commande.</p>'; return; }
      var rows = (o.lines || []).map(function (l, i) {
        var already = receipts().filter(function (rec) { return String(rec.orderId) === String(o.id); })
          .reduce(function (sum, rec) { return sum + (rec.lines || []).filter(function (x) { return x.orderLineIndex === i; }).reduce(function (a, x) { return a + Number(x.qty || 0); }, 0); }, 0);
        var remaining = Math.max(0, Number(l.qty) - already);
        return '<tr data-order-line="' + i + '"><td>' + esc(l.name) + '</td><td>' + esc(l.qty) + '</td><td>' + esc(already) + '</td><td><input class="sp-receive-qty" type="number" min="0" max="' + remaining + '" step="0.01" value="' + remaining + '"></td></tr>';
      }).join("");
      box.innerHTML = '<table><thead><tr><th>Article</th><th>Commandé</th><th>Déjà reçu</th><th>À réceptionner</th></tr></thead><tbody>' + rows + '</tbody></table>';
    };
    var receiptSave = $("sp-r-save");
    if (receiptSave) receiptSave.onclick = function () {
      var o = orders().find(function (x) { return String(x.id) === String($("sp-r-order").value); });
      if (!o) return toastMsg("Choisissez une commande fournisseur.", "wa");
      var ref = $("sp-r-ref").value.trim();
      if (!ref || receipts().some(function (x) { return x.ref === ref; })) return toastMsg("La référence de réception est obligatoire et unique.", "wa");
      var lines = [];
      Array.prototype.forEach.call(($("sp-r-lines") || document).querySelectorAll("tr[data-order-line]"), function (tr) {
        var i = Number(tr.dataset.orderLine), qty = Number(tr.querySelector(".sp-receive-qty").value), source = o.lines[i];
        if (qty > 0) lines.push({name:source.name,qty:qty,price:Number(source.price)||0,orderLineIndex:i});
      });
      if (!lines.length) return toastMsg("Saisissez au moins une quantité à réceptionner.", "wa");
      for (var j = 0; j < lines.length; j++) {
        var l = lines[j];
        var already = receipts().filter(function (rec) { return String(rec.orderId) === String(o.id); })
          .reduce(function (sum, rec) { return sum + (rec.lines || []).filter(function (x) { return x.orderLineIndex === l.orderLineIndex; }).reduce(function (a, x) { return a + Number(x.qty || 0); }, 0); }, 0);
        if (already + l.qty > Number(o.lines[l.orderLineIndex].qty)) return toastMsg("La quantité réceptionnée dépasse la quantité commandée pour « " + l.name + " ».", "wa");
      }
      lines.forEach(function (l) {
        var stock = S.st.find(function (x) { return String(x.n || "").toLowerCase() === l.name.toLowerCase(); });
        if (!stock) { stock = {n:l.name,q:0,s:0}; S.st.push(stock); }
        stock.q = (Number(stock.q) || 0) + l.qty;
      });
      receipts().push({id:uid("receipt"),ref:ref,orderId:o.id,orderRef:o.ref,supplierId:o.supplierId,supplierName:o.supplierName,date:$("sp-r-date").value || today(),lines:lines,createdAt:new Date().toISOString()});
      if (typeof lg === "function") {
        lines.forEach(function (line) {
          lg("Réception fournisseur " + ref + " · " + line.name + " : +" + line.qty + " unité(s) · " + o.supplierName);
        });
      }
      saveState(); render(); toastMsg("Réception enregistrée : le stock et le journal d’activité ont été mis à jour.");
    };
    var invoiceSave = $("sp-i-save");
    if (invoiceSave) invoiceSave.onclick = function () {
      var supplier = supplierById($("sp-i-supplier").value), orderId = $("sp-i-order").value;
      var order = orders().find(function (x) { return String(x.id) === String(orderId); });
      var ref = $("sp-i-ref").value.trim(), amount = Number($("sp-i-amount").value);
      if (!supplier) return toastMsg("Choisissez le fournisseur de la facture.", "wa");
      if (!ref || invoices().some(function (x) { return x.ref === ref; })) return toastMsg("La référence de facture est obligatoire et unique.", "wa");
      if (!Number.isFinite(amount) || amount <= 0) return toastMsg("Le montant de la facture doit être positif.", "wa");
      if (order && String(order.supplierId) !== String(supplier.id)) return toastMsg("Le fournisseur ne correspond pas à la commande sélectionnée.", "wa");
      invoices().push({id:uid("inv"),ref:ref,supplierId:supplier.id,supplierName:supplier.n,orderId:order ? order.id : "",orderRef:order ? order.ref : "",date:$("sp-i-date").value || today(),dueDate:$("sp-i-due").value,amount:Math.round(amount),status:"À payer",createdAt:new Date().toISOString()});
      if (typeof lg === "function") lg("Facture fournisseur enregistrée : " + ref + " · " + supplier.n + " · " + money(amount));
      saveState(); render(); toastMsg("Facture fournisseur enregistrée.");
    };
    r.querySelectorAll("[data-sp-supplier-toggle]").forEach(function (b) {
      b.onclick = function () {
        var s = supplierById(b.dataset.spSupplierToggle); if (!s) return;
        s.active = s.active === false; saveState(); render(); toastMsg(s.active ? "Fournisseur activé." : "Fournisseur désactivé.");
      };
    });
    r.querySelectorAll("[data-sp-receive]").forEach(function (b) {
      b.onclick = function () {
        var tab = r.querySelector('[data-sp-tab="receipts"]'); if (tab) tab.click();
        if ($("sp-r-order")) { $("sp-r-order").value = b.dataset.spReceive; $("sp-r-order").onchange(); }
      };
    });
    r.querySelectorAll("[data-sp-invoice-from-order]").forEach(function (b) {
      b.onclick = function () {
        var o = orders().find(function (x) { return String(x.id) === String(b.dataset.spInvoiceFromOrder); });
        var tab = r.querySelector('[data-sp-tab="invoices"]'); if (tab) tab.click();
        if (o && $("sp-i-supplier")) {
          $("sp-i-supplier").value = o.supplierId;
          $("sp-i-order").value = o.id;
          $("sp-i-ref").value = "FAC-FO-" + String(Date.now()).slice(-7);
          $("sp-i-amount").value = total(o.lines);
        }
      };
    });
    r.querySelectorAll("[data-sp-pay]").forEach(function (b) {
      b.onclick = function () { openPaymentForm(b.dataset.spPay); };
    });
    r.querySelectorAll("[data-sp-print-order]").forEach(function (b) {
      b.onclick = function () { var o = orders().find(function (x) { return String(x.id) === String(b.dataset.spPrintOrder); }); if (o) printDocument("Commande fournisseur", o.ref, o.supplierName, o.date, o.lines, total(o.lines), o.notes); };
    });
    r.querySelectorAll("[data-sp-print-receipt]").forEach(function (b) {
      b.onclick = function () {
        var x = receipts().find(function (z) { return String(z.id) === String(b.dataset.spPrintReceipt); });
        if (x) printDocument("Bon de réception fournisseur", x.ref, x.supplierName, x.date, x.lines, total(x.lines), x.orderRef ? "Commande liée : " + x.orderRef : "");
      };
    });
    r.querySelectorAll("[data-sp-print-invoice]").forEach(function (b) {
      b.onclick = function () { var x = invoices().find(function (z) { return String(z.id) === String(b.dataset.spPrintInvoice); }); if (x) printDocument("Facture fournisseur", x.ref, x.supplierName, x.date, [{name:"Facture fournisseur",qty:1,price:x.amount}], x.amount, "Échéance : " + (x.dueDate || "Non précisée")); };
    });
  };
  var openPaymentForm = function (id) {
    var inv = invoices().find(function (x) { return String(x.id) === String(id); });
    if (!inv) return;
    var amount = prompt("Montant du règlement (reste dû : " + money(invoiceDue(inv)) + ")", String(invoiceDue(inv)));
    if (amount === null) return;
    var value = Number(amount);
    if (!Number.isFinite(value) || value <= 0 || value > invoiceDue(inv)) return toastMsg("Montant invalide ou supérieur au reste dû.", "wa");
    var account = prompt("Compte à débiter : Caisse, Banque ou Mobile Money", "Caisse");
    if (account === null) return;
    if (["Caisse", "Banque", "Mobile Money"].indexOf(account) < 0) return toastMsg("Compte de règlement invalide.", "wa");
    if (typeof bal !== "function" || Number(bal()[account]) < value) return toastMsg("Solde insuffisant sur " + account + ".", "wa");
    var reference = prompt("Référence du paiement (facultatif)", inv.ref) || "";
    var p = {id:uid("pay"),invoiceId:inv.id,invoiceRef:inv.ref,supplierId:inv.supplierId,supplierName:inv.supplierName,date:today(),account:account,amount:Math.round(value),reference:reference};
    payments().push(p);
    if (typeof add === "function") add({t:"depense",no:typeof num === "function" ? num("ACH") : p.id,m:p.amount,a:account,cat:"Règlement fournisseur",l:"Facture " + inv.ref + " — " + inv.supplierName,supplierInvoiceId:inv.id,supplierPaymentId:p.id});
    else { payments().pop(); return toastMsg("Le journal de trésorerie n’est pas disponible : règlement non enregistré.", "er"); }
    saveState(); render(); toastMsg(invoiceDue(inv) <= 0 ? "Facture fournisseur entièrement réglée." : "Règlement partiel enregistré.");
  };
  var printDocument = function (title, ref, party, date, lines, amount, notes) {
    var rows = (lines || []).map(function (l, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(l.name) + "</td><td>" + esc(l.qty) + "</td><td>" + money(l.price) + "</td><td>" + money((Number(l.qty) || 0) * (Number(l.price) || 0)) + "</td></tr>";
    }).join("");
    var node = $("sib-purchase-print");
    if (!node) { node = document.createElement("div"); node.id = "sib-purchase-print"; document.body.appendChild(node); }
    node.innerHTML = '<div class="head"><b style="font-size:22px;color:#0057B9">SIB — SORITECH INNOV BUSINESS</b><br>INNOVER • DÉVELOPPER • CONNECTER<br><small>Kipé, Ratoma · Conakry, Guinée</small></div><h1>' + esc(title) + '</h1><p><b>Référence :</b> ' + esc(ref) + ' <span style="float:right"><b>Date :</b> ' + dateLabel(date) + '</span></p><p><b>Fournisseur :</b> ' + esc(party) + '</p><table><thead><tr><th>N°</th><th>Désignation</th><th>Quantité</th><th>Prix unitaire</th><th>Total</th></tr></thead><tbody>' + rows + '</tbody></table><h2 class="sum">TOTAL : ' + money(amount) + '</h2>' + (notes ? '<p><b>Observations :</b><br>' + esc(notes) + '</p>' : '') + '<div class="sign">Établi par SIB<br><br><br>Signature et cachet</div>';
    window.print();
  };
  var style = document.createElement("style");
  style.textContent =
    "#fo{max-width:1500px;margin:auto}#fo .sib-purchase-top p{color:var(--mu);margin:4px 0 14px}#fo .sib-purchase-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:14px 0}#fo .sib-purchase-tabs{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0}#fo .sib-purchase-tabs button.on{background:var(--ac2);border-color:var(--ac);color:var(--ac);font-weight:700}#fo .sib-purchase-pane .box{margin-bottom:14px}#fo .sib-purchase-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0}#fo .sib-purchase-form .wide{grid-column:1/-1}#fo .sib-purchase-form input,#fo .sib-purchase-form select{min-width:0}#fo .sib-purchase-lines{margin:14px 0}#fo .sib-purchase-line-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:8px}#fo .sib-purchase-line input{width:100%;min-width:95px}#fo .sib-purchase-line td:first-child input{min-width:180px}#fo .sib-purchase-line td{vertical-align:middle}#fo .sp-line-total{white-space:nowrap;font-weight:600}#fo .sib-purchase-actions{white-space:nowrap}#fo .sib-purchase-muted{color:var(--mu);padding:10px}#fo .bd{white-space:nowrap}#sib-purchase-print{display:none}@media(max-width:850px){#fo .sib-purchase-kpis{grid-template-columns:repeat(2,minmax(0,1fr))}#fo .sib-purchase-form{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:560px){#fo .sib-purchase-form{grid-template-columns:1fr}#fo .sib-purchase-form .wide{grid-column:auto}}@media print{@page{size:A4 portrait;margin:12mm}body *{visibility:hidden!important}#sib-purchase-print,#sib-purchase-print *{visibility:visible!important}#sib-purchase-print{display:block!important;position:absolute!important;inset:0;width:100%;padding:8mm;background:#fff!important;color:#111!important;font:10pt/1.5 Arial,sans-serif}#sib-purchase-print .head{border-bottom:3px solid #0057B9;padding-bottom:10px;margin-bottom:22px}#sib-purchase-print h1{text-align:center;margin:24px 0}#sib-purchase-print table{width:100%;border-collapse:collapse;margin:18px 0}#sib-purchase-print th,#sib-purchase-print td{border:1px solid #aaa;padding:8px;text-align:left;color:#111!important}#sib-purchase-print .sum{text-align:right}#sib-purchase-print .sign{margin-top:55px;text-align:right}}";
  document.head.appendChild(style);

  var originalDraw = window.draw;
  if (typeof originalDraw === "function" && !window.__sibPurchasesDrawWrapped) {
    window.__sibPurchasesDrawWrapped = true;
    window.draw = function () {
      var result = originalDraw.apply(this, arguments);
      try { render(); } catch (e) { console.error("SIB Achats & Fournisseurs:", e); }
      return result;
    };
  }
  var originalNav = window.nav;
  if (typeof originalNav === "function" && !window.__sibPurchasesNavWrapped) {
    window.__sibPurchasesNavWrapped = true;
    window.nav = function (v) {
      var result = originalNav.apply(this, arguments);
      if (v === "fo") { try { render(); } catch (e) { console.error(e); } }
      return result;
    };
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { if (ensure()) render(); }, {once:true});
  else if (ensure()) render();
})();