import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20261106220051_move_security_definer_helpers_private.sql",
  "utf8"
);
const names = [
  "sib_internal_can_add_conversation_member",
  "sib_internal_can_manage_conversation",
  "sib_internal_can_read_conversation",
  "sib_internal_can_read_conversation_members",
  "sib_internal_can_read_conversation_row",
  "sib_internal_is_admin",
  "sib_internal_is_member",
  "sib_is_org_member",
  "sib_is_site_admin"
];
for (const name of names) {
  assert.ok(sql.includes("alter function public." + name + "("),
    "Expected private move for " + name);
  assert.ok(sql.includes("create function public." + name + "("),
    "Expected compatibility wrapper for " + name);
  assert.ok(sql.includes("grant execute on function private." + name + "("),
    "Expected private helper grant for " + name);
  assert.ok(sql.includes("grant execute on function public." + name + "("),
    "Expected authenticated compatibility wrapper grant for " + name);
}
assert.equal((sql.match(/language sql stable security invoker/gi) || []).length, 9,
  "Every public compatibility wrapper must be SECURITY INVOKER");
assert.ok(sql.includes("revoke all on schema private from public, anon"));
assert.ok(sql.includes("grant usage on schema private to authenticated, service_role"));
assert.ok(sql.includes("revoke all on table public.sib_site_admins from public, anon, authenticated"));
assert.ok(sql.toLowerCase().includes("begin;") && sql.toLowerCase().includes("commit;"));
for (const forbidden of ["drop table", "drop schema", "drop database", "truncate ", "delete from"]) {
  assert.equal(sql.toLowerCase().includes(forbidden), false,
    "Private helper migration must not remove application data: " + forbidden);
}

console.log("Private SECURITY DEFINER helper migration checks passed.");
