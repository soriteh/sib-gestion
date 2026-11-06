-- SIB Gestion: avoid per-row re-evaluation of auth context in RLS policies.
-- This migration changes policy expressions only; it preserves the existing role
-- boundaries and all rows. It also adds indexes for the two uncovered email-log FKs.
begin;

drop policy if exists sib_attendance_checkins_read_self on public.sib_attendance_checkins;
create policy sib_attendance_checkins_read_self
on public.sib_attendance_checkins
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.sib_internal_is_admin(organization_id))
);

drop policy if exists sib_internal_announcement_reads_read on public.sib_internal_announcement_reads;
create policy sib_internal_announcement_reads_read
on public.sib_internal_announcement_reads
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.sib_internal_announcements a
    where a.id = sib_internal_announcement_reads.announcement_id
      and (select public.sib_internal_is_admin(a.organization_id))
  )
);

drop policy if exists sib_internal_announcement_reads_write on public.sib_internal_announcement_reads;
create policy sib_internal_announcement_reads_write
on public.sib_internal_announcement_reads
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.sib_internal_announcements a
    where a.id = sib_internal_announcement_reads.announcement_id
      and a.published = true
      and (select public.sib_internal_is_member(a.organization_id))
  )
);

drop policy if exists sib_internal_announcements_admin_insert on public.sib_internal_announcements;
create policy sib_internal_announcements_admin_insert
on public.sib_internal_announcements
for insert to authenticated
with check (
  (select public.sib_internal_is_admin(organization_id))
  and created_by = (select auth.uid())
);

drop policy if exists sib_internal_members_update_self on public.sib_internal_conversation_members;
create policy sib_internal_members_update_self
on public.sib_internal_conversation_members
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists sib_internal_conversations_create on public.sib_internal_conversations;
create policy sib_internal_conversations_create
on public.sib_internal_conversations
for insert to authenticated
with check (
  (select public.sib_internal_is_member(organization_id))
  and created_by = (select auth.uid())
);

drop policy if exists sib_internal_messages_read on public.sib_internal_messages;
create policy sib_internal_messages_read
on public.sib_internal_messages
for select to authenticated
using (
  exists (
    select 1
    from public.sib_internal_conversation_members cm
    where cm.conversation_id = sib_internal_messages.conversation_id
      and cm.user_id = (select auth.uid())
  )
);

drop policy if exists sib_internal_notifications_read on public.sib_internal_notifications;
create policy sib_internal_notifications_read
on public.sib_internal_notifications
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists sib_internal_notifications_update on public.sib_internal_notifications;
create policy sib_internal_notifications_update
on public.sib_internal_notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists sib_whatsapp_contacts_manage on public.sib_whatsapp_contacts;
create policy sib_whatsapp_contacts_manage
on public.sib_whatsapp_contacts
for all to authenticated
using (
  organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
  and exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_whatsapp_contacts.organization_id
      and m.active = true
      and m.role = any(array['Administrateur','Direction','RH']::text[])
  )
)
with check (
  organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
  and exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_whatsapp_contacts.organization_id
      and m.active = true
      and m.role = any(array['Administrateur','Direction','RH']::text[])
  )
);

drop policy if exists sib_whatsapp_logs_read on public.sib_whatsapp_message_log;
create policy sib_whatsapp_logs_read
on public.sib_whatsapp_message_log
for select to authenticated
using (
  organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
  and exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_whatsapp_message_log.organization_id
      and m.active = true
      and m.role = any(array['Administrateur','Direction','RH','Comptable']::text[])
  )
);

-- Consolidate overlapping permissive policies without widening access.
-- SELECT access is expressed as a single OR predicate; write privileges remain
-- limited to the same administrative roles as before.

