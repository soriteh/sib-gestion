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

    let appState;
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
      client_code: String(x.code || x.no || ""),
      name: String(x.n || "").trim(),
      client_type: ["Particulier", "Entreprise", "Établissement scolaire", "Autre"].includes(x.type) ? x.type : "Entreprise",
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
      service_code: String(x.code || x.no || ""),
      name: String(x.n || "").trim(),
      description: String(x.description || x.desc || ""),
      category: String(x.category || x.cat || ""),
      unit: String(x.unit || "unité"),
      unit_price: Math.max(0, Number(x.p || x.price || 0) || 0),
      currency: "GNF",
      active: x.active !== false
    }));
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

  async function syncTrainingCollections(state) {
    await requireSession();
    const org = config.organizationId;
    const legacyCourses = [];
    (Array.isArray(state?.courses) ? state.courses : []).forEach(c => {
      if (c && c.id != null && String(c.nom || "").trim()) legacyCourses.push({
        organization_id: org, legacy_id: String(c.id), training_code: String(c.id).slice(0, 80),
        title: String(c.nom).trim(), description: "", category: "Formation",
        duration_hours: /^\d+$/.test(String(c.duree || "")) ? Number(c.duree) : null,
        price: Math.max(0, Number(c.prix) || 0), currency: "GNF", trainer_name: null, status: "Planifiée"
      });
    });
    (Array.isArray(state?.sv) ? state.sv : []).forEach(s => {
      if (!s || s.id == null || s.active === false || !/^(Formation|Infographie)/i.test(String(s.n || ""))) return;
      const title = String(s.n).replace(/^(Formation|Infographie)\s*:\s*/i, "").trim();
      if (!title || legacyCourses.some(c => c.title.toLowerCase() === title.toLowerCase())) return;
      legacyCourses.push({ organization_id: org, legacy_id: "service:" + String(s.id), training_code: ("service:" + s.id).slice(0, 80), title, description: "", category: /^Infographie/i.test(String(s.n)) ? "Infographie" : "Formation", duration_hours: null, price: Math.max(0, Number(s.p) || 0), currency: "GNF", trainer_name: null, status: "Planifiée" });
    });
    if (legacyCourses.length) {
      const { error } = await client.from("sib_trainings").upsert(legacyCourses, { onConflict: "organization_id,legacy_id" });
      if (error) throw error;
    }
    const { data: trainings, error: te } = await client.from("sib_trainings").select("id,legacy_id,title").eq("organization_id", org);
    if (te) throw te;
    const byTitle = new Map((trainings || []).map(t => [String(t.title || "").toLowerCase(), t.id]));
    const sourceStudents = (Array.isArray(state?.etudiants) ? state.etudiants : []).filter(s => s && s.id != null && String(s.nom || "").trim());
    const students = sourceStudents.map(s => {
      const parts = String(s.nom).trim().split(/\s+/);
      return { organization_id: org, legacy_id: String(s.id), student_number: String(s.matricule || s.id).slice(0, 100), first_name: parts.shift() || "Apprenant", last_name: parts.join(" ") || "—", phone: String(s.tel || ""), email: String(s.email || ""), status: s.statut === "Abandonné" ? "Inactif" : "Actif" };
    });
    if (students.length) {
      const { error } = await client.from("sib_students").upsert(students, { onConflict: "organization_id,legacy_id" });
      if (error) throw error;
    }
    const { data: savedStudents, error: se } = await client.from("sib_students").select("id,legacy_id").eq("organization_id", org);
    if (se) throw se;
    const studentIds = new Map((savedStudents || []).map(s => [String(s.legacy_id), s.id]));
    const enrollments = sourceStudents.map(s => {
      const title = String(s.formation || "").replace(/^(Formation|Infographie)\s*:\s*/i, "").trim();
      const trainingId = byTitle.get(title.toLowerCase());
      const studentId = studentIds.get(String(s.id));
      if (!trainingId || !studentId) return null;
      const status = s.statut === "Terminé" ? "Réussi" : s.statut === "Abandonné" ? "Abandonné" : s.statut === "En formation" ? "En cours" : "Inscrit";
      return { organization_id: org, legacy_id: String(s.id) + "::" + title, training_id: trainingId, student_id: studentId, enrolled_at: /^\d{4}-\d{2}-\d{2}$/.test(String(s.date || "")) ? s.date : new Date().toISOString().slice(0, 10), agreed_price: Math.max(0, Number(s.montant) || 0), amount_paid: Math.max(0, Math.min(Number(s.montant) || 0, Number(s.paye) || 0)), status, certificate_number: s.certificateNumber || s.attestationNo || null, notes: String(s.notes || "") };
    }).filter(Boolean);
    if (enrollments.length) {
      const { error } = await client.from("sib_training_enrollments").upsert(enrollments, { onConflict: "organization_id,legacy_id" });
      if (error) throw error;
    }
    return { trainings: legacyCourses.length, students: students.length, enrollments: enrollments.length };
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
    // Best-effort relational mirror for Clients and Services; the canonical state
    // save remains successful if the relational API is temporarily unavailable.
    try { await syncCoreCollections(state); await syncTrainingCollections(state); }
    catch (syncError) {
      relationalSyncError = String(syncError?.message || syncError);
      console.error("SIB relational sync (clients/services/trainings) failed:", syncError);
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
    const { data, error } = await client.functions.invoke("sib-invite-user", {
      body: { email, full_name: fullName, role }
    });
    if (error) {
      const detail = data?.error || error.message || "Erreur inconnue";
      throw new Error("Invitation e-mail impossible : " + detail);
    }
    if (!data?.ok) throw new Error(data?.error || "Le service d'invitation n'a pas confirmé l'envoi.");
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
    signOut,
    currentUser,
    getMembership,
    requireSession,
    query,
    loadAppState,
    saveAppState,
    syncCoreCollections,
    get relationalSyncError() { return relationalSyncError; },
    subscribeAppState,
    get appStateVersion() { return appStateVersion; }
  });
})();
