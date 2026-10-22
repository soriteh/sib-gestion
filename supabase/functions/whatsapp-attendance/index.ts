import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
const env = (key: string, fallback = "") => Deno.env.get(key) || fallback;
const phone = (value: string) => value.replace(/\D/g, "").replace(/^00/, "");
const todayGN = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Conakry", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());

function statusForReply(sentAt: string | null, receivedAt: Date) {
  if (!sentAt) return "review";
  const mins = (receivedAt.getTime() - new Date(sentAt).getTime()) / 60000;
  if (mins <= 1) return "present";
  if (mins > 5) return "late";
  return "review"; // Entre 1 et 5 minutes : validation humaine, règle non définie.
}

async function sendWhatsApp(to: string, payload: Record<string, unknown>) {
  const token = env("WHATSAPP_ACCESS_TOKEN");
  const phoneId = env("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) throw new Error("Configuration WhatsApp manquante côté serveur.");
  const res = await fetch(`https://graph.facebook.com/v23.0/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, ...payload }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error?.message || "Échec de l'envoi WhatsApp.");
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const verifyToken = env("WHATSAPP_WEBHOOK_VERIFY_TOKEN");
  if (req.method === "GET") {
    const u = new URL(req.url);
    if (u.searchParams.get("hub.mode") === "subscribe" &&
        u.searchParams.get("hub.verify_token") === verifyToken &&
        u.searchParams.get("hub.challenge")) {
      return new Response(u.searchParams.get("hub.challenge"), { status: 200 });
    }
    return new Response("Forbidden", { status: 403 });
  }

  const supabaseUrl = env("SUPABASE_URL");
  const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Configuration Supabase serveur manquante." }, 500);
  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // Jobs internes (synchronisation des employés / clôture) : protégés par un secret serveur.
  const url = new URL(req.url);
  if (url.searchParams.get("action") === "sync-employees" || url.searchParams.get("action") === "close-day") {
    const secret = env("ATTENDANCE_CRON_SECRET");
    if (!secret || req.headers.get("x-cron-secret") !== secret) return json({ error: "Non autorisé." }, 401);
    const action = url.searchParams.get("action");
    if (action === "send-reminders") {
      const date = todayGN();
      const templateName = env("WHATSAPP_ATTENDANCE_TEMPLATE");
      const language = env("WHATSAPP_TEMPLATE_LANGUAGE", "fr");
      if (!templateName) return json({ error: "Définissez WHATSAPP_ATTENDANCE_TEMPLATE avec le nom d'un modèle Meta approuvé." }, 400);
      const { data: employees, error: listError } = await db.from("whatsapp_attendance_employees")
        .select("employee_id,full_name,phone_e164").eq("active", true);
      if (listError) return json({ error: listError.message }, 500);
      let sent = 0, skipped = 0, failed = 0;
      for (const employee of employees || []) {
        const { data: existing } = await db.from("whatsapp_attendance_sessions")
          .select("id,status").eq("employee_id", employee.employee_id).eq("work_date", date).maybeSingle();
        if (existing) { skipped++; continue; }
        const { data: created, error: insertError } = await db.from("whatsapp_attendance_sessions")
          .insert({ employee_id: employee.employee_id, work_date: date, status: "pending" })
          .select("id").single();
        if (insertError || !created) { failed++; continue; }
        try {
          const result = await sendWhatsApp(employee.phone_e164, {
            type: "template",
            template: { name: templateName, language: { code: language },
              components: [{ type: "body", parameters: [{ type: "text", text: employee.full_name }] }] },
          });
          await db.from("whatsapp_attendance_sessions").update({
            message_sent_at: new Date().toISOString(), updated_at: new Date().toISOString(),
          }).eq("id", created.id);
          await db.from("whatsapp_attendance_events").insert({
            employee_id: employee.employee_id, phone_e164: employee.phone_e164,
            event_type: "reminder_sent", payload: { message_id: result?.messages?.[0]?.id || null },
          });
          sent++;
        } catch (err) {
          await db.from("whatsapp_attendance_sessions").update({ status: "error", updated_at: new Date().toISOString() }).eq("id", created.id);
          await db.from("whatsapp_attendance_events").insert({
            employee_id: employee.employee_id, phone_e164: employee.phone_e164,
            event_type: "reminder_failed", payload: { error: String(err).slice(0, 500) },
          });
          failed++;
        }
      }
      return json({ date, sent, skipped, failed });
    }
    if (action === "sync-employees") {
      const body = await req.json().catch(() => ({}));
      if (!Array.isArray(body.employees)) return json({ error: "employees doit être une liste." }, 400);
      const employees = body.employees.filter((e: any) => e?.id && e?.name && e?.phone)
        .map((e: any) => ({ employee_id: String(e.id), full_name: String(e.name).slice(0, 180),
          phone_e164: phone(String(e.phone)), active: e.active !== false }));
      if (employees.some((e: any) => e.phone_e164.length < 8)) return json({ error: "Un numéro de téléphone semble invalide." }, 400);
      if (employees.length) {
        const { error } = await db.from("whatsapp_attendance_employees").upsert(employees, { onConflict: "employee_id" });
        if (error) return json({ error: error.message }, 500);
      }
      return json({ synced: employees.length });
    }

    // La clôture ne classe absent que si aucune réponse n'a été reçue.
    const date = todayGN();
    const { data: pending, error } = await db.from("whatsapp_attendance_sessions")
      .select("id,employee_id").eq("work_date", date).eq("status", "pending");
    if (error) return json({ error: error.message }, 500);
    const ids = (pending || []).map((x: any) => x.id);
    if (ids.length) {
      const { error: updateError } = await db.from("whatsapp_attendance_sessions").update({
        status: "absent", updated_at: new Date().toISOString(),
      }).in("id", ids);
      if (updateError) return json({ error: updateError.message }, 500);
    }
    return json({ date, markedAbsent: ids.length });
  }

  const rawBody = await req.text();
  const appSecret = env("WHATSAPP_APP_SECRET");
  const signature = req.headers.get("x-hub-signature-256") || "";
  if (!appSecret) return json({ error: "Secret de signature Meta non configuré côté serveur." }, 500);
  if (!signature.startsWith("sha256=")) return json({ error: "Signature webhook absente." }, 401);
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = "sha256=" + Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("");
  const a = new TextEncoder().encode(signature);
  const b = new TextEncoder().encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.min(a.length, b.length); i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return json({ error: "Signature webhook invalide." }, 401);
  let body: any;
  try { body = JSON.parse(rawBody); } catch { return json({ error: "JSON invalide." }, 400); }
  if (!body || body.object !== "whatsapp_business_account") return json({ received: true });

  for (const entry of body.entry || []) for (const change of entry.changes || []) {
    const value = change.value || {};
    for (const message of value.messages || []) {
      const from = phone(String(message.from || ""));
      const text = String(message.text?.body || message.button?.text || message.interactive?.button_reply?.title || "").trim();
      const receivedAt = new Date(Number(message.timestamp || Math.floor(Date.now() / 1000)) * 1000);
      const { data: employee } = await db.from("whatsapp_attendance_employees")
        .select("employee_id,full_name,phone_e164").eq("phone_e164", from).eq("active", true).maybeSingle();
      const date = todayGN();
      const { data: session } = employee ? await db.from("whatsapp_attendance_sessions")
        .select("*").eq("employee_id", employee.employee_id).eq("work_date", date).maybeSingle() : { data: null };
      const status = session ? statusForReply(session.message_sent_at, receivedAt) : "review";
      await db.from("whatsapp_attendance_events").upsert({
        wamid: message.id || null, employee_id: employee?.employee_id || null, phone_e164: from,
        event_type: "incoming_message", payload: { text, timestamp: message.timestamp || null },
      }, { onConflict: "wamid" });
      if (session && session.status === "pending") {
        await db.from("whatsapp_attendance_sessions").update({
          reply_received_at: receivedAt.toISOString(), reply_text: text.slice(0, 2000),
          status, updated_at: new Date().toISOString(),
        }).eq("id", session.id);
        const reply = status === "present"
          ? `Bonjour ${employee.full_name}, votre réponse a été reçue. Votre statut est enregistré comme présent, sous réserve de vérification.`
          : status === "late"
            ? `Bonjour ${employee.full_name}, votre réponse a été reçue après le délai de 5 minutes. Votre statut est enregistré comme retard, sous réserve de vérification.`
            : `Bonjour ${employee.full_name}, votre réponse a été reçue. Votre situation sera vérifiée par le responsable.`;
        try { await sendWhatsApp(from, { type: "text", text: { preview_url: false, body: reply } }); } catch (_) { /* La réponse est enregistrée même si l'accusé échoue. */ }
      }
    }
  }
  return json({ received: true });
});
