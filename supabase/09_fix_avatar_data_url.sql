-- Correctif SIB Gestion : colonne avatar absente du cache/schéma PostgREST.
-- À exécuter dans Supabase > SQL Editor sur le projet utilisé par l'application.
begin;

alter table public.sib_user_profiles
  add column if not exists avatar_data_url text not null default '';

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
  and column_name = 'avatar_data_url';
