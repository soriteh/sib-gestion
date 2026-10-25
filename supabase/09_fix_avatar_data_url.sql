-- Correctif additif du schéma de profil SIB Gestion.
-- Peut être exécuté de nouveau sans supprimer les données existantes.
begin;

alter table public.sib_user_profiles
  add column if not exists first_name text not null default '',
  add column if not exists last_name text not null default '',
  add column if not exists avatar_data_url text not null default '';

update public.sib_user_profiles
set
  first_name = coalesce(nullif(first_name, ''), split_part(coalesce(full_name, ''), ' ', 1)),
  last_name = coalesce(nullif(last_name, ''), nullif(trim(regexp_replace(coalesce(full_name, ''), '^\S+\s*', '')), ''))
where first_name = '' or last_name = '';

alter table public.sib_user_profiles
  drop constraint if exists sib_user_profiles_avatar_size;

alter table public.sib_user_profiles
  add constraint sib_user_profiles_avatar_size
  check (octet_length(avatar_data_url) <= 350000);

notify pgrst, 'reload schema';
commit;

-- Vérification facultative après exécution :
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'sib_user_profiles'
  and column_name in ('first_name', 'last_name', 'avatar_data_url')
order by column_name;
