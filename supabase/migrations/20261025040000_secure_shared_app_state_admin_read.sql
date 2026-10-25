-- Security correction: shared JSON contains finance and HR data without per-module isolation.
-- Until the app is fully migrated to role-scoped relational tables, only active admins may read it.
begin;
drop policy if exists sib_app_state_member_read on public.sib_app_state;
drop policy if exists sib_app_state_admin_read on public.sib_app_state;
create policy sib_app_state_admin_read on public.sib_app_state
for select to authenticated
using (
  exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = sib_app_state.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
      and lower(trim(m.role)) in ('admin', 'administrateur', 'super_admin', 'super admin')
  )
);
commit;
