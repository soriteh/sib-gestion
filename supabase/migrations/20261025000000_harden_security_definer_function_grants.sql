-- SIB Gestion: reduce the callable surface of SECURITY DEFINER RPCs.
-- Keep authenticated execution for RPCs and RLS helpers that the app currently relies on,
-- but explicitly remove default PUBLIC and anonymous execution.
begin;
revoke all on function public.sib_attendance_confirm(uuid) from public, anon;
grant execute on function public.sib_attendance_confirm(uuid) to authenticated, service_role;

revoke all on function public.sib_bootstrap_first_admin(uuid, text) from public, anon;
grant execute on function public.sib_bootstrap_first_admin(uuid, text) to authenticated, service_role;

revoke all on function public.sib_internal_can_manage_conversation(uuid) from public, anon;
grant execute on function public.sib_internal_can_manage_conversation(uuid) to authenticated, service_role;

revoke all on function public.sib_internal_is_admin(uuid) from public, anon;
grant execute on function public.sib_internal_is_admin(uuid) to authenticated, service_role;

revoke all on function public.sib_internal_is_member(uuid) from public, anon;
grant execute on function public.sib_internal_is_member(uuid) to authenticated, service_role;

revoke all on function public.sib_is_org_member(uuid) from public, anon;
grant execute on function public.sib_is_org_member(uuid) to authenticated, service_role;

revoke all on function public.sib_is_site_admin() from public, anon;
grant execute on function public.sib_is_site_admin() to authenticated, service_role;

revoke all on function public.sib_save_app_state(uuid, jsonb, integer) from public, anon;
grant execute on function public.sib_save_app_state(uuid, jsonb, integer) to authenticated, service_role;
commit;
