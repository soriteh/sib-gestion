-- SIB Gestion — création contrôlée du premier administrateur
-- Exécuter une seule fois dans le SQL Editor du projet Supabase SIB.
-- La fonction n'autorise le bootstrap que si aucune appartenance n'existe encore
-- pour cette organisation. Elle ne peut donc pas remplacer un administrateur existant.

create or replace function public.sib_bootstrap_first_admin(
  p_organization_id uuid,
  p_full_name text default ''
) returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Connectez-vous au compte que vous souhaitez enregistrer comme premier administrateur.' using errcode = '28000';
  end if;
  if p_organization_id <> '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid then
    raise exception 'Identifiant d’organisation invalide.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'Organisation Soritech Innov Business introuvable.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.organization_memberships m where m.organization_id = p_organization_id) then
    raise exception 'Un compte est déjà rattaché à cette organisation. Utilisez la connexion habituelle ou rétablissez l''accès du compte existant.' using errcode = '42501';
  end if;

  insert into public.organization_memberships (organization_id, user_id, role, active)
  values (p_organization_id, v_uid, 'Administrateur', true);

  return 'Administrateur';
end;
$$;

revoke all on function public.sib_bootstrap_first_admin(uuid, text) from public, anon;
grant execute on function public.sib_bootstrap_first_admin(uuid, text) to authenticated;
