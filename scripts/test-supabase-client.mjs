import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";

const clientSource = readFileSync(resolve("supabase-client.js"), "utf8");

function makeHarness({ membershipError = null, stateError = null, bootstrapError = null, upsertError = null, role = "admin", existingServices = [] } = {}) {
  let signOutCalls = 0;
  const upsertCalls = [];
  const auth = {
    signInWithPassword: async () => ({
      data: { user: { id: "user-1", email: "admin@example.test" } },
      error: null
    }),
    signUp: async () => ({
      data: { user: { id: "user-1", email: "admin@example.test" }, session: { user: { id: "user-1" } } },
      error: null
    }),
    getSession: async () => ({
      data: { session: { user: { id: "user-1" } } },
      error: null
    }),
    getUser: async () => ({
      data: { user: { id: "user-1", email: "admin@example.test" } },
      error: null
    }),
    signOut: async () => {
      signOutCalls += 1;
      return { error: null };
    }
  };

  function queryFor(table) {
    const query = {
      select() { return this; },
      eq() { return this; },
      upsert: async (rows, options) => {
        if (!Array.isArray(rows)) throw new Error("Upsert rows must be an array");
        upsertCalls.push({ table, rows, options });
        return { error: upsertError };
      },
      maybeSingle: async () => {
        if (table === "sib_app_state") {
          if (stateError) return { data: null, error: stateError };
          return { data: { state: {}, version: 1, updated_at: "2026-01-01T00:00:00Z" }, error: null };
        }
        throw new Error("Unexpected maybeSingle query: " + table);
      },
      then(resolve, reject) {
        if (table === "sib_services") {
          return Promise.resolve({ data: existingServices, error: null }).then(resolve, reject);
        }
        if (table !== "organization_memberships") {
          return Promise.reject(new Error("Unexpected awaited query: " + table)).then(resolve, reject);
        }
        if (membershipError) return Promise.reject(membershipError).then(resolve, reject);
        return Promise.resolve({
          data: [{ role, active: true, organization_id: "org-1", organizations: { name: "SIB" } }],
          error: null
        }).then(resolve, reject);
      }
    };
    return query;
  }

  const window = {
    SIB_SUPABASE_CONFIG: {
      url: "https://example-project.supabase.co",
      publishableKey: "test-publishable-key",
      organizationId: "org-1",
      organizationName: "SIB"
    },
    supabase: {
      createClient: () => ({
        auth,
        from: queryFor,
        rpc: async (name) => {
          if (name === "sib_bootstrap_first_admin") return { error: bootstrapError };
          if (name === "sib_save_app_state") return { data: 2, error: null };
          return { data: null, error: null };
        }
      })
    }
  };

  vm.runInNewContext(clientSource, { window, console, Promise, String, Number, Error });
  return { cloud: window.SIBCloud, upsertCalls, get signOutCalls() { return signOutCalls; } };
}

{
  const h = makeHarness({ role: "Caissier" });
  await assert.rejects(
    () => h.cloud.signIn("admin@example.test", "password"),
    (error) => /accès métier.*rôle/i.test(error?.message || "") && /données partagées sont protégées/i.test(error?.message || "")
  );
  assert.equal(h.signOutCalls, 1, "limited roles must not keep an authenticated session without role-scoped data access");
}

{
  const h = makeHarness({ stateError: { message: "state unavailable" } });
  await assert.rejects(() => h.cloud.signIn("admin@example.test", "password"), (error) => error?.message === "state unavailable");
  assert.equal(h.signOutCalls, 1, "failed state loading must close the Auth session");
}

{
  const h = makeHarness({ membershipError: { message: "membership unavailable" } });
  await assert.rejects(() => h.cloud.signIn("admin@example.test", "password"), (error) => /appartenance active/.test(error?.message || ""));
  assert.equal(h.signOutCalls, 1, "failed membership validation must close the Auth session");
}

{
  const h = makeHarness({ bootstrapError: { message: "bootstrap denied" } });
  await assert.rejects(() => h.cloud.signUpFirstAdmin("admin@example.test", "password", "Admin SIB"), (error) => error?.message === "bootstrap denied");
  assert.equal(h.signOutCalls, 1, "failed first-admin bootstrap must close the Auth session");
}

