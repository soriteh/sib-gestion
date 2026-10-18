-- SIB Gestion — synchronisation centrale de l'état applicatif
-- À exécuter dans Supabase SQL Editor, dans le projet SIB existant.
-- Ne crée pas une nouvelle entreprise et n'efface aucune donnée.
begin;

create table if not exists public.sib_app_state (
  organization_id uuid primary key references public.organizations(id) on delete restrict,
  state jsonb not null,
  version integer not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.sib_app_state enable row level security;
revoke all on table public.sib_app_state from anon, authenticated;
grant select on table public.sib_app_state to authenticated;

drop policy if exists sib_app_state_member_read on public.sib_app_state;
create policy sib_app_state_member_read on public.sib_app_state
for select to authenticated
using (
  exists (
    select 1 from public.organization_memberships m
    where m.organization_id = sib_app_state.organization_id
      and m.user_id = (select auth.uid())
      and m.active = true
  )
);

create or replace function public.sib_save_app_state(
  p_organization_id uuid,
  p_state jsonb,
  p_expected_version integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare new_version integer;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise' using errcode = '28000';
  end if;
  if jsonb_typeof(p_state) <> 'object' then
    raise exception 'État applicatif invalide' using errcode = '22023';
  end if;
  if octet_length(p_state::text) > 5000000 then
    raise exception 'État applicatif trop volumineux (maximum 5 Mo)' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active = true
  ) then
    raise exception 'Accès refusé à cette organisation' using errcode = '42501';
  end if;

  if p_expected_version is null then
    insert into public.sib_app_state (organization_id, state, version, updated_by, updated_at)
    values (p_organization_id, p_state, 1, auth.uid(), now())
    on conflict (organization_id) do nothing
    returning version into new_version;
    if new_version is null then
      raise exception 'Conflit de synchronisation : des données existent déjà. Rechargez les données centrales.' using errcode = '40001';
    end if;
    return new_version;
  end if;

  update public.sib_app_state
     set state = p_state,
         version = version + 1,
         updated_by = auth.uid(),
         updated_at = now()
   where organization_id = p_organization_id
     and version = p_expected_version
  returning version into new_version;

  if new_version is null then
    raise exception 'Conflit de synchronisation : les données ont changé sur un autre appareil. Rechargez avant de continuer.' using errcode = '40001';
  end if;
  return new_version;
end;
$$;

revoke all on function public.sib_save_app_state(uuid, jsonb, integer) from public, anon;
grant execute on function public.sib_save_app_state(uuid, jsonb, integer) to authenticated;
-- Active Realtime pour signaler les changements aux autres appareils.
do $
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'sib_app_state'
     ) then
    execute 'alter publication supabase_realtime add table public.sib_app_state';
  end if;
end $;
commit;
