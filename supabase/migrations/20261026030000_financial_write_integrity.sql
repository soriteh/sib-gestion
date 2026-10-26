-- Protect accounting records from destructive deletes and constrain updates.
-- Corrections to posted financial operations should be handled through reversal
-- entries in the application workflow, not by deleting history.
begin;

-- Documents: commercial and accounting can read; commercial creates/updates
-- documents, while only leadership can remove a draft document.
drop policy if exists sib_documents_role_scoped_all on public.sib_documents;
drop policy if exists sib_documents_read_roles on public.sib_documents;
create policy sib_documents_read_roles
on public.sib_documents for select to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial','comptable']));
drop policy if exists sib_documents_insert_roles on public.sib_documents;
create policy sib_documents_insert_roles
on public.sib_documents for insert to authenticated
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']));
drop policy if exists sib_documents_update_roles on public.sib_documents;
create policy sib_documents_update_roles
on public.sib_documents for update to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']));
drop policy if exists sib_documents_delete_drafts_leadership on public.sib_documents;
create policy sib_documents_delete_drafts_leadership
on public.sib_documents for delete to authenticated
using (
  public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction'])
  and lower(trim(status)) = any(array['draft','brouillon'])
);

-- Lines follow the parent document lifecycle; only leadership can delete lines
-- and only while the parent document is still a draft.
drop policy if exists sib_document_lines_role_scoped_all on public.sib_document_lines;
drop policy if exists sib_document_lines_read_roles on public.sib_document_lines;
create policy sib_document_lines_read_roles
on public.sib_document_lines for select to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial','comptable']));
drop policy if exists sib_document_lines_insert_roles on public.sib_document_lines;
create policy sib_document_lines_insert_roles
on public.sib_document_lines for insert to authenticated
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']));
drop policy if exists sib_document_lines_update_roles on public.sib_document_lines;
create policy sib_document_lines_update_roles
on public.sib_document_lines for update to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']));
drop policy if exists sib_document_lines_delete_draft_leadership on public.sib_document_lines;
create policy sib_document_lines_delete_draft_leadership
on public.sib_document_lines for delete to authenticated
using (
  public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction'])
  and exists (
    select 1 from public.sib_documents d
    where d.id = sib_document_lines.document_id
      and d.organization_id = sib_document_lines.organization_id
      and lower(trim(d.status)) = any(array['draft','brouillon'])
  )
);

-- Payments are append-oriented: no UPDATE or DELETE for cashiers; leadership
-- and accounting can update an entry when a controlled workflow requires it.
drop policy if exists sib_payments_finance_all on public.sib_payments;
drop policy if exists sib_payments_read_finance_roles on public.sib_payments;
create policy sib_payments_read_finance_roles
on public.sib_payments for select to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']));
drop policy if exists sib_payments_insert_finance_roles on public.sib_payments;
create policy sib_payments_insert_finance_roles
on public.sib_payments for insert to authenticated
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']));
drop policy if exists sib_payments_update_leadership_accounting on public.sib_payments;
create policy sib_payments_update_leadership_accounting
on public.sib_payments for update to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable']));

-- Expenses: no deletes; cash desk can register but only leadership/accounting
-- can update an existing expense.
drop policy if exists sib_expenses_finance_all on public.sib_expenses;
drop policy if exists sib_expenses_read_finance_roles on public.sib_expenses;
create policy sib_expenses_read_finance_roles
on public.sib_expenses for select to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']));
drop policy if exists sib_expenses_insert_finance_roles on public.sib_expenses;
create policy sib_expenses_insert_finance_roles
on public.sib_expenses for insert to authenticated
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']));
drop policy if exists sib_expenses_update_leadership_accounting on public.sib_expenses;
create policy sib_expenses_update_leadership_accounting
on public.sib_expenses for update to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable']));

-- Financial accounts cannot be deleted through the Data API; this avoids
-- breaking historical references from payments and expenses.
drop policy if exists sib_financial_accounts_finance_all on public.sib_financial_accounts;
drop policy if exists sib_financial_accounts_read_finance_roles on public.sib_financial_accounts;
create policy sib_financial_accounts_read_finance_roles
on public.sib_financial_accounts for select to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']));
drop policy if exists sib_financial_accounts_insert_finance_roles on public.sib_financial_accounts;
create policy sib_financial_accounts_insert_finance_roles
on public.sib_financial_accounts for insert to authenticated
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable']));
drop policy if exists sib_financial_accounts_update_finance_roles on public.sib_financial_accounts;
create policy sib_financial_accounts_update_finance_roles
on public.sib_financial_accounts for update to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable']));

-- HR can process leave records but not erase history. Employees retain only
-- their own SELECT and pending-request INSERT policies from the prior migration.
drop policy if exists sib_leaves_hr_direction_admin_all on public.sib_leaves;
drop policy if exists sib_leaves_hr_direction_admin_read on public.sib_leaves;
create policy sib_leaves_hr_direction_admin_read
on public.sib_leaves for select to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_leaves_hr_direction_admin_insert on public.sib_leaves;
create policy sib_leaves_hr_direction_admin_insert
on public.sib_leaves for insert to authenticated
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_leaves_hr_direction_admin_update on public.sib_leaves;
create policy sib_leaves_hr_direction_admin_update
on public.sib_leaves for update to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));

-- Payroll history is not deletable. Leadership/HR manage; accounting is
-- read-only and an employee can read their own payslip.
drop policy if exists sib_payroll_items_hr_admin_direction_all on public.sib_payroll_items;
drop policy if exists sib_payroll_items_hr_admin_direction_read on public.sib_payroll_items;
create policy sib_payroll_items_hr_admin_direction_read
on public.sib_payroll_items for select to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_payroll_items_hr_admin_direction_insert on public.sib_payroll_items;
create policy sib_payroll_items_hr_admin_direction_insert
on public.sib_payroll_items for insert to authenticated
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_payroll_items_hr_admin_direction_update on public.sib_payroll_items;
create policy sib_payroll_items_hr_admin_direction_update
on public.sib_payroll_items for update to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));

drop policy if exists sib_payroll_periods_hr_admin_direction_all on public.sib_payroll_periods;
drop policy if exists sib_payroll_periods_hr_admin_direction_read on public.sib_payroll_periods;
create policy sib_payroll_periods_hr_admin_direction_read
on public.sib_payroll_periods for select to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_payroll_periods_hr_admin_direction_insert on public.sib_payroll_periods;
create policy sib_payroll_periods_hr_admin_direction_insert
on public.sib_payroll_periods for insert to authenticated
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_payroll_periods_hr_admin_direction_update on public.sib_payroll_periods;
create policy sib_payroll_periods_hr_admin_direction_update
on public.sib_payroll_periods for update to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));

commit;