{
  const h = makeHarness({ membershipError: { code: "PGRST003", message: "Timed out acquiring connection from connection pool." } });
  await assert.rejects(
    () => h.cloud.signIn("admin@example.test", "password"),
    (error) => /API de données est temporairement indisponible/.test(error?.message || "")
  );
  assert.equal(h.signOutCalls, 0, "transient membership API outage must preserve the Auth session");
}

{
  const h = makeHarness({ stateError: { code: "PGRST002", message: "Could not query the database for the schema cache. Retrying." } });
  await assert.rejects(
    () => h.cloud.signIn("admin@example.test", "password"),
    (error) => /chargement des données centrales est temporairement indisponible/.test(error?.message || "")
  );
  assert.equal(h.signOutCalls, 0, "transient app-state API outage must preserve the Auth session");
}

{
  const h = makeHarness({
    existingServices: [{ legacy_id: "old-service", service_code: "DUP-1" }]
  });
  await h.cloud.signIn("admin@example.test", "password");
  const sync = await h.cloud.syncCoreCollections({
    c: [],
    sv: [
      { id: "new-1", n: "Service code déjà utilisé", code: "DUP-1" },
      { id: "new-2", n: "Premier code répété", code: "DUP-2" },
      { id: "new-3", n: "Deuxième code répété", code: "DUP-2" },
      { id: "new-4", n: "Service sans code", code: "   " }
    ]
  });
  assert.equal(sync.services, 4, "duplicate codes must not discard service rows");
  const rows = h.upsertCalls.find(call => call.table === "sib_services").rows;
  assert.deepEqual(rows.map(row => row.service_code), [null, "DUP-2", null, null],
    "conflicting or duplicate optional codes must be nulled without dropping services");
}

{
  const h = makeHarness();
  await h.cloud.signIn("admin@example.test", "password");
  const sync = await h.cloud.syncCoreCollections({
    c: [
      { id: 10, n: "Client test", type: "Particulier", t: "+224600000000", mail: "client@example.test", p: 99 },
      { id: 12, n: "École test", type: "Établissement scolaire" },
      null,
      { id: 11, n: "   " }
    ],
    sv: [
      { id: "srv-1", n: "Maintenance PC", p: 250000 },
      { id: "srv-2", n: "   " }
    ]
  });
  assert.equal(sync.clients, 2);
  assert.equal(sync.services, 1);
  assert.equal(h.upsertCalls.length, 2, "clients and services should each be upserted");
  const clientRows = h.upsertCalls.find(call => call.table === "sib_clients").rows;
  assert.equal(clientRows.length, 2);
  assert.equal(clientRows[0].legacy_id, "10");
  assert.equal(clientRows[0].name, "Client test");
  assert.equal(clientRows[0].client_type, "Particulier", "client types must match the live Supabase check constraint");
  assert.equal(clientRows[1].client_type, "Établissement scolaire", "school client type must preserve the database enum label");
  assert.equal(clientRows[0].client_code, null, "blank optional client codes must not collide on the organization/code unique key");
  assert.equal(clientRows[0].created_by, "user-1");
  const serviceRows = h.upsertCalls.find(call => call.table === "sib_services").rows;
  assert.equal(serviceRows.length, 1);
  assert.equal(serviceRows[0].legacy_id, "srv-1");
  assert.equal(serviceRows[0].currency, "GNF");
  assert.equal(serviceRows[0].service_code, null, "blank optional service codes must not collide on the organization/code unique key");
  assert.equal(serviceRows[0].unit_price, 250000);
  assert.equal(h.upsertCalls.every(call => call.options.onConflict === "organization_id,legacy_id"), true);
}

{
  const h = makeHarness();
  await h.cloud.signIn("admin@example.test", "password");
  const sync = await h.cloud.syncCoreCollections({ c: [], sv: [] });
  assert.equal(sync.clients, 0);
  assert.equal(sync.services, 0);
  assert.equal(h.upsertCalls.length, 0, "empty collections must not write or delete records");
}

{
  const h = makeHarness({ upsertError: { message: "relation mirror temporarily unavailable" } });
  await h.cloud.signIn("admin@example.test", "password");
  const version = await h.cloud.saveAppState({
    c: [{ id: "client-1", n: "Client conservé" }],
    sv: []
  });
  assert.equal(version, 2, "successful canonical JSON save should return the server version");
  assert.match(h.cloud.relationalSyncError, /relation mirror temporarily unavailable/);
  assert.equal(h.signOutCalls, 0, "a mirror failure must not sign the user out");
}

console.log("Supabase authentication and core relational sync tests passed (9 cases).");
