import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20261106221000_deny_site_admin_client_access.sql",
  "utf8"
);
assert.ok(sql.includes("revoke all on table public.sib_site_admins from public, anon, authenticated"));
assert.ok(sql.includes("create policy sib_site_admins_deny_client_access"));
assert.ok(sql.includes("to anon, authenticated"));
assert.ok(sql.includes("using (false)"));
assert.ok(sql.includes("with check (false)"));
assert.ok(sql.toLowerCase().includes("begin;") && sql.toLowerCase().includes("commit;"));
for (const forbidden of ["drop table", "drop schema", "truncate ", "delete from"]) {
  assert.equal(sql.toLowerCase().includes(forbidden), false);
}
console.log("Site-admin client denial policy checks passed.");
