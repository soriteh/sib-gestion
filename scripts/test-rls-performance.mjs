import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql = readFileSync(
  "supabase/migrations/20261106010000_optimize_rls_policy_initplans.sql",
  "utf8"
);
const policies = [
  "sib_attendance_checkins_read_self",
  "sib_internal_announcement_reads_read",
  "sib_internal_announcement_reads_write",
  "sib_internal_announcements_admin_insert",
  "sib_internal_members_update_self",
  "sib_internal_conversations_create",
  "sib_internal_messages_read",
  "sib_internal_notifications_read",
  "sib_internal_notifications_update",
  "sib_whatsapp_contacts_manage",
  "sib_whatsapp_logs_read",
  "sib_attendance_select_roles",
  "sib_attendance_insert_roles",
  "sib_attendance_update_roles",
  "sib_attendance_delete_roles",
  "sib_employees_select_roles",
  "sib_employees_insert_roles",
  "sib_employees_update_roles",
  "sib_employees_delete_roles",
  "sib_leaves_select_roles",
  "sib_leaves_insert_roles",
  "sib_payroll_items_select_roles",
  "sib_payroll_periods_select_roles",
  "sib_project_tasks_select_roles",
  "sib_project_tasks_insert_roles",
  "sib_project_tasks_update_roles",
  "sib_project_tasks_delete_roles",
  "sib_projects_select_roles",
  "sib_projects_insert_roles",
  "sib_projects_update_roles",
  "sib_projects_delete_roles",
  "sib_stock_categories_select_roles",
  "sib_stock_categories_insert_roles",
  "sib_stock_categories_update_roles",
  "sib_stock_categories_delete_roles",
  "sib_stock_items_select_roles",
  "sib_stock_items_insert_roles",
  "sib_stock_items_update_roles",
  "sib_stock_items_delete_roles",
  "sib_training_enrollments_select_roles",
  "sib_training_enrollments_insert_roles",
  "sib_training_enrollments_update_roles",
  "sib_training_enrollments_delete_roles"
];
for (const policy of policies) {
  assert.match(sql, new RegExp("create policy " + policy + "\\b", "i"),
    "Expected optimized policy: " + policy);
}
assert.match(sql, /auth\\.uid\\(\\)/i);
assert.match(sql, /\\(select public\\.sib_internal_is_admin\\(/i);
assert.match(sql, /\\(select public\\.sib_internal_is_member\\(/i);
assert.match(sql, /sib_email_logs_actor_user_id_idx/i);
assert.match(sql, /sib_email_logs_organization_id_idx/i);
assert.match(sql, /begin;[\\s\\S]*commit;/i);
assert.doesNotMatch(sql, /\\bdrop\\s+(table|schema|database)\\b|\\btruncate\\b|\\bdelete\\s+from\\b/i,
  "Performance migration must not remove application data or tables");

console.log("RLS performance migration checks passed.");
