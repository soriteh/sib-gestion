import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { resolve } from "node:path";

const clientSource = readFileSync(resolve("supabase-client.js"), "utf8");

function makeHarness({ membershipError = null, stateError = null } = {}) {
  let signOutCalls = 0;
  const auth = {
    signInWithPassword: async () => ({
      data: { user: { id: "user-1", email: "admin@example.test" } },
      error: null
    }),
    getSession: async () => ({
      data: { session: { user: { id: "user-1" } } },
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
      maybeSingle: async () => {
        if (table === "sib_app_state") {
          if (stateError) return { data: null, error: stateError };
          return { data: { state: {}, version: 1, updated_at: "2026-01-01T00:00:00Z" }, error: null };
        }
        throw new Error("Unexpected maybeSingle query: " + table);
      },
      then(resolve, reject) {
        if (table !== "organization_memberships") {
          return Promise.reject(new Error("Unexpected awaited query: " + table)).then(resolve, reject);
        }
        if (membershipError) return Promise.reject(membershipError).then(resolve, reject);
        return Promise.resolve({
          data: [{ role: "admin", active: true, organization_id: "org-1", organizations: { name: "SIB" } }],
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
        from: queryFor
      })
    }
  };

  vm.runInNewContext(clientSource, { window, console, Promise, String, Number, Error });
  return { cloud: window.SIBCloud, get signOutCalls() { return signOutCalls; } };
}

{
  const h = makeHarness({ stateError: { message: "state unavailable" } });
  await assert.rejects(() => h.cloud.signIn("admin@example.test", "password"), /state unavailable/);
  assert.equal(h.signOutCalls, 1, "failed state loading must close the Auth session");
}

{
  const h = makeHarness({ membershipError: { message: "membership unavailable" } });
  await assert.rejects(() => h.cloud.signIn("admin@example.test", "password"), /membership unavailable/);
  assert.equal(h.signOutCalls, 1, "failed membership validation must close the Auth session");
}

console.log("Supabase sign-in failure-path tests passed (2 cases).");
