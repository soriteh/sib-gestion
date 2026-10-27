/* SIB Gestion — shared Supabase client and organization context.
 * Include after supabase-config.js and before any code that uses window.SIBCloud.
 * Browser-safe values only: URL + publishable/anon key. Never use service_role.
 */
(function () {
  "use strict";
  const config = window.SIB_SUPABASE_CONFIG || {};
  const ready = !!(
    window.supabase &&
    typeof window.supabase.createClient === "function" &&
    /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.url || "") &&
    config.publishableKey &&
    !String(config.publishableKey).startsWith("REMPLACER_")
  );

  let client = null;
  if (ready) {
    client = window.supabase.createClient(config.url, config.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: "sib-supabase-auth"
      }
    });
  }

  function isTransientDataApiError(error) {
    const message = String(error?.message || "");
    const code = String(error?.code || "");
    const status = Number(error?.status || error?.statusCode || 0);
    return code === "PGRST002" || code === "PGRST003" ||
      (status >= 500 && status <= 599) ||
      /timed out acquiring connection|schema cache.*retry|failed to fetch|networkerror|fetch failed|cors|cross-origin/i.test(message);
  }

  async function requireSession() {
    if (!client) throw new Error("Supabase n'est pas configuré. Vérifiez supabase-config.js.");
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (!data.session) throw new Error("Session absente. Connectez-vous avec votre compte SIB.");
    return data.session;
  }

  async function getMembership(userId) {
    if (!client) throw new Error("Supabase n'est pas configuré.");
    // The existing connection test confirms these table names. Do not silently
    // fall back to the new sib_* schema: reconcile the database schema first.
    const { data, error } = await client
      .from("organization_memberships")
      .select("role, active, organization_id, organizations(name, short_name)")
      .eq("user_id", userId);
    if (error) throw error;
    const memberships = (data || []).filter(row =>
      row.active === true &&
      row.organization_id === config.organizationId
    );
    if (memberships.length !== 1) {
      throw new Error(
        memberships.length === 0
          ? "Aucune appartenance active à Soritech Innov Business n'a été trouvée pour ce compte."
          : "Plusieurs appartenances actives correspondent à cette organisation. Vérifiez les adhésions."
      );
    }
    return memberships[0];
  }

  function isAdminRole(role) {
    return ["admin", "administrateur", "super_admin", "super admin"]
      .includes(String(role || "").trim().toLocaleLowerCase("fr"));
  }

  async function signIn(email, password) {
    if (!client) throw new Error("Connexion centrale non configurée. Renseignez l'URL et la clé publique dans supabase-config.js.");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Query the database sequentially to avoid bursting PostgREST immediately
    // after authentication. Preserve the valid Auth session during transient
    // Data API outages (PGRST002/PGRST003/HTTP 503) so a retry can recover.
    let membership;
    try {
      membership = await getMembership(data.user.id);
    } catch (membershipError) {
      if (isTransientDataApiError(membershipError)) {
        throw new Error("Connexion acceptée par Supabase, mais son API de données est temporairement indisponible (erreur réseau ou serveur). La session est conservée : réessayez dans quelques instants. Aucun changement de mot de passe n'est nécessaire.");
      }
      try { await client.auth.signOut(); } catch (signOutError) {
        console.warn("SIB: sign-out after failed membership check did not complete:", signOutError);
      }
      const message = String(membershipError?.message || "");
      if (/membership|appartenance|organisation|organization/i.test(message)) {
        throw new Error("Mot de passe accepté, mais ce compte n'a pas d'appartenance active à Soritech Innov Business. Exécutez supabase/05_fix_admin_membership.sql dans le SQL Editor Supabase, puis reconnectez-vous.");
      }
      throw membershipError;
    }

    // The shared JSON contains cross-module finance and HR data without
    // module-level RLS. Only administrator roles may load it. Other active
    // members receive a restricted workspace and use their own profile plus
    // role-scoped communication features until their business modules are
    // backed by dedicated relational tables and policies.
    let appState = null;
    if (isAdminRole(membership.role)) {
      try {
        appState = await loadAppState();
      } catch (stateError) {
        if (isTransientDataApiError(stateError)) {
          throw new Error("Connexion acceptée par Supabase, mais le chargement des données centrales est temporairement indisponible (PGRST002/PGRST003). La session est conservée pour éviter une déconnexion automatique. Réessayez dans quelques instants.");
        }
        try { await client.auth.signOut(); } catch (signOutError) {
          console.warn("SIB: sign-out after failed state load did not complete:", signOutError);
        }
        throw stateError;
      }
      if (appState?.state) {
        try { await syncCoreCollections(appState.state); }
        catch (syncError) {
          relationalSyncError = String(syncError?.message || syncError);
          console.error("SIB relational sync on sign-in failed:", syncError);
        }
      }
    }
    try {
      const savedProfile = await loadUserProfile();
      if (savedProfile) {
        appState = appState || { state: {}, version: null, updatedAt: null };
        appState.state = appState.state || {};
        appState.state.profile = {
          pn: savedProfile.first_name,
          nm: savedProfile.last_name,
          nom: savedProfile.full_name,
          tel: savedProfile.phone,
          ph: savedProfile.avatar_data_url || ""
        };
      }
    } catch (profileError) {
      console.warn("Profil dédié indisponible ; vérifiez la migration 08 :", profileError);
    }
    return { user: data.user, membership, appState };
  }

  async function signOut() {
    if (!client) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  async function currentUser() {
    const session = await requireSession();
    const membership = await getMembership(session.user.id);
    return { user: session.user, membership, session };
  }

  async function query(table) {
    await requireSession();
    if (!/^[a-z][a-z0-9_]*$/.test(table)) throw new Error("Nom de table invalide.");
    return client.from(table);
  }

  let appStateVersion = null;

  async function loadAppState() {
    await requireSession();
    const { data, error } = await client
      .from("sib_app_state")
      .select("state, version, updated_at")
      .eq("organization_id", config.organizationId)
      .maybeSingle();
    if (error) throw error;
    appStateVersion = data ? Number(data.version) : null;
    return data ? { state: data.state, version: appStateVersion, updatedAt: data.updated_at } : null;
  }


  let relationalSyncError = "";
  async function syncCoreCollections(state) {
    await requireSession();
    if (!state || typeof state !== "object") return { clients: 0, services: 0 };
    const org = config.organizationId;
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError) throw authError;
    const userId = authData?.user?.id || null;
    const clients = (Array.isArray(state.c) ? state.c : []).filter(x => x && x.id != null && String(x.n || "").trim()).map(x => ({
      organization_id: org,
      legacy_id: String(x.id),
      client_code: String(x.code || x.no || "").trim() || null,
      name: String(x.n || "").trim(),
      client_type: (() => { const type = String(x.type || "").trim().toLocaleLowerCase("fr"); return type === "particulier" ? "Particulier" : type === "établissement scolaire" || type === "etablissement_scolaire" ? "Établissement scolaire" : type === "autre" ? "Autre" : "Entreprise"; })(),
      phone: String(x.t || x.tel || x.phone || ""),
      email: String(x.mail || x.email || ""),
      address: String(x.a || x.adr || x.address || ""),
      tax_id: String(x.nif || x.tax_id || ""),
      notes: String(x.notes || ""),
      active: x.active !== false && x.actif !== false,
      created_by: userId
    }));
    const services = (Array.isArray(state.sv) ? state.sv : []).filter(x => x && x.id != null && String(x.n || "").trim()).map(x => ({
      organization_id: org,
      legacy_id: String(x.id),
      service_code: String(x.code || x.no || "").trim() || null,
      name: String(x.n || "").trim(),
      description: String(x.description || x.desc || ""),
      category: String(x.category || x.cat || ""),
      unit: String(x.unit || "unité"),
      unit_price: Math.max(0, Number(x.p || x.price || 0) || 0),
      currency: "GNF",
      active: x.active !== false
    }));

    // service_code is unique per organization, but legacy IDs are the stable
    // upsert key. Preserve every service row while making optional codes safe:
    // keep the first incoming owner of a duplicated code and null out later
    // duplicates; also avoid claiming a code already owned by another legacy row.
    if (services.length) {
      const { data: existingServices, error: existingServicesError } = await client
        .from("sib_services")
        .select("legacy_id,service_code")
        .eq("organization_id", org);
      if (existingServicesError) throw existingServicesError;
      const existingCodeOwners = new Map();
      (existingServices || []).forEach(row => {
        const code = String(row.service_code || "").trim();
        if (code) existingCodeOwners.set(code, String(row.legacy_id || ""));
      });
      const incomingCodeOwners = new Set();
      services.forEach(row => {
        const code = String(row.service_code || "").trim();
        if (!code) { row.service_code = null; return; }
        const owner = existingCodeOwners.get(code);
        const alreadySeen = incomingCodeOwners.has(code);
        if (alreadySeen || (owner && owner !== row.legacy_id)) {
          row.service_code = null;
          return;
        }
        incomingCodeOwners.add(code);
      });
    }

    if (clients.length) {
      const { error } = await client.from("sib_clients").upsert(clients, { onConflict: "organization_id,legacy_id" });
      if (error) throw error;
    }
    if (services.length) {
      const { error } = await client.from("sib_services").upsert(services, { onConflict: "organization_id,legacy_id" });
      if (error) throw error;
    }
    relationalSyncError = "";
    return { clients: clients.length, services: services.length };
  }

  async function saveUserProfile(profile) {
    await requireSession();
    const session = await client.auth.getSession();
    if (session.error) throw session.error;
    const userId = session.data.session.user.id;
    const row = {
      user_id: userId,
      organization_id: config.organizationId,
      first_name: String(profile.pn || "").trim(),
      last_name: String(profile.nm || "").trim(),
      full_name: String(profile.nom || "").trim(),
      phone: String(profile.tel || "").trim(),
      avatar_data_url: String(profile.ph || "")
    };
    const result = await client.from("sib_user_profiles").upsert(row, { onConflict: "user_id" });
    if (result.error) throw result.error;
    return true;
  }

  async function loadUserProfile() {
    await requireSession();
    const session = await client.auth.getSession();
    if (session.error) throw session.error;
    const result = await client.from("sib_user_profiles")
      .select("first_name,last_name,full_name,phone,avatar_data_url")
      .eq("user_id", session.data.session.user.id)
      .eq("organization_id", config.organizationId)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function saveAppState(state) {
    await requireSession();
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error("État applicatif invalide.");
    }
    if (state.profile && typeof state.profile === "object") {
      await saveUserProfile(state.profile);
    }
    const { data, error } = await client.rpc("sib_save_app_state", {
      p_organization_id: config.organizationId,
      p_state: state,
      p_expected_version: appStateVersion
    });
    if (error) throw error;
    appStateVersion = Number(data);
    // Best-effort relational mirror for Clients and Services; the canonical state
    // save remains successful if the relational API is temporarily unavailable.
    try { await syncCoreCollections(state); }
    catch (syncError) {
      relationalSyncError = String(syncError?.message || syncError);
      console.error("SIB relational sync (clients/services) failed:", syncError);
    }
    return appStateVersion;
  }

  function subscribeAppState(onChange) {
    if (!client) throw new Error("Supabase n'est pas configuré.");
    return client.channel("sib-app-state-" + config.organizationId)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "sib_app_state",
        filter: "organization_id=eq." + config.organizationId
      }, payload => {
        if (typeof onChange === "function") onChange(payload);
      })
      .subscribe();
  }

  async function inviteUser(email, fullName, role) {
    await requireSession();
    if (!client) throw new Error("Supabase n'est pas configuré.");
    const { data, error } = await client.functions.invoke("sib-invite-user", { body: { email, full_name: fullName, role } });
    if (error) {
      let detail = data?.error || "";
      if (!detail && error.context && typeof error.context.clone === "function") { try { const body = await error.context.clone().json(); detail = body?.error || body?.message || ""; } catch (_) {} }
      throw new Error("Invitation e-mail impossible : " + (detail || error.message || "Erreur inconnue"));
    }
    if (!data?.ok) throw new Error(data?.error || "Le service d'invitation n'a pas confirmé l'envoi.");
    return data;
  }

  async function listUsers() {
    await requireSession();
    const { data, error } = await client.functions.invoke("sib-invite-user", { body: { action: "list" } });
    if (error) {
      let detail = data?.error || "";
      if (!detail && error.context && typeof error.context.clone === "function") { try { const body = await error.context.clone().json(); detail = body?.error || body?.message || ""; } catch (_) {} }
      throw new Error(detail || error.message || "Impossible de charger les utilisateurs.");
    }
    if (!data?.ok || !Array.isArray(data.users)) throw new Error(data?.error || "Réponse invalide du service utilisateurs.");
    return data.users;
  }

  async function deactivateUser(userId) {
    await requireSession();
    if (!client) throw new Error("Supabase n'est pas configuré.");
    const { data, error } = await client.functions.invoke("sib-invite-user", {
      body: { action: "deactivate", user_id: userId }
    });
    if (error) {
      let detail = data?.error || "";
      if (!detail && error.context && typeof error.context.clone === "function") {
        try { const body = await error.context.clone().json(); detail = body?.error || body?.message || ""; } catch (_) {}
      }
      throw new Error(detail || error.message || "Impossible de désactiver l'utilisateur.");
    }
    if (!data?.ok) throw new Error(data?.error || "La désactivation n'a pas été confirmée.");
    return data;
  }

  async function setUserActive(userId, active) {
    await requireSession();
    if (!client) throw new Error("Supabase n'est pas configuré.");
    const action = active ? "reactivate" : "deactivate";
    const { data, error } = await client.functions.invoke("sib-invite-user", {
      body: { action, user_id: userId }
    });
    if (error) {
      let detail = data?.error || "";
      if (!detail && error.context && typeof error.context.clone === "function") {
        try { const body = await error.context.clone().json(); detail = body?.error || body?.message || ""; } catch (_) {}
      }
      throw new Error(detail || error.message || (active ? "Impossible de réactiver l'utilisateur." : "Impossible de désactiver l'utilisateur."));
    }
    if (!data?.ok) throw new Error(data?.error || "Le changement d'accès n'a pas été confirmé.");
    return data;
  }

  async function signUpFirstAdmin(email, password, fullName) {
    if (!client) throw new Error("Supabase n'est pas configuré.");
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || "" } }
    });
    if (error) throw error;
    if (!data.session || !data.user) {
      throw new Error("Compte créé, mais Supabase exige une confirmation par e-mail avant l'activation. Confirmez l'e-mail, puis revenez vous connecter.");
    }
    try {
      const { error: bootstrapError } = await client.rpc("sib_bootstrap_first_admin", {
        p_organization_id: config.organizationId,
        p_full_name: fullName || ""
      });
      if (bootstrapError) throw new Error(bootstrapError.message || "Impossible d'activer le premier administrateur.");
      const membership = await getMembership(data.user.id);
      return { user: data.user, membership };
    } catch (setupError) {
      // A partially completed bootstrap must not leave the browser authenticated
      // as a user who has no verified SIB organization membership.
      try { await client.auth.signOut(); } catch (signOutError) {
        console.warn("SIB: sign-out after failed first-admin setup did not complete:", signOutError);
      }
      throw setupError;
    }
  }

  window.SIBCloud = Object.freeze({
    ready,
    config: Object.freeze({
      organizationId: config.organizationId || "",
      organizationName: config.organizationName || "Soritech Innov Business"
    }),
    client: () => client,
    signIn,
    signUpFirstAdmin,
    inviteUser,
    listUsers,
    deactivateUser,
    setUserActive,
    signOut,
    currentUser,
    getMembership,
    isAdminRole,
    requireSession,
    query,
    loadAppState,
    saveAppState,
    saveUserProfile,
    loadUserProfile,
    syncCoreCollections,
    get relationalSyncError() { return relationalSyncError; },
    subscribeAppState,
    get appStateVersion() { return appStateVersion; }
  });
})();
