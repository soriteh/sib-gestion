import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  "supabase/migrations/20261026010000_role_scoped_sensitive_data_policies.sql",
  "utf8"
);

assert.match(migration, /drop policy if exists sib_user_profiles_org_member_all/i);
assert.match(migration, /create policy sib_user_profiles_select_self[\s\S]*user_id = \(select auth\.uid\(\)\)/i);
assert.match(migration, /create policy sib_user_profiles_insert_self[\s\S]*user_id = \(select auth\.uid\(\)\)/i);
assert.match(migration, /create policy sib_user_profiles_update_self[\s\S]*user_id = \(select auth\.uid\(\)\)/i);

assert.match(migration, /drop policy if exists sib_employees_org_member_all/i);
assert.match(migration, /create policy sib_employees_admin_hr_direction_all[\s\S]*'direction','rh'/i);
assert.match(migration, /create policy sib_employees_read_self[\s\S]*user_id = \(select auth\.uid\(\)\)/i);

assert.match(migration, /drop policy if exists sib_attendance_org_member_all/i);
assert.match(migration, /create policy sib_attendance_admin_hr_direction_all[\s\S]*'direction','rh'/i);
assert.match(migration, /create policy sib_attendance_read_self[\s\S]*e\.user_id = \(select auth\.uid\(\)\)/i);

assert.match(migration, /drop policy if exists sib_audit_log_org_member_all/i);
assert.match(migration, /create policy sib_audit_log_admin_read/i);
assert.match(migration, /revoke update, delete on public\.sib_audit_log from authenticated/i);
assert.doesNotMatch(migration, /\b(drop table|truncate|delete from)\b/i,
  "The security migration must not remove business data");
assert.match(migration, /begin;[\s\S]*commit;/i);

console.log("Role-scoped profile, HR, attendance and audit access tests passed.");
