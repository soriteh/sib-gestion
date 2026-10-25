-- SIB Gestion — aligner les tables relationnelles avec le client Supabase actuel
-- Migration additive et idempotente. Ne supprime aucune donnée.
-- Prérequis : supabase/01_core_schema.sql et tables public.sib_clients/sib_services.
begin;

-- The frontend uses the established organizations/organization_memberships tables.
-- Mirror the existing organization UUID into the new sib_* schema so its foreign
-- keys accept the same organization ID. This does not create a second tenant ID.
insert into public.sib_organizations (id, name, short_name, currency_code, active)
select o.id, o.name, o.short_name, 'GNF', true
from public.organizations o
where o.id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
on conflict (id) do update
set name = excluded.name,
    short_name = excluded.short_name,
    currency_code = excluded.currency_code,
    active = true;

do $
begin
  if not exists (
    select 1 from public.sib_organizations
    where id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
  ) then
    raise exception 'Organisation SIB introuvable dans public.organizations. Vérifiez l''UUID avant de poursuivre.';
  end if;
end $;

-- Use the same membership source as Supabase Auth sign-in. The original
-- sib_memberships table is not populated by the current invitation flow.
create or replace function public.sib_is_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $
  select exists (
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
  );
$;

revoke all on function public.sib_is_member(uuid) from public, anon;
grant execute on function public.sib_is_member(uuid) to authenticated;

alter table public.sib_clients
  add column if not exists legacy_id text,
  add column if not exists client_code text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists address text,
  add column if not exists tax_id text;

alter table public.sib_services
  add column if not exists legacy_id text,
  add column if not exists service_code text,
  add column if not exists category text,
  add column if not exists unit text not null default 'unité',
  add column if not exists currency text not null default 'GNF';

-- Supabase upsert(..., onConflict: 'organization_id,legacy_id') requires
-- a matching non-partial unique index. PostgreSQL permits multiple NULL
-- legacy IDs in a regular unique index, so unmigrated rows remain compatible.
create unique index if not exists sib_clients_org_legacy_id_uidx
  on public.sib_clients (organization_id, legacy_id);

create unique index if not exists sib_services_org_legacy_id_uidx
  on public.sib_services (organization_id, legacy_id);

-- Keep the four client categories accepted by the current interface.
-- Normalize existing values before installing the matching constraint.
alter table public.sib_clients
  drop constraint if exists sib_clients_client_type_check;

update public.sib_clients
set client_type = case
  when lower(trim(client_type)) in ('particulier', 'individual') then 'particulier'
  when lower(trim(client_type)) in ('etablissement scolaire', 'établissement scolaire', 'etablissement_scolaire') then 'etablissement_scolaire'
  when lower(trim(client_type)) = 'autre' then 'autre'
  else 'entreprise'
end;

alter table public.sib_clients
  add constraint sib_clients_client_type_check
  check (client_type in ('particulier', 'entreprise', 'etablissement_scolaire', 'autre'));

commit;
