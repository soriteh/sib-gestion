import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: cors });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée." });

  const url = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const accessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN") || "";
  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID") || "";
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v23.0";
  if (!url || !anonKey || !serviceKey) return json(503, { error: "Configuration Supabase serveur incomplète." });
  if (!accessToken || !phoneNumberId) {
    return json(503, { error: "WhatsApp n’est pas encore connecté. Configurez WHATSAPP_ACCESS_TOKEN et WHATSAPP_PHONE_NUMBER_ID dans les secrets Supabase après la création du compte Meta." });
  }

  const authorization = req.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return json(401, { error: "Authentification requise." });
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await userClient.auth.getUser();
  if (authError || !auth.user) return json(401, { error: "Session SIB invalide ou expirée." });

  let body: any;
  try { body = await req.json(); } catch { return json(400, { error: "Corps JSON invalide." }); }
  const organizationId = "6070dc4b-5c5e-402c-911b-735cb754d241";
  const kind = String(body?.recipient_type || "");
  const contactRef = String(body?.recipient_ref || "");
  const templateName = String(body?.template_name || "").trim();
  const languageCode = String(body?.language_code || "fr");
  const parameters = Array.isArray(body?.parameters) ? body.parameters : [];
  if (!["employee", "client", "supplier", "other"].includes(kind) || !contactRef || !/^[a-z0-9_]{1,128}$/i.test(templateName)) {
    return json(400, { error: "Destinataire ou nom de modèle invalide." });
  }
  if (parameters.length > 10 || parameters.some((v: unknown) => typeof v !== "string" || v.length > 1024)) {
    return json(400, { error: "Les paramètres du modèle doivent être au maximum 10 chaînes de 1024 caractères." });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: memberships, error: membershipError } = await admin.from("organization_memberships")
    .select("role,active").eq("organization_id", organizationId).eq("user_id", auth.user.id).eq("active", true).limit(1);
  if (membershipError) return json(500, { error: "Vérification des autorisations impossible." });
  const membership = memberships?.[0];
  if (!membership || !["Administrateur", "Direction", "RH", "Comptable", "Commercial"].includes(membership.role)) {
    return json(403, { error: "Votre rôle SIB n’est pas autorisé à envoyer des messages WhatsApp." });
  }

  const { data: contact, error: contactError } = await admin.from("sib_whatsapp_contacts")
    .select("id,phone_e164,display_name,opt_in,opt_out_at")
    .eq("organization_id", organizationId).eq("contact_type", kind).eq("contact_ref", contactRef).maybeSingle();
  if (contactError) return json(500, { error: "Lecture du destinataire impossible." });
  if (!contact) return json(404, { error: "Destinataire non enregistré dans le registre WhatsApp." });
  if (!contact.opt_in || contact.opt_out_at) return json(403, { error: "Envoi bloqué : le destinataire n’a pas donné son consentement actif." });

  const { data: log, error: logError } = await admin.from("sib_whatsapp_message_log").insert({
    organization_id: organizationId, recipient_phone: contact.phone_e164, recipient_type: kind,
    recipient_ref: contactRef, message_kind: "template", template_name: templateName,
    status: "queued", initiated_by: auth.user.id
  }).select("id").single();
  if (logError || !log) return json(500, { error: "Impossible de créer le journal d’envoi." });

  const payload = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: contact.phone_e164.replace(/^\+/, ""),
    type: "template",
    template: { name: templateName, language: { code: languageCode }, ...(parameters.length ? { components: [{ type: "body", parameters: parameters.map((text: string) => ({ type: "text", text })) }] } : {}) }
  };
  try {
    const response = await fetch(`https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const responseBody = await response.json().catch(() => ({}));
    if (!response.ok) {
      await admin.from("sib_whatsapp_message_log").update({
        status: "failed", error_code: String(responseBody?.error?.code || response.status),
        error_detail: String(responseBody?.error?.message || "Échec de l’API WhatsApp").slice(0, 500), updated_at: new Date().toISOString()
      }).eq("id", log.id);
      return json(502, { error: "Meta a refusé l’envoi. Vérifiez le modèle, le numéro et les paramètres WhatsApp.", log_id: log.id, provider_error: String(responseBody?.error?.message || "").slice(0, 240) });
    }
    const messageId = responseBody?.messages?.[0]?.id || null;
    await admin.from("sib_whatsapp_message_log").update({
      status: "sent", provider_message_id: messageId, sent_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }).eq("id", log.id);
    return json(200, { ok: true, log_id: log.id, provider_message_id: messageId, status: "sent" });
  } catch (_error) {
    await admin.from("sib_whatsapp_message_log").update({
      status: "failed", error_detail: "Erreur réseau vers Meta Graph API", updated_at: new Date().toISOString()
    }).eq("id", log.id);
    return json(502, { error: "Erreur réseau lors de la connexion à WhatsApp." });
  }
});