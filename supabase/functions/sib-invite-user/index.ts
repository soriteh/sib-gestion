import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

const ORG_ID = "6070dc4b-5c5e-402c-911b-735cb754d241";
const ALLOWED_ROLES = new Set([
  "Administrateur", "Direction", "Comptable", "RH", "Caissier",
  "Commercial", "Technicien", "Formateur", "Magasinier",
]);

function respond(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return respond(405, { error: "Méthode non autorisée." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    console.error("Configuration Supabase manquante pour sib-invite-user.");
    return respond(500, { error: "Le service d'invitation n'est pas configuré." });
  }

  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token || token === authHeader) return respond(401, { error: "Connexion administrateur requise." });

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userResult, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userResult.user) return respond(401, { error: "Session invalide ou expirée." });
  const actor = userResult.user;

  const { data: membership, error: membershipError } = await adminClient
    .from("organization_memberships")
    .select("role, active")
    .eq("organization_id", ORG_ID)
    .eq("user_id", actor.id)
    .maybeSingle();
  if (membershipError) {
    console.error("Impossible de vérifier le rôle de l'administrateur:", membershipError.message);
    return respond(500, { error: "Impossible de vérifier les autorisations." });
  }
  if (!membership || membership.active !== true || membership.role !== "Administrateur") {
    return respond(403, { error: "Seul un administrateur SIB actif peut inviter un utilisateur." });
  }

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return respond(400, { error: "Corps JSON invalide." }); }
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  const fullName = typeof payload.full_name === "string" ? payload.full_name.trim().slice(0, 160) : "";
  const role = typeof payload.role === "string" ? payload.role : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return respond(400, { error: "Une adresse e-mail valide est obligatoire." });
  if (!fullName) return respond(400, { error: "Le nom complet est obligatoire." });
  if (!ALLOWED_ROLES.has(role)) return respond(400, { error: "Rôle SIB invalide." });

  const { data: organization, error: orgError } = await adminClient
    .from("organizations").select("id, name").eq("id", ORG_ID).maybeSingle();
  if (orgError || !organization) return respond(500, { error: "Organisation SIB introuvable." });

  const redirectTo = Deno.env.get("SIB_AUTH_REDIRECT_URL");
  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, organization_id: ORG_ID, organization_name: organization.name },
    ...(redirectTo ? { redirectTo } : {}),
  });
  if (inviteError || !invited.user) {
    const msg = inviteError?.message || "Invitation non créée.";
    console.error("Invitation Supabase refusée:", msg);
    return respond(400, { error: msg.includes("already") || msg.includes("registered")
      ? "Cette adresse possède déjà un compte Supabase. Utilisez le parcours de rattachement d'un compte existant."
      : "Impossible de créer l'invitation. Vérifiez la configuration e-mail de Supabase et réessayez." });
  }

  const { error: addMembershipError } = await adminClient
    .from("organization_memberships")
    .insert({ organization_id: ORG_ID, user_id: invited.user.id, role, active: true });
  if (addMembershipError) {
    console.error("Échec du rattachement après invitation:", addMembershipError.message);
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(invited.user.id);
    if (rollbackError) console.error("Échec du nettoyage du compte invité:", rollbackError.message);
    return respond(500, { error: "Invitation créée mais rattachement SIB impossible. Le système a tenté d'annuler le compte; vérifiez les utilisateurs Supabase avant de recommencer." });
  }

  return respond(200, {
    ok: true,
    message: "Invitation envoyée. L'utilisateur doit ouvrir le lien reçu par e-mail pour activer son compte.",
    email,
    role,
  });
});
