import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = new URL("../supabase/migrations/20261026020000_role_scoped_module_access.sql", import.meta.url);
const sql = readFileSync(path, "utf8");

assert.match(sql, /^-- Role-scoped access/m);
assert.match(sql, /\bbegin\s*;/i);
assert.match(sql, /\bcommit\s*;/i);
assert.doesNotMatch(sql, /\bdrop\s+(table|schema|database)\b/i, "Migration must not drop tables or data.");
assert.match(sql, /create or replace function public\.sib_has_active_role/i);
assert.match(sql, /security invoker/i);
assert.match(sql, /revoke all on function public\.sib_has_active_role\(uuid, text\[\]\) from public, anon/i);

const requiredPolicies = [
  "organizations_read_active_membership",
  "sib_clients_admin_direction_commercial_all",
  "sib_documents_role_scoped_all",
  "sib_payments_finance_all",
  "sib_expenses_finance_all",
  "sib_financial_accounts_finance_all",
  "sib_leaves_hr_direction_admin_all",
  "sib_leaves_read_self",
  "sib_leaves_insert_self",
  "sib_payroll_items_hr_admin_direction_all",
  "sib_payroll_items_accounting_read",
  "sib_payroll_items_read_self",
  "sib_payroll_periods_hr_admin_direction_all",
  "sib_projects_admin_direction_technical_all",
  "sib_projects_commercial_read_assigned",
  "sib_project_tasks_admin_direction_technical_all",
  "sib_stock_categories_inventory_all",
  "sib_stock_categories_commercial_read",
  "sib_stock_items_inventory_all",
  "sib_stock_movements_inventory_all",
  "sib_students_training_staff_all",
  "sib_trainings_training_staff_all",
  "sib_training_enrollments_training_staff_all",
  "sib_training_enrollments_accounting_read",
];

for (const policy of requiredPolicies) {
  assert.match(sql, new RegExp(`create policy ${policy}\\b`, "i"), `Missing policy: ${policy}`);
}

const broadPolicies = [
  "sib_leaves_org_member_all",
  "sib_payroll_items_org_member_all",
  "sib_payroll_periods_org_member_all",
  "sib_projects_org_member_all",
  "sib_project_tasks_org_member_all",
  "sib_stock_categories_org_member_all",
  "sib_stock_items_org_member_all",
  "sib_stock_movements_org_member_all",
  "sib_students_org_member_all",
  "sib_trainings_org_member_all",
  "sib_training_enrollments_org_member_all",
];

for (const policy of broadPolicies) {
  assert.match(sql, new RegExp(`drop policy if exists ${policy}\\b`, "i"), `Must remove broad policy: ${policy}`);
}

console.log(`Role-scoped module access migration checks passed (${requiredPolicies.length} policies verified).`);
