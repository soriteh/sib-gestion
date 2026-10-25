import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const client = readFileSync("supabase-client.js", "utf8");
const schema = readFileSync("supabase/01_core_schema.sql", "utf8");
const migration = readFileSync("supabase/07_align_relational_sync.sql", "utf8");

assert.match(client, /onConflict:\s*"organization_id,legacy_id"/,
  "The client must use the documented legacy ID conflict key");
assert.match(schema, /create table if not exists public\.sib_clients/,
  "Core clients table must exist");
assert.match(schema, /create table if not exists public\.sib_services/,
  "Core services table must exist");
for (const column of ["legacy_id", "client_code", "tax_id", "phone", "email", "address"]) {
  assert.match(migration, new RegExp("add column if not exists " + column),
    "Migration must add client sync column " + column);
}
for (const column of ["legacy_id", "service_code", "category", "unit", "currency"]) {
  assert.match(migration, new RegExp("add column if not exists " + column),
    "Migration must add service sync column " + column);
}
assert.match(migration, /unique index if not exists sib_clients_org_legacy_id_uidx/);
assert.match(migration, /unique index if not exists sib_services_org_legacy_id_uidx/);
assert.doesNotMatch(migration, /where legacy_id is not null/i,
  "Upsert conflict indexes must be inferable without a partial-index predicate");
assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i,
  "Migration must not delete business data");

console.log("Relational sync schema compatibility tests passed.");
