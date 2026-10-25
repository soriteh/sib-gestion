-- SIB Gestion — sécuriser l'état applicatif JSON partagé
-- IMPORTANT : l'état JSON contient plusieurs modules sensibles sans autorisations
-- séparées par module. Jusqu'à migration complète vers des tables avec RLS dédiée,
-- seuls les administrateurs peuvent lire ou modifier cet état central.
-- Migration additive : aucune donnée métier n'est supprimée.
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

create or replace function public.sib_save_app_state(
  p_organization_id uuid,
  p_state jsonb,
  p_expected_version integer
) returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_version integer;
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
    select 1
    from public.organization_memberships m
    where m.organization_id = p_organization_id
      and m.user_id = auth.uid()
      and m.active = true
      and lower(trim(m.role)) in ('admin', 'administrateur', 'super_admin', 'super admin')
  ) then
    raise exception 'Accès refusé : seuls les administrateurs actifs peuvent modifier l''état applicatif central.' using errcode = '42501';
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

commit;
