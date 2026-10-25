import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/06_secure_shared_app_state.sql", "utf8");
assert.match(migration, /create policy sib_app_state_admin_read/i);
assert.match(migration, /drop policy if exists sib_app_state_member_read/i);
assert.match(migration, /lower\(trim\(m\.role\)\) in \('admin', 'administrateur', 'super_admin', 'super admin'\)/i);
assert.match(migration, /seuls les administrateurs actifs peuvent modifier/i);
assert.match(migration, /revoke all on function public\.sib_save_app_state\(uuid, jsonb, integer\) from public, anon/i);
assert.match(migration, /grant execute on function public\.sib_save_app_state\(uuid, jsonb, integer\) to authenticated/i);
assert.match(migration, /version = p_expected_version/i);
assert.match(migration, /errcode = '42501'/i);
assert.doesNotMatch(migration, /drop table|truncate table|delete from public\.sib_app_state/i);

console.log("Shared app-state authorization regression tests passed (9 assertions).");
