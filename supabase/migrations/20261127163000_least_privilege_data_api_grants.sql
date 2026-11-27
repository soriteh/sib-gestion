-- SIB Gestion: least-privilege grants for the public Data API.
-- Keeps the two intended anonymous use cases:
--   1) read published training courses (RLS limits rows to published=true)
--   2) submit a public training inquiry (RLS validates the public form contract)
-- Authenticated CRUD grants are retained; only structural table privileges are removed.
-- New objects created by postgres require explicit API grants.

begin;

-- Existing objects: anonymous access is opt-in, not inherited across business tables.
revoke all privileges on all tables in schema public from anon;
grant select on table public.sib_formation_courses to anon;
grant insert on table public.sib_formation_inquiries to anon;

-- RLS does not protect these structural privileges.
revoke truncate, references, trigger, maintain
  on all tables in schema public
  from anon, authenticated;

-- Anonymous clients do not need direct sequence access.
revoke all privileges on all sequences in schema public from anon;

-- Future objects created by postgres must be exposed explicitly.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated, service_role;

-- PostgreSQL grants EXECUTE to PUBLIC by default for new functions.
-- This global default is revoked; future functions (including private RLS
-- helpers) must receive explicit EXECUTE grants for their intended callers.
alter default privileges for role postgres
  revoke execute on functions from public;

-- Fail the migration if an unexpected anonymous table grant remains.
do $$
declare
  v_bad_count integer;
begin
  select count(*) into v_bad_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (
      (c.relname = 'sib_formation_courses' and (
        has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'REFERENCES')
        or has_table_privilege('anon', c.oid, 'TRIGGER')
      ))
      or
      (c.relname = 'sib_formation_inquiries' and (
        has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'REFERENCES')
        or has_table_privilege('anon', c.oid, 'TRIGGER')
      ))
      or
      (c.relname not in ('sib_formation_courses', 'sib_formation_inquiries')
       and (
        has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'REFERENCES')
        or has_table_privilege('anon', c.oid, 'TRIGGER')
      ))
    );
  if v_bad_count > 0 then
    raise exception 'Least-privilege verification failed: % public tables still grant unexpected privileges to anon', v_bad_count;
  end if;

  select count(*) into v_bad_count
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and (
      has_table_privilege('authenticated', c.oid, 'TRUNCATE')
      or has_table_privilege('authenticated', c.oid, 'REFERENCES')
      or has_table_privilege('authenticated', c.oid, 'TRIGGER')
      or has_table_privilege('authenticated', c.oid, 'MAINTAIN')
    );
  if v_bad_count > 0 then
    raise exception 'Least-privilege verification failed: % public tables still grant structural privileges to authenticated', v_bad_count;
  end if;
end
$$;

commit;
