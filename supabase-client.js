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
    try {
      const membership = await getMembership(data.user.id);
      return { user: data.user, membership };
    } catch (error) {
      await client.auth.signOut();
      throw error;
    }
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

  window.SIBCloud = Object.freeze({
    ready,
    config: Object.freeze({
      organizationId: config.organizationId || "",
      organizationName: config.organizationName || "Soritech Innov Business"
    }),
    client: () => client,
    signIn,
    signOut,
    currentUser,
    getMembership,
    requireSession,
    query
  });
})();
