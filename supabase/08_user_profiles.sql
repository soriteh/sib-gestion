-- SIB Gestion — profils utilisateurs dédiés
-- À exécuter après 01_core_schema.sql et 07_align_relational_sync.sql.
-- Table liée à Supabase Auth ; chaque utilisateur ne peut gérer que son propre profil.
begin;

create table if not exists public.sib_user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid not null references public.sib_organizations(id) on delete cascade,
  first_name text not null default '',
  last_name text not null default '',
  full_name text not null default '',
  phone text not null default '',
  avatar_data_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sib_user_profiles_first_name_length check (char_length(first_name) <= 40),
  constraint sib_user_profiles_last_name_length check (char_length(last_name) <= 40),
  constraint sib_user_profiles_phone_length check (char_length(phone) <= 30),
  constraint sib_user_profiles_avatar_size check (octet_length(avatar_data_url) <= 350000)
);

create index if not exists sib_user_profiles_org_idx
  on public.sib_user_profiles (organization_id);

alter table public.sib_user_profiles enable row level security;

drop policy if exists sib_user_profiles_select_self on public.sib_user_profiles;
create policy sib_user_profiles_select_self on public.sib_user_profiles
for select to authenticated
using (user_id = (select auth.uid()) and public.sib_is_member(organization_id));

drop policy if exists sib_user_profiles_insert_self on public.sib_user_profiles;
create policy sib_user_profiles_insert_self on public.sib_user_profiles
for insert to authenticated
with check (user_id = (select auth.uid()) and public.sib_is_member(organization_id));

drop policy if exists sib_user_profiles_update_self on public.sib_user_profiles;
create policy sib_user_profiles_update_self on public.sib_user_profiles
for update to authenticated
using (user_id = (select auth.uid()) and public.sib_is_member(organization_id))
with check (user_id = (select auth.uid()) and public.sib_is_member(organization_id));

grant select, insert, update on public.sib_user_profiles to authenticated;
revoke all on public.sib_user_profiles from anon, public;

create or replace function public.sib_user_profiles_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sib_user_profiles_updated_at on public.sib_user_profiles;
create trigger sib_user_profiles_updated_at
before update on public.sib_user_profiles
for each row execute function public.sib_user_profiles_set_updated_at();

commit;
