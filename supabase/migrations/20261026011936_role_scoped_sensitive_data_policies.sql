-- SIB Gestion: least-privilege access for profiles, HR and audit data.
-- Preserve admin workflows; prevent ordinary organization members from reading
-- or modifying other users' profiles, salaries, attendance records or audit logs.
begin;

-- A user may only read and manage their own profile in an organization where
-- they have an active membership.
drop policy if exists sib_user_profiles_org_member_all on public.sib_user_profiles;
drop policy if exists sib_user_profiles_select_self on public.sib_user_profiles;
drop policy if exists sib_user_profiles_insert_self on public.sib_user_profiles;
drop policy if exists sib_user_profiles_update_self on public.sib_user_profiles;

create policy sib_user_profiles_select_self
on public.sib_user_profiles for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_user_profiles.organization_id
      and m.active = true
  )
);

create policy sib_user_profiles_insert_self
on public.sib_user_profiles for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_user_profiles.organization_id
      and m.active = true
  )
);

create policy sib_user_profiles_update_self
on public.sib_user_profiles for update to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_user_profiles.organization_id
      and m.active = true
  )
)
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_user_profiles.organization_id
      and m.active = true
  )
);

-- HR and Direction can administer employee records. Other active members can
-- only read their own employee record; salary and personal data stay private.
drop policy if exists sib_employees_org_member_all on public.sib_employees;
drop policy if exists sib_employees_admin_hr_direction_all on public.sib_employees;
drop policy if exists sib_employees_read_self on public.sib_employees;

create policy sib_employees_admin_hr_direction_all
on public.sib_employees for all to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_employees.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role, ''))) in
        ('admin','administrateur','super_admin','super admin','direction','rh')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_employees.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role, ''))) in
        ('admin','administrateur','super_admin','super admin','direction','rh')
  )
);

create policy sib_employees_read_self
on public.sib_employees for select to authenticated
using (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_employees.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
  )
);

-- Attendance administration is limited to Admin, RH and Direction; an
-- employee may read their own attendance rows but cannot edit them directly.
drop policy if exists sib_attendance_org_member_all on public.sib_attendance;
drop policy if exists sib_attendance_admin_hr_direction_all on public.sib_attendance;
drop policy if exists sib_attendance_read_self on public.sib_attendance;

create policy sib_attendance_admin_hr_direction_all
on public.sib_attendance for all to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_attendance.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role, ''))) in
        ('admin','administrateur','super_admin','super admin','direction','rh')
  )
)
with check (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_attendance.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role, ''))) in
        ('admin','administrateur','super_admin','super admin','direction','rh')
  )
);

create policy sib_attendance_read_self
on public.sib_attendance for select to authenticated
using (
  exists (
    select 1 from public.sib_employees e
    where e.id = sib_attendance.employee_id
      and e.organization_id = sib_attendance.organization_id
      and e.user_id = (select auth.uid())
  )
);

-- Audit logs are read-only to application users and visible only to
-- administrators/Direction. Updates and deletes are not granted to clients.
drop policy if exists sib_audit_log_org_member_all on public.sib_audit_log;
drop policy if exists sib_audit_log_admin_read on public.sib_audit_log;
drop policy if exists sib_audit_log_admin_insert on public.sib_audit_log;

create policy sib_audit_log_admin_read
on public.sib_audit_log for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_audit_log.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role, ''))) in
        ('admin','administrateur','super_admin','super admin','direction')
  )
);

create policy sib_audit_log_admin_insert
on public.sib_audit_log for insert to authenticated
with check (
  actor_user_id = (select auth.uid())
  and exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_audit_log.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(coalesce(m.role, ''))) in
        ('admin','administrateur','super_admin','super admin','direction')
  )
);

revoke update, delete on public.sib_audit_log from authenticated;
grant select, insert on public.sib_audit_log to authenticated;

commit;
