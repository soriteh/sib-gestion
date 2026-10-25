-- SIB Gestion — aligner les tables relationnelles avec le client Supabase actuel
-- Migration additive et idempotente. Ne supprime aucune donnée.
-- Prérequis : supabase/01_core_schema.sql et tables public.sib_clients/sib_services.
begin;

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
-- a matching unique constraint/index. Partial indexes permit rows that have
-- not yet been migrated from the legacy local state.
create unique index if not exists sib_clients_org_legacy_id_uidx
  on public.sib_clients (organization_id, legacy_id)
  where legacy_id is not null;

create unique index if not exists sib_services_org_legacy_id_uidx
  on public.sib_services (organization_id, legacy_id)
  where legacy_id is not null;

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
