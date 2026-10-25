import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "Méthode non autorisée." });
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
  const subject = Deno.env.get("VAPID_SUBJECT") || "";
  if (!url || !serviceKey || !publicKey || !privateKey || !subject) {
    return json(503, { error: "Le service push n'est pas configuré : secrets Supabase/VAPID manquants." });
  }
  // Database Webhook must send the server-side service-role bearer. Never expose this key to browsers.
  const authorization = req.headers.get("Authorization") || "";
  if (authorization !== "Bearer " + serviceKey) return json(401, { error: "Authentification serveur requise." });
  let payload: any;
  try { payload = await req.json(); } catch { return json(400, { error: "Charge utile JSON invalide." }); }
  const notification = payload?.record || payload?.notification || payload;
  const notificationId = String(notification?.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(notificationId)) return json(400, { error: "Identifiant de notification invalide." });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: row, error: readError } = await admin.from("sib_internal_notifications")
    .select("id,organization_id,user_id,title,body,target_type,target_id,created_at")
    .eq("id", notificationId).maybeSingle();
  if (readError) return json(500, { error: "Lecture de la notification impossible." });
  if (!row) return json(404, { error: "Notification introuvable." });
  const { data: subscriptions, error: subscriptionsError } = await admin.from("sib_push_subscriptions")
    .select("id,endpoint,p256dh,auth_secret")
    .eq("user_id", row.user_id).eq("organization_id", row.organization_id);
  if (subscriptionsError) return json(500, { error: "Lecture des abonnements push impossible." });
  if (!subscriptions?.length) return json(200, { ok: true, delivered: 0, reason: "no_subscriptions" });

  webpush.setVapidDetails(subject, publicKey, privateKey);
  const message = JSON.stringify({
    notification_id: row.id,
    title: String(row.title || "SIB Gestion").slice(0, 120),
    body: String(row.body || "Vous avez une nouvelle notification.").slice(0, 500),
    url: Deno.env.get("SIB_APP_URL") || "/"
  });
  let delivered = 0, failed = 0, removed = 0;
  for (const item of subscriptions) {
    try {
      await webpush.sendNotification({
        endpoint: item.endpoint,
        keys: { p256dh: item.p256dh, auth: item.auth_secret }
      }, message, { TTL: 60 * 60 });
      delivered++;
    } catch (error) {
      failed++;
      const status = Number((error as { statusCode?: number })?.statusCode || 0);
      if (status === 404 || status === 410) {
        const { error: deleteError } = await admin.from("sib_push_subscriptions").delete().eq("id", item.id);
        if (!deleteError) removed++;
      }
    }
  }
  return json(200, { ok: true, delivered, failed, removed_expired: removed });
});
