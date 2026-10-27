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

  let payload: Record<string, unknown>;
  try { payload = await req.json(); } catch { return respond(400, { error: "Corps JSON invalide." }); }

  // Invitation acceptance: only the invited account can activate its own
  // pending membership, and only after the invitation link established a session.
  if (payload.action === "activate") {
    // Seuls les comptes explicitement marqués comme invitation en attente
    // peuvent activer leur appartenance eux-mêmes. Un membre désactivé ne
    // peut pas contourner la décision de l'administrateur avec cette action.
    if (String(actor.app_metadata?.organization_id || "") !== ORG_ID || actor.app_metadata?.sib_invitation_pending !== true) {
      return respond(403, { error: "Aucune invitation SIB en attente n'est associée à ce compte. Contactez un administrateur pour rétablir l'accès." });
    }
    const { data: pendingMembership, error: pendingError } = await adminClient
      .from("organization_memberships")
      .select("role, active")
      .eq("organization_id", ORG_ID)
      .eq("user_id", actor.id)
      .maybeSingle();
    if (pendingError) {
      console.error("Impossible de vérifier l'invitation SIB:", pendingError.message);
      return respond(500, { error: "Impossible de vérifier l'invitation." });
    }
    if (!pendingMembership) return respond(403, { error: "Aucune invitation SIB n'est associée à ce compte." });
    // Consommer le marqueur serveur AVANT toute activation. Si cette écriture échoue,
    // l'appartenance reste inactive et ne peut pas être réactivée par une nouvelle tentative.
    const nextAppMetadata = { ...(actor.app_metadata || {}) };
    delete nextAppMetadata.sib_invitation_pending;
    const { error: metadataError } = await adminClient.auth.admin.updateUserById(actor.id, { app_metadata: nextAppMetadata });
    if (metadataError) {
      console.error("Impossible de consommer le marqueur d'invitation SIB:", metadataError.message);
      return respond(500, { error: "Invitation vérifiée, mais son statut sécurisé n'a pas pu être consommé. L'accès reste inchangé; contactez l'administrateur." });
    }
    if (pendingMembership.active === true) return respond(200, { ok: true, alreadyActive: true });
    const { data: updatedMembership, error: activateError } = await adminClient
      .from("organization_memberships")
      .update({ active: true })
      .eq("organization_id", ORG_ID)
      .eq("user_id", actor.id)
      .eq("active", false)
      .select("user_id")
      .maybeSingle();
    if (activateError || !updatedMembership) {
      console.error("Échec de l'activation de l'appartenance SIB:", activateError?.message || "aucune ligne mise à jour");
      return respond(500, { error: "Statut d'invitation consommé, mais l'activation SIB a échoué. Le compte est conservé; contactez l'administrateur pour terminer l'activation." });
    }
    return respond(200, { ok: true, message: "Compte SIB activé." });
  }

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
    return respond(403, { error: "Seul un administrateur SIB actif peut gérer les utilisateurs." });
  }

  // Désactivation réversible : conserver le compte Auth et ses données.
  // La suppression définitive d'un compte n'est jamais déclenchée par cette action.
  if (payload.action === "deactivate") {
    const targetUserId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return respond(400, { error: "Identifiant utilisateur invalide." });
    }
    if (targetUserId === actor.id) {
      return respond(400, { error: "Vous ne pouvez pas désactiver votre propre compte administrateur." });
    }

    const { data: target, error: targetError } = await adminClient
      .from("organization_memberships")
      .select("user_id, role, active")
      .eq("organization_id", ORG_ID)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetError) return respond(500, { error: "Impossible de vérifier l'utilisateur ciblé." });
    if (!target) return respond(404, { error: "Aucune appartenance SIB trouvée pour cet utilisateur." });
    // Une ancienne invitation ne doit jamais permettre une réactivation après désactivation.
    const { data: targetAuth, error: targetAuthError } = await adminClient.auth.admin.getUserById(targetUserId);
    if (targetAuthError) return respond(500, { error: "Impossible de vérifier les métadonnées sécurisées de l'utilisateur." });
    if (targetAuth.user?.app_metadata?.sib_invitation_pending === true) {
      const safeMetadata = { ...(targetAuth.user.app_metadata || {}) };
      delete safeMetadata.sib_invitation_pending;
      const { error: clearPendingError } = await adminClient.auth.admin.updateUserById(targetUserId, { app_metadata: safeMetadata });
      if (clearPendingError) return respond(500, { error: "Impossible de sécuriser le statut d'invitation. La désactivation n'a pas été poursuivie." });
    }
    if (target.active !== true) return respond(200, { ok: true, alreadyInactive: true, message: "L'utilisateur est déjà désactivé." });

    if (target.role === "Administrateur") {
      const { data: admins, error: adminsError } = await adminClient
        .from("organization_memberships")
        .select("user_id")
        .eq("organization_id", ORG_ID)
        .eq("role", "Administrateur")
        .eq("active", true);
      if (adminsError) return respond(500, { error: "Impossible de vérifier les administrateurs actifs." });
      if ((admins || []).filter((item: any) => item.user_id !== targetUserId).length === 0) {
        return respond(409, { error: "Impossible de désactiver le dernier administrateur actif de SIB." });
      }
    }

    const { data: changed, error: deactivateError } = await adminClient
      .from("organization_memberships")
      .update({ active: false })
      .eq("organization_id", ORG_ID)
      .eq("user_id", targetUserId)
      .eq("active", true)
      .select("user_id")
      .maybeSingle();
    if (deactivateError || !changed) {
      console.error("Échec de la désactivation d'une appartenance SIB:", deactivateError?.message || "aucune ligne mise à jour");
      return respond(500, { error: "Désactivation impossible. Le compte Auth et les données n'ont pas été supprimés." });
    }
    return respond(200, { ok: true, message: "Accès SIB désactivé. Le compte Auth et ses données sont conservés." });
  }

  // Réactivation réservée à un administrateur SIB actif. Le compte Auth existant est réutilisé.
  if (payload.action === "reactivate") {
    const targetUserId = typeof payload.user_id === "string" ? payload.user_id.trim() : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetUserId)) {
      return respond(400, { error: "Identifiant utilisateur invalide." });
    }
    const { data: target, error: targetError } = await adminClient
      .from("organization_memberships")
      .select("user_id, active")
      .eq("organization_id", ORG_ID)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (targetError) return respond(500, { error: "Impossible de vérifier l'utilisateur ciblé." });
    if (!target) return respond(404, { error: "Aucune appartenance SIB trouvée pour cet utilisateur." });
    if (target.active === true) return respond(200, { ok: true, alreadyActive: true, message: "L'utilisateur est déjà actif." });
    const { data: changed, error: reactivateError } = await adminClient
      .from("organization_memberships")
      .update({ active: true })
      .eq("organization_id", ORG_ID)
      .eq("user_id", targetUserId)
      .eq("active", false)
      .select("user_id")
      .maybeSingle();
    if (reactivateError || !changed) {
      console.error("Échec de la réactivation d'une appartenance SIB:", reactivateError?.message || "aucune ligne mise à jour");
      return respond(500, { error: "Réactivation impossible. Le compte Auth et ses données sont conservés." });
    }
    return respond(200, { ok: true, message: "Accès SIB réactivé. Le compte Auth et ses données sont conservés." });
  }

  if (payload.action === "list") {
    const { data: memberships, error: listError } = await adminClient.from("organization_memberships").select("user_id, role, active, created_at").eq("organization_id", ORG_ID).order("created_at", { ascending: true });
    if (listError) return respond(500, { error: "Impossible de charger les adhésions utilisateurs." });
    const authUsers: Record<string, any> = {};
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
      if (error) return respond(500, { error: "Impossible de charger les comptes Auth Supabase." });
      for (const user of data.users || []) authUsers[user.id] = user;
      if (!data.users || data.users.length < 100) break;
    }
    const users = (memberships || []).map((m: any) => {
      const u = authUsers[m.user_id]; const meta = u?.user_metadata || {}; const email = String(u?.email || "").toLowerCase();
      const fullName = String(meta.full_name || meta.name || "").trim(); const parts = fullName.split(/\s+/).filter(Boolean);
      return { id: m.user_id, pn: meta.first_name || parts[0] || email.split("@")[0] || "Utilisateur", nm: meta.last_name || parts.slice(1).join(" "), nom: fullName || email.split("@")[0] || "Utilisateur", mail: email, login: email, role: m.role, actif: m.active === true, invitationPending: m.active !== true && !!u?.invited_at && !u?.last_sign_in_at, mc: false, cloudAuth: true, last: u?.last_sign_in_at || null, cr: m.created_at || u?.created_at || null };
    });
    return respond(200, { ok: true, users });
  }

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
    data: { full_name: fullName, organization_id: ORG_ID, organization_name: organization.name, sib_invitation_pending: true },
    ...(redirectTo ? { redirectTo } : {}),
  });
  if (inviteError || !invited.user) {
    const msg = inviteError?.message || "Invitation non créée.";
    console.error("Invitation Supabase refusée:", msg);
    return respond(400, { error: msg.includes("already") || msg.includes("registered")
      ? "Cette adresse possède déjà un compte Supabase. Utilisez le parcours de rattachement d'un compte existant."
      : ("Invitation refusée par Supabase Auth : " + msg.slice(0, 240)) });
  }

  // Authorization markers belong in app_metadata, which the user cannot edit.
  // user_metadata is user-editable and must never authorize invitation activation.
  const { error: invitationMetadataError } = await adminClient.auth.admin.updateUserById(invited.user.id, {
    app_metadata: { ...(invited.user.app_metadata || {}), organization_id: ORG_ID, sib_invitation_pending: true },
  });
  if (invitationMetadataError) {
    console.error("Compte invité conservé, mais marqueur d’invitation sécurisé impossible à enregistrer:", invitationMetadataError.message);
    return respond(500, { error: "Invitation envoyée et compte conservé, mais son statut sécurisé n’a pas pu être initialisé. Corrigez le compte dans Supabase avant de poursuivre." });
  }

  const { error: addMembershipError } = await adminClient
    .from("organization_memberships")
    .insert({ organization_id: ORG_ID, user_id: invited.user.id, role, active: false });
  if (addMembershipError) {
    // Ne jamais supprimer automatiquement un compte Auth déjà créé :
    // la conservation du compte est indépendante de l'échec du rattachement.
    // Un administrateur peut corriger l'appartenance sans perdre le compte invité.
    console.error("Échec du rattachement après invitation; compte Auth conservé:", addMembershipError.message);
    return respond(500, {
      error: "Invitation créée, mais rattachement SIB impossible. Le compte Supabase est conservé. Corrigez l'appartenance dans Supabase avant de relancer l'invitation."
    });
  }

  return respond(200, {
    ok: true,
    message: "Invitation envoyée. L'utilisateur doit ouvrir le lien reçu par e-mail pour activer son compte.",
    email,
    role,
  });
});
