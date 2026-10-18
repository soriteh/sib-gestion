-- SIB Gestion — réactiver l'accès administrateur existant
-- À exécuter dans le SQL Editor du projet Supabase SIB.
-- Ce script ne change pas le mot de passe et ne crée pas de compte Auth.
-- Il rattache le compte existant à l'organisation SIB et active son rôle Administrateur.

begin;

do $$
declare
  v_user_id uuid;
  v_org_id uuid := '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('sib.innovbuss@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'Compte Auth sib.innovbuss@gmail.com introuvable. Créez ou vérifiez ce compte dans Authentication > Users avant de continuer.';
  end if;

  if not exists (select 1 from public.organizations where id = v_org_id) then
    raise exception 'Organisation SIB introuvable. Vérifiez public.organizations et l''identifiant configuré.';
  end if;

  update public.organization_memberships
     set role = 'Administrateur',
         active = true
   where organization_id = v_org_id
     and user_id = v_user_id;

  if not found then
    insert into public.organization_memberships (organization_id, user_id, role, active)
    values (v_org_id, v_user_id, 'Administrateur', true);
  end if;
end $$;

commit;

-- Vérification finale : doit retourner une ligne avec role=Administrateur et active=true.
select user_id, organization_id, role, active
from public.organization_memberships
where organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
  and user_id = (
    select id from auth.users where lower(email) = lower('sib.innovbuss@gmail.com') limit 1
  );
