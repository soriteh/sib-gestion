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

  async function signIn(email, password) {
    if (!client) throw new Error("Connexion centrale non configurée. Renseignez l'URL et la clé publique dans supabase-config.js.");
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    const [membershipResult, stateResult] = await Promise.allSettled([
      getMembership(data.user.id),
      loadAppState()
    ]);
    if (membershipResult.status === "rejected") {
      await client.auth.signOut();
      const error = membershipResult.reason;
      const message = String(error?.message || "");
      if (/membership|appartenance|organisation|organization/i.test(message)) {
        throw new Error("Mot de passe accepté, mais ce compte n'a pas d'appartenance active à Soritech Innov Business. Exécutez supabase/05_fix_admin_membership.sql dans le SQL Editor Supabase, puis reconnectez-vous.");
      }
      throw error;
    }
    if (stateResult.status === "rejected") {
      // Do not leave a valid Auth session behind when the central application
      // state could not be loaded. The UI treats this as a failed sign-in, so
      // the Supabase session must be closed as well.
      try { await client.auth.signOut(); } catch (signOutError) {
        console.warn("SIB: sign-out after failed state load did not complete:", signOutError);
      }
      throw stateResult.reason;
    }
    return { user: data.user, membership: membershipResult.value, appState: stateResult.value };
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

  async function saveAppState(state) {
    await requireSession();
    if (!state || typeof state !== "object" || Array.isArray(state)) {
      throw new Error("État applicatif invalide.");
    }
    const { data, error } = await client.rpc("sib_save_app_state", {
      p_organization_id: config.organizationId,
      p_state: state,
      p_expected_version: appStateVersion
    });
    if (error) throw error;
    appStateVersion = Number(data);
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
    signOut,
    currentUser,
    getMembership,
    requireSession,
    query,
    loadAppState,
    saveAppState,
    subscribeAppState,
    get appStateVersion() { return appStateVersion; }
  });
})();
