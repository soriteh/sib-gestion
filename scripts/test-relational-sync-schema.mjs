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
assert.match(migration, /from public\.organizations o[\s\S]*on conflict \(id\) do update/,
  "The configured existing SIB organization must be bridged into the sib_* foreign-key target");
assert.match(migration, /from public\.organization_memberships m[\s\S]*m\.active = true/,
  "RLS membership checks must use the membership table populated by the current Auth flow");
assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i,
  "Migration must not delete business data");

console.log("Relational sync schema compatibility tests passed.");

const profileMigration = readFileSync("supabase/08_user_profiles.sql", "utf8");
const profileFix = readFileSync("supabase/09_fix_avatar_data_url.sql", "utf8");
assert.match(profileMigration, /create table if not exists public\.sib_user_profiles/);
assert.match(profileMigration, /references auth\.users\(id\)/);
assert.match(profileMigration, /enable row level security/i);
assert.match(profileMigration, /user_id = \(select auth\.uid\(\)\)/);
assert.match(profileFix, /add column if not exists first_name/);
assert.match(profileFix, /add column if not exists last_name/);
assert.match(profileFix, /add column if not exists avatar_data_url/);
assert.match(profileFix, /notify pgrst, 'reload schema'/i);
assert.match(client, /async function saveUserProfile\(profile\)/);
assert.match(client, /from\("sib_user_profiles"\)\.upsert/);
assert.match(client, /await saveUserProfile\(state\.profile\)/);
console.log("Dedicated user profile persistence checks passed.");

const pushMigration = readFileSync("supabase/migrations/20261025013000_push_notification_subscriptions.sql", "utf8");
const serviceWorker = readFileSync("service-worker.js", "utf8");
const app = readFileSync("index.html", "utf8");
assert.match(pushMigration, /create table if not exists public\.sib_push_subscriptions/i);
assert.match(pushMigration, /enable row level security/i);
assert.match(pushMigration, /user_id = \(select auth\.uid\(\)\)/);
assert.match(pushMigration, /unique \(user_id, endpoint\)/i);
assert.match(serviceWorker, /addEventListener\("push"/);
assert.match(serviceWorker, /showNotification/);
assert.match(serviceWorker, /addEventListener\("notificationclick"/);
assert.match(app, /async function enableSibPushNotifications\(\)/);
assert.match(app, /pushManager\.subscribe/);
assert.match(app, /sib_push_subscriptions/);
assert.match(app, /table:"sib_internal_notifications"/);
assert.match(app, /Notification\.permission==="granted"/);
console.log("Notification center, push subscription, and service-worker checks passed.");

const pushDispatcher = readFileSync("supabase/functions/sib-push-send/index.ts", "utf8");
const notificationGuide = readFileSync("docs/NOTIFICATIONS.md", "utf8");
assert.match(pushDispatcher, /VAPID_PRIVATE_KEY/);
assert.match(pushDispatcher, /authorization !== "Bearer " \+ serviceKey/);
assert.match(pushDispatcher, /sib_push_subscriptions/);
assert.match(pushDispatcher, /sendNotification/);
assert.match(pushDispatcher, /status === 404 \|\| status === 410/);
assert.match(notificationGuide, /Database Webhooks/);
assert.match(notificationGuide, /WHATSAPP_ACCESS_TOKEN/);
assert.doesNotMatch(pushDispatcher, /WHATSAPP_ACCESS_TOKEN\s*=\s*["'][^"']+["']/);
console.log("Push dispatcher security and channel configuration checks passed.");