drop policy if exists sib_attendance_admin_hr_direction_all on public.sib_attendance;
drop policy if exists sib_attendance_read_self on public.sib_attendance;
create policy sib_attendance_select_roles on public.sib_attendance
for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_attendance.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
  or exists (
    select 1 from public.sib_employees e
    where e.id = sib_attendance.employee_id
      and e.organization_id = sib_attendance.organization_id
      and e.user_id = (select auth.uid())
  )
);
create policy sib_attendance_insert_roles on public.sib_attendance
for insert to authenticated
with check (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_attendance.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
);
create policy sib_attendance_update_roles on public.sib_attendance
for update to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_attendance.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
)
with check (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_attendance.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
);
create policy sib_attendance_delete_roles on public.sib_attendance
for delete to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_attendance.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
);

drop policy if exists sib_employees_admin_hr_direction_all on public.sib_employees;
drop policy if exists sib_employees_read_self on public.sib_employees;
create policy sib_employees_select_roles on public.sib_employees
for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_employees.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
  or (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.organization_memberships m
      where m.organization_id = sib_employees.organization_id
        and m.user_id = (select auth.uid())
        and m.active = true
    )
  )
);
create policy sib_employees_insert_roles on public.sib_employees
for insert to authenticated
with check (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_employees.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
);
create policy sib_employees_update_roles on public.sib_employees
for update to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_employees.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
)
with check (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_employees.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
);
create policy sib_employees_delete_roles on public.sib_employees
for delete to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_employees.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role,''))) = any(array[
        'admin','administrateur','super_admin','super administrateur','super admin','direction','rh'
      ]::text[])
  )
);

drop policy if exists sib_leaves_hr_direction_admin_read on public.sib_leaves;
drop policy if exists sib_leaves_read_self on public.sib_leaves;
create policy sib_leaves_select_roles on public.sib_leaves
for select to authenticated
using (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','rh']::text[]))
  or exists (
    select 1 from public.sib_employees e
    where e.id = sib_leaves.employee_id
      and e.organization_id = sib_leaves.organization_id
      and e.user_id = (select auth.uid())
  )
);
drop policy if exists sib_leaves_hr_direction_admin_insert on public.sib_leaves;
drop policy if exists sib_leaves_insert_self on public.sib_leaves;
create policy sib_leaves_insert_roles on public.sib_leaves
for insert to authenticated
with check (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','rh']::text[]))
  or (
    status = 'pending'
    and approved_by is null
    and approved_at is null
    and exists (
      select 1 from public.sib_employees e
      where e.id = sib_leaves.employee_id
        and e.organization_id = sib_leaves.organization_id
        and e.user_id = (select auth.uid())
        and (select public.sib_has_active_role(e.organization_id,
          array['admin','administrateur','super_admin','super administrateur','super admin','direction','rh','comptable','caissier','commercial','technicien','formateur','magasinier','employe','employee']::text[]))
    )
  )
);

drop policy if exists sib_payroll_items_accounting_read on public.sib_payroll_items;
drop policy if exists sib_payroll_items_hr_admin_direction_read on public.sib_payroll_items;
drop policy if exists sib_payroll_items_read_self on public.sib_payroll_items;
create policy sib_payroll_items_select_roles on public.sib_payroll_items
for select to authenticated
using (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','rh','comptable']::text[]))
  or exists (
    select 1 from public.sib_employees e
    where e.id = sib_payroll_items.employee_id
      and e.organization_id = sib_payroll_items.organization_id
      and e.user_id = (select auth.uid())
  )
);

drop policy if exists sib_payroll_periods_accounting_read on public.sib_payroll_periods;
drop policy if exists sib_payroll_periods_hr_admin_direction_read on public.sib_payroll_periods;
drop policy if exists sib_payroll_periods_read_self on public.sib_payroll_periods;
create policy sib_payroll_periods_select_roles on public.sib_payroll_periods
for select to authenticated
using (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','rh','comptable']::text[]))
  or exists (
    select 1
    from public.sib_payroll_items pi
    join public.sib_employees e
      on e.id = pi.employee_id and e.organization_id = pi.organization_id
    where pi.payroll_period_id = sib_payroll_periods.id
      and pi.organization_id = sib_payroll_periods.organization_id
      and e.user_id = (select auth.uid())
  )
);

