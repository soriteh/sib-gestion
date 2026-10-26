-- Role-scoped access for SIB Gestion relational business modules.
-- Preserves all tables and rows. Existing UI restrictions remain a second layer.
begin;

create or replace function public.sib_has_active_role(p_organization_id uuid, p_allowed_roles text[])
returns boolean
language sql
stable
security invoker
set search_path = ''
as $function$
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role, ''))) = any(p_allowed_roles)
  );
$function$;

revoke all on function public.sib_has_active_role(uuid, text[]) from public, anon;
grant execute on function public.sib_has_active_role(uuid, text[]) to authenticated, service_role;

-- Limit organization metadata to active members of that organization.
drop policy if exists organizations_read_authenticated on public.organizations;
drop policy if exists organizations_read_active_membership on public.organizations;
create policy organizations_read_active_membership
on public.organizations for select to authenticated
using (exists (
  select 1 from public.organization_memberships m
  where m.organization_id = organizations.id
    and m.user_id = (select auth.uid()) and m.active = true
));

-- Client and service catalog: leadership and commercial staff.
drop policy if exists sib_clients_admin_all on public.sib_clients;
drop policy if exists sib_clients_admin_direction_commercial_all on public.sib_clients;
create policy sib_clients_admin_direction_commercial_all
on public.sib_clients for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']));

drop policy if exists sib_services_admin_all on public.sib_services;
drop policy if exists sib_services_admin_direction_commercial_all on public.sib_services;
create policy sib_services_admin_direction_commercial_all
on public.sib_services for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial']));

-- Commercial documents: sales and accounting can manage; finance data remains
-- inaccessible to unrelated roles.
drop policy if exists sib_documents_admin_all on public.sib_documents;
drop policy if exists sib_documents_role_scoped_all on public.sib_documents;
create policy sib_documents_role_scoped_all
on public.sib_documents for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial','comptable']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial','comptable']));

drop policy if exists sib_document_lines_admin_all on public.sib_document_lines;
drop policy if exists sib_document_lines_role_scoped_all on public.sib_document_lines;
create policy sib_document_lines_role_scoped_all
on public.sib_document_lines for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial','comptable']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','commercial','comptable']));

-- Payments and accounts: admin, direction, accounting and cash desk.
drop policy if exists sib_payments_admin_all on public.sib_payments;
drop policy if exists sib_payments_finance_all on public.sib_payments;
create policy sib_payments_finance_all
on public.sib_payments for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']));

drop policy if exists sib_expenses_admin_all on public.sib_expenses;
drop policy if exists sib_expenses_finance_all on public.sib_expenses;
create policy sib_expenses_finance_all
on public.sib_expenses for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']));

drop policy if exists sib_financial_accounts_admin_all on public.sib_financial_accounts;
drop policy if exists sib_financial_accounts_finance_all on public.sib_financial_accounts;
create policy sib_financial_accounts_finance_all
on public.sib_financial_accounts for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','comptable','caissier']));

-- Leave requests: HR/leadership manage; an employee can read and submit their
-- own pending request only when linked to a SIB employee record.
drop policy if exists sib_leaves_org_member_all on public.sib_leaves;
drop policy if exists sib_leaves_hr_direction_admin_all on public.sib_leaves;
create policy sib_leaves_hr_direction_admin_all
on public.sib_leaves for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_leaves_read_self on public.sib_leaves;
create policy sib_leaves_read_self
on public.sib_leaves for select to authenticated
using (exists (
  select 1 from public.sib_employees e
  where e.id = sib_leaves.employee_id
    and e.organization_id = sib_leaves.organization_id
    and e.user_id = (select auth.uid())
));
drop policy if exists sib_leaves_insert_self on public.sib_leaves;
create policy sib_leaves_insert_self
on public.sib_leaves for insert to authenticated
with check (
  status = 'pending' and approved_by is null and approved_at is null
  and exists (
    select 1 from public.sib_employees e
    where e.id = sib_leaves.employee_id
      and e.organization_id = sib_leaves.organization_id
      and e.user_id = (select auth.uid())
      and public.sib_has_active_role(e.organization_id, array['admin','administrateur','super_admin','super admin','direction','rh','comptable','caissier','commercial','technicien','formateur','magasinier','employe','employee'])
  )
);

-- Payroll: leadership/HR manage; accounting is read-only; a linked employee
-- can see only their own payslip and its period metadata.
drop policy if exists sib_payroll_items_org_member_all on public.sib_payroll_items;
drop policy if exists sib_payroll_items_hr_admin_direction_all on public.sib_payroll_items;
create policy sib_payroll_items_hr_admin_direction_all
on public.sib_payroll_items for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_payroll_items_accounting_read on public.sib_payroll_items;
create policy sib_payroll_items_accounting_read
on public.sib_payroll_items for select to authenticated
using (public.sib_has_active_role(organization_id, array['comptable']));
drop policy if exists sib_payroll_items_read_self on public.sib_payroll_items;
create policy sib_payroll_items_read_self
on public.sib_payroll_items for select to authenticated
using (exists (
  select 1 from public.sib_employees e
  where e.id = sib_payroll_items.employee_id
    and e.organization_id = sib_payroll_items.organization_id
    and e.user_id = (select auth.uid())
));

