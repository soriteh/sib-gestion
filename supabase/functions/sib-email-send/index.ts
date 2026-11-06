import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.9.16";

const ORG_ID = "6070dc4b-5c5e-402c-911b-735cb754d241";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};
const reply = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({
  "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
}[c]!));

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return reply(405, { error: "Méthode non autorisée." });

  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const host = Deno.env.get("SMTP_HOST");
  const port = Number(Deno.env.get("SMTP_PORT") || "587");
  const user = Deno.env.get("SMTP_USER");
  const pass = Deno.env.get("SMTP_PASS");
  const from = Deno.env.get("SMTP_FROM");
  if (!url || !anon || !service) return reply(500, { error: "Configuration Supabase incomplète." });
  const missingSmtp = [
    !host ? "SMTP_HOST" : "",
    !Deno.env.get("SMTP_PORT") || !Number.isFinite(port) ? "SMTP_PORT" : "",
    !user ? "SMTP_USER" : "",
    !pass ? "SMTP_PASS" : "",
    !from ? "SMTP_FROM" : "",
  ].filter(Boolean);
  if (missingSmtp.length) {
    return reply(503, { error: "Secrets SMTP absents ou vides : " + missingSmtp.join(", ") + ". Vérifiez les valeurs dans Supabase Edge Function Secrets." });
  }

  const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply(400, { error: "Corps JSON invalide." }); }

  if (body.action === "cron_reminders") {
    const cronToken = req.headers.get("x-sib-cron-token") || "";
    const { data: tokenValid, error: tokenError } = await admin.rpc("sib_verify_email_cron_token", { p_token: cronToken });
    if (tokenError || tokenValid !== true) return reply(401, { error: "Autorisation de tâche planifiée invalide." });
    const { data: appRow, error: stateError } = await admin.from("sib_app_state").select("state").eq("organization_id", ORG_ID).maybeSingle();
    if (stateError || !appRow?.state) return reply(500, { error: "État central de SIB Gestion indisponible." });
    const state = appRow.state as Record<string, any>;
    const invoices = Array.isArray(state.fa) ? state.fa : [];
    const clients = Array.isArray(state.c) ? state.c : [];
    const entries = Array.isArray(state.e) ? state.e : [];
    const reversed = new Set(entries.filter((x: any) => x?.rev).map((x: any) => String(x.rev)));
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: recent, error: recentError } = await admin.from("sib_email_logs").select("metadata").eq("organization_id", ORG_ID).eq("email_type", "reminder").eq("status", "sent").gte("sent_at", since);
    if (recentError) return reply(500, { error: "Impossible de vérifier l'historique des relances." });
    const recentlyReminded = new Set((recent || []).map((x: any) => String(x.metadata?.invoice_id || "")).filter(Boolean));
    const transporter = nodemailer.createTransport({ host, port, secure: port === 465, auth: { user, pass }, connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000 });
    let sent = 0, skipped = 0, failed = 0;
    for (const invoice of invoices) {
      if (!invoice || invoice.x || !invoice.id || recentlyReminded.has(String(invoice.id))) { skipped++; continue; }
      const issued = new Date(invoice.d || 0);
      if (!Number.isFinite(issued.getTime()) || Date.now() - issued.getTime() < 7 * 86400000) { skipped++; continue; }
      const total = Math.max(0, Number(invoice.m) || 0);
      const paid = entries.filter((x: any) => x && x.t === "recette" && String(x.fac) === String(invoice.id) && !x.rev && !reversed.has(String(x.id))).reduce((sum: number, x: any) => sum + (Number(x.m) || 0), 0);
      const due = Math.max(0, total - paid);
      if (!due) { skipped++; continue; }
      const client = clients.find((x: any) => String(x?.id) === String(invoice.c));
      const recipient = String(client?.mail || client?.email || "").trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) { skipped++; continue; }
      const subject = "Rappel de paiement — facture " + String(invoice.no || "");
      const textBody = "Bonjour " + String(client?.n || "Client") + ",\n\nNous vous rappelons que la facture " + String(invoice.no || "") + " présente un solde restant de " + due.toLocaleString("fr-FR") + " GNF. Merci de nous indiquer la date prévue de règlement. Si le paiement a déjà été effectué, veuillez ne pas tenir compte de ce rappel.\n\nCordialement,\nSoritech Innov Business (SIB)";
      try {
        await transporter.sendMail({ from, to: recipient, subject, text: textBody, html: `<div style="font-family:Arial,sans-serif;color:#071A36;max-width:680px;margin:auto;padding:24px"><h2 style="color:#0057B9">SIB Gestion</h2><p>${esc(textBody)}</p><p style="color:#0057B9;font-weight:bold">Soritech Innov Business (SIB)</p><small>INNOVER • DÉVELOPPER • CONNECTER</small></div>` });
        await admin.from("sib_email_logs").insert({ organization_id: ORG_ID, recipient, subject, email_type: "reminder", status: "sent", metadata: { source: "scheduled-reminder", invoice_id: String(invoice.id), invoice_no: String(invoice.no || "") }, sent_at: new Date().toISOString() });
        sent++; recentlyReminded.add(String(invoice.id));
      } catch (mailError) {
        failed++;
        const message = mailError instanceof Error ? mailError.message.slice(0, 500) : "Erreur SMTP inconnue.";
        await admin.from("sib_email_logs").insert({ organization_id: ORG_ID, recipient, subject, email_type: "reminder", status: "failed", error_message: message, metadata: { source: "scheduled-reminder", invoice_id: String(invoice.id), invoice_no: String(invoice.no || "") } });
      }
    }
    await transporter.close();
    return reply(200, { ok: true, sent, skipped, failed });
  }

  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token || token === auth) return reply(401, { error: "Connexion requise." });
  const actorClient = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await actorClient.auth.getUser(token);
  if (authError || !authData.user) return reply(401, { error: "Session invalide ou expirée." });
  const type = String(body.email_type || "general");
  const allowedRoles = type === "hr"
    ? ["Administrateur", "Super Administrateur", "Direction", "RH"]
    : ["Administrateur", "Super Administrateur", "Direction", "RH", "Comptable", "Commercial"];
  const { data: membership, error: memberError } = await admin
    .from("organization_memberships").select("role,active")
    .eq("organization_id", ORG_ID).eq("user_id", authData.user.id).maybeSingle();
  if (memberError) return reply(500, { error: "Vérification des autorisations impossible." });
  if (!membership || membership.active !== true || !allowedRoles.includes(membership.role)) {
    return reply(403, { error: "Votre rôle ne permet pas cet envoi d'e-mail." });
  }

  if (type === "reminder" && body.metadata && typeof body.metadata === "object") {
    const invoiceId = String((body.metadata as Record<string, unknown>).invoice_id || "");
    const reminderDay = String((body.metadata as Record<string, unknown>).reminder_day || "");
    if (invoiceId && reminderDay) {
      const { data: prior, error: priorError } = await admin.from("sib_email_logs").select("id").eq("organization_id", ORG_ID).eq("email_type", "reminder").eq("status", "sent").contains("metadata", { invoice_id: invoiceId, reminder_day: reminderDay }).limit(1);
      if (priorError) return reply(500, { error: "Impossible de vérifier les relances déjà envoyées." });
      if (prior?.length) return reply(200, { ok: true, alreadySent: true, recipient: String(body.to || "") });
    }
  }

  const to = String(body.to || "").trim();
  const subject = String(body.subject || "").trim();
  const textBody = String(body.text || "").trim();
  if (to.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return reply(400, { error: "Adresse e-mail destinataire invalide." });
  if (!subject || subject.length > 180) return reply(400, { error: "Objet obligatoire (180 caractères maximum)." });
  if (!textBody || textBody.length > 20000) return reply(400, { error: "Le message est vide ou dépasse 20 000 caractères." });
  if (!["general","invoice","quote","reminder","hr","maya"].includes(type)) return reply(400, { error: "Type d'e-mail non autorisé." });

  const org = "Soritech Innov Business (SIB)";
  const html = `<div style="font-family:Arial,sans-serif;color:#071A36;max-width:680px;margin:auto;padding:24px;border:1px solid #e5eaf2;border-radius:12px"><div style="font-size:22px;font-weight:700;color:#0057B9">SIB Gestion</div><div style="height:3px;background:#FF7800;margin:14px 0 22px"></div><div style="font-size:15px;line-height:1.65;white-space:pre-wrap">${esc(textBody)}</div><hr style="border:0;border-top:1px solid #e5eaf2;margin:24px 0"><b style="color:#0057B9">${org}</b><div style="color:#64748b;font-size:12px;margin-top:5px">INNOVER • DÉVELOPPER • CONNECTER</div></div>`;
  let sent = false;
  let errorMessage: string | null = null;
  try {
    const transporter = nodemailer.createTransport({
      host, port, secure: port === 465, auth: { user, pass },
      connectionTimeout: 12000, greetingTimeout: 12000, socketTimeout: 20000,
    });
    await transporter.sendMail({ from, to, subject, text: textBody, html });
    await transporter.close();
    sent = true;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message.slice(0, 500) : "Erreur SMTP inconnue.";
    console.error("SIB email send failed:", errorMessage);
  }

  const { error: logError } = await admin.from("sib_email_logs").insert({
    organization_id: ORG_ID, actor_user_id: authData.user.id, recipient: to,
    subject, email_type: type, status: sent ? "sent" : "failed",
    error_message: errorMessage, metadata: { source: String(body.source || "application"), ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}) },
    sent_at: sent ? new Date().toISOString() : null,
  });
  if (logError) console.error("SIB email log insert failed:", logError.message);
  if (!sent) return reply(502, { ok: false, error: "L'e-mail n'a pas pu être envoyé. Vérifiez la connexion SMTP et réessayez." });
  return reply(200, { ok: true, sent: true, recipient: to, subject });
});