drop policy if exists sib_project_tasks_admin_direction_technical_all on public.sib_project_tasks;
drop policy if exists sib_project_tasks_commercial_read_assigned on public.sib_project_tasks;
create policy sib_project_tasks_select_roles on public.sib_project_tasks
for select to authenticated
using (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[]))
  or (
    assigned_user_id = (select auth.uid())
    and (select public.sib_has_active_role(organization_id,array['commercial']::text[]))
  )
);
create policy sib_project_tasks_insert_roles on public.sib_project_tasks
for insert to authenticated
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[])));
create policy sib_project_tasks_update_roles on public.sib_project_tasks
for update to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[])))
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[])));
create policy sib_project_tasks_delete_roles on public.sib_project_tasks
for delete to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[])));

drop policy if exists sib_projects_admin_direction_technical_all on public.sib_projects;
drop policy if exists sib_projects_commercial_read_assigned on public.sib_projects;
create policy sib_projects_select_roles on public.sib_projects
for select to authenticated
using (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[]))
  or (
    manager_user_id = (select auth.uid())
    and (select public.sib_has_active_role(organization_id,array['commercial']::text[]))
  )
);
create policy sib_projects_insert_roles on public.sib_projects
for insert to authenticated
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[])));
create policy sib_projects_update_roles on public.sib_projects
for update to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[])))
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[])));
create policy sib_projects_delete_roles on public.sib_projects
for delete to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','technicien']::text[])));

drop policy if exists sib_stock_categories_commercial_read on public.sib_stock_categories;
drop policy if exists sib_stock_categories_inventory_all on public.sib_stock_categories;
create policy sib_stock_categories_select_roles on public.sib_stock_categories
for select to authenticated
using (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien','commercial']::text[]))
);
create policy sib_stock_categories_insert_roles on public.sib_stock_categories
for insert to authenticated
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien']::text[])));
create policy sib_stock_categories_update_roles on public.sib_stock_categories
for update to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien']::text[])))
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien']::text[])));
create policy sib_stock_categories_delete_roles on public.sib_stock_categories
for delete to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien']::text[])));

drop policy if exists sib_stock_items_commercial_read on public.sib_stock_items;
drop policy if exists sib_stock_items_inventory_all on public.sib_stock_items;
create policy sib_stock_items_select_roles on public.sib_stock_items
for select to authenticated
using (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien','commercial']::text[]))
);
create policy sib_stock_items_insert_roles on public.sib_stock_items
for insert to authenticated
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien']::text[])));
create policy sib_stock_items_update_roles on public.sib_stock_items
for update to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien']::text[])))
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien']::text[])));
create policy sib_stock_items_delete_roles on public.sib_stock_items
for delete to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','magasinier','technicien']::text[])));

drop policy if exists sib_training_enrollments_accounting_read on public.sib_training_enrollments;
drop policy if exists sib_training_enrollments_training_staff_all on public.sib_training_enrollments;
create policy sib_training_enrollments_select_roles on public.sib_training_enrollments
for select to authenticated
using (
  (select public.sib_has_active_role(organization_id,
    array['admin','administrateur','super_admin','super administrateur','super admin','direction','formateur','comptable']::text[]))
);
create policy sib_training_enrollments_insert_roles on public.sib_training_enrollments
for insert to authenticated
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','formateur']::text[])));
create policy sib_training_enrollments_update_roles on public.sib_training_enrollments
for update to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','formateur']::text[])))
with check ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','formateur']::text[])));
create policy sib_training_enrollments_delete_roles on public.sib_training_enrollments
for delete to authenticated
using ((select public.sib_has_active_role(organization_id,
  array['admin','administrateur','super_admin','super administrateur','super admin','direction','formateur']::text[])));

create index if not exists sib_email_logs_actor_user_id_idx
  on public.sib_email_logs(actor_user_id);
create index if not exists sib_email_logs_organization_id_idx
  on public.sib_email_logs(organization_id);

commit;
