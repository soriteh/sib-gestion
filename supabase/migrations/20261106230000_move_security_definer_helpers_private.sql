-- Keep privileged membership/conversation helpers outside PostgREST's exposed public schema.
-- Public compatibility wrappers remain SECURITY INVOKER and preserve existing RPC
-- callers, while RLS policies retain their function OIDs after ALTER FUNCTION.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke all on table public.sib_site_admins from public, anon, authenticated;

alter function public.sib_internal_can_add_conversation_member(uuid, uuid) set schema private;
alter function public.sib_internal_can_manage_conversation(uuid) set schema private;
alter function public.sib_internal_can_read_conversation(uuid) set schema private;
alter function public.sib_internal_can_read_conversation_members(uuid) set schema private;
alter function public.sib_internal_can_read_conversation_row(uuid, uuid, uuid) set schema private;
alter function public.sib_internal_is_admin(uuid) set schema private;
alter function public.sib_internal_is_member(uuid) set schema private;
alter function public.sib_is_org_member(uuid) set schema private;
alter function public.sib_is_site_admin() set schema private;

revoke execute on function private.sib_internal_can_add_conversation_member(uuid, uuid) from public, anon;
revoke execute on function private.sib_internal_can_manage_conversation(uuid) from public, anon;
revoke execute on function private.sib_internal_can_read_conversation(uuid) from public, anon;
revoke execute on function private.sib_internal_can_read_conversation_members(uuid) from public, anon;
revoke execute on function private.sib_internal_can_read_conversation_row(uuid, uuid, uuid) from public, anon;
revoke execute on function private.sib_internal_is_admin(uuid) from public, anon;
revoke execute on function private.sib_internal_is_member(uuid) from public, anon;
revoke execute on function private.sib_is_org_member(uuid) from public, anon;
revoke execute on function private.sib_is_site_admin() from public, anon;

grant execute on function private.sib_internal_can_add_conversation_member(uuid, uuid) to authenticated, service_role;
grant execute on function private.sib_internal_can_manage_conversation(uuid) to authenticated, service_role;
grant execute on function private.sib_internal_can_read_conversation(uuid) to authenticated, service_role;
grant execute on function private.sib_internal_can_read_conversation_members(uuid) to authenticated, service_role;
grant execute on function private.sib_internal_can_read_conversation_row(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function private.sib_internal_is_admin(uuid) to authenticated, service_role;
grant execute on function private.sib_internal_is_member(uuid) to authenticated, service_role;
grant execute on function private.sib_is_org_member(uuid) to authenticated, service_role;
grant execute on function private.sib_is_site_admin() to authenticated, service_role;

create function public.sib_internal_can_add_conversation_member(p_conversation_id uuid, p_target_user_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_internal_can_add_conversation_member(p_conversation_id, p_target_user_id) $$;

create function public.sib_internal_can_manage_conversation(p_conversation uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_internal_can_manage_conversation(p_conversation) $$;

create function public.sib_internal_can_read_conversation(p_conversation uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_internal_can_read_conversation(p_conversation) $$;

create function public.sib_internal_can_read_conversation_members(p_conversation uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_internal_can_read_conversation_members(p_conversation) $$;

create function public.sib_internal_can_read_conversation_row(p_organization_id uuid, p_created_by uuid, p_conversation_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_internal_can_read_conversation_row(p_organization_id, p_created_by, p_conversation_id) $$;

create function public.sib_internal_is_admin(p_org uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_internal_is_admin(p_org) $$;

create function public.sib_internal_is_member(p_org uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_internal_is_member(p_org) $$;

create function public.sib_is_org_member(p_organization_id uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_is_org_member(p_organization_id) $$;

create function public.sib_is_site_admin()
returns boolean language sql stable security invoker set search_path = ''
as $$ select private.sib_is_site_admin() $$;

revoke execute on function public.sib_internal_can_add_conversation_member(uuid, uuid) from public, anon;
revoke execute on function public.sib_internal_can_manage_conversation(uuid) from public, anon;
revoke execute on function public.sib_internal_can_read_conversation(uuid) from public, anon;
revoke execute on function public.sib_internal_can_read_conversation_members(uuid) from public, anon;
revoke execute on function public.sib_internal_can_read_conversation_row(uuid, uuid, uuid) from public, anon;
revoke execute on function public.sib_internal_is_admin(uuid) from public, anon;
revoke execute on function public.sib_internal_is_member(uuid) from public, anon;
revoke execute on function public.sib_is_org_member(uuid) from public, anon;
revoke execute on function public.sib_is_site_admin() from public, anon;

grant execute on function public.sib_internal_can_add_conversation_member(uuid, uuid) to authenticated, service_role;
grant execute on function public.sib_internal_can_manage_conversation(uuid) to authenticated, service_role;
grant execute on function public.sib_internal_can_read_conversation(uuid) to authenticated, service_role;
grant execute on function public.sib_internal_can_read_conversation_members(uuid) to authenticated, service_role;
grant execute on function public.sib_internal_can_read_conversation_row(uuid, uuid, uuid) to authenticated, service_role;
grant execute on function public.sib_internal_is_admin(uuid) to authenticated, service_role;
grant execute on function public.sib_internal_is_member(uuid) to authenticated, service_role;
grant execute on function public.sib_is_org_member(uuid) to authenticated, service_role;
grant execute on function public.sib_is_site_admin() to authenticated, service_role;

commit;