drop policy if exists sib_payroll_periods_org_member_all on public.sib_payroll_periods;
drop policy if exists sib_payroll_periods_hr_admin_direction_all on public.sib_payroll_periods;
create policy sib_payroll_periods_hr_admin_direction_all
on public.sib_payroll_periods for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','rh']));
drop policy if exists sib_payroll_periods_accounting_read on public.sib_payroll_periods;
create policy sib_payroll_periods_accounting_read
on public.sib_payroll_periods for select to authenticated
using (public.sib_has_active_role(organization_id, array['comptable']));
drop policy if exists sib_payroll_periods_read_self on public.sib_payroll_periods;
create policy sib_payroll_periods_read_self
on public.sib_payroll_periods for select to authenticated
using (exists (
  select 1 from public.sib_payroll_items pi
  join public.sib_employees e
    on e.id = pi.employee_id and e.organization_id = pi.organization_id
  where pi.payroll_period_id = sib_payroll_periods.id
    and pi.organization_id = sib_payroll_periods.organization_id
    and e.user_id = (select auth.uid())
));

-- Projects/tasks: leadership and technical staff manage; commercial can read
-- only assigned tasks or projects they manage.
drop policy if exists sib_projects_org_member_all on public.sib_projects;
drop policy if exists sib_projects_admin_direction_technical_all on public.sib_projects;
create policy sib_projects_admin_direction_technical_all
on public.sib_projects for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','technicien']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','technicien']));
drop policy if exists sib_projects_commercial_read_assigned on public.sib_projects;
create policy sib_projects_commercial_read_assigned
on public.sib_projects for select to authenticated
using (manager_user_id = (select auth.uid()) and public.sib_has_active_role(organization_id, array['commercial']));

drop policy if exists sib_project_tasks_org_member_all on public.sib_project_tasks;
drop policy if exists sib_project_tasks_admin_direction_technical_all on public.sib_project_tasks;
create policy sib_project_tasks_admin_direction_technical_all
on public.sib_project_tasks for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','technicien']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','technicien']));
drop policy if exists sib_project_tasks_commercial_read_assigned on public.sib_project_tasks;
create policy sib_project_tasks_commercial_read_assigned
on public.sib_project_tasks for select to authenticated
using (assigned_user_id = (select auth.uid()) and public.sib_has_active_role(organization_id, array['commercial']));

-- Stock: warehouse/technical team manage; commercial can read catalog only.
drop policy if exists sib_stock_categories_org_member_all on public.sib_stock_categories;
drop policy if exists sib_stock_categories_inventory_all on public.sib_stock_categories;
create policy sib_stock_categories_inventory_all
on public.sib_stock_categories for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','magasinier','technicien']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','magasinier','technicien']));
drop policy if exists sib_stock_categories_commercial_read on public.sib_stock_categories;
create policy sib_stock_categories_commercial_read
on public.sib_stock_categories for select to authenticated
using (public.sib_has_active_role(organization_id, array['commercial']));

drop policy if exists sib_stock_items_org_member_all on public.sib_stock_items;
drop policy if exists sib_stock_items_inventory_all on public.sib_stock_items;
create policy sib_stock_items_inventory_all
on public.sib_stock_items for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','magasinier','technicien']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','magasinier','technicien']));
drop policy if exists sib_stock_items_commercial_read on public.sib_stock_items;
create policy sib_stock_items_commercial_read
on public.sib_stock_items for select to authenticated
using (public.sib_has_active_role(organization_id, array['commercial']));

drop policy if exists sib_stock_movements_org_member_all on public.sib_stock_movements;
drop policy if exists sib_stock_movements_inventory_all on public.sib_stock_movements;
create policy sib_stock_movements_inventory_all
on public.sib_stock_movements for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','magasinier','technicien']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','magasinier','technicien']));

-- Training records contain student PII; restrict to leadership/trainers.
drop policy if exists sib_students_org_member_all on public.sib_students;
drop policy if exists sib_students_training_staff_all on public.sib_students;
create policy sib_students_training_staff_all
on public.sib_students for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','formateur']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','formateur']));

drop policy if exists sib_trainings_org_member_all on public.sib_trainings;
drop policy if exists sib_trainings_training_staff_all on public.sib_trainings;
create policy sib_trainings_training_staff_all
on public.sib_trainings for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','formateur']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','formateur']));

drop policy if exists sib_training_enrollments_org_member_all on public.sib_training_enrollments;
drop policy if exists sib_training_enrollments_training_staff_all on public.sib_training_enrollments;
create policy sib_training_enrollments_training_staff_all
on public.sib_training_enrollments for all to authenticated
using (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','formateur']))
with check (public.sib_has_active_role(organization_id, array['admin','administrateur','super_admin','super admin','direction','formateur']));
drop policy if exists sib_training_enrollments_accounting_read on public.sib_training_enrollments;
create policy sib_training_enrollments_accounting_read
on public.sib_training_enrollments for select to authenticated
using (public.sib_has_active_role(organization_id, array['comptable']));

commit;
