-- SIB Gestion — validation avant activation multi-appareils
-- Lecture seule : ce script ne modifie aucune donnée.
-- À exécuter dans Supabase SQL Editor après avoir sélectionné le projet SIB.

select
  'organization_memberships' as table_name,
  to_regclass('public.organization_memberships') is not null as exists;

select
  'organizations' as table_name,
  to_regclass('public.organizations') is not null as exists;

select
  'sib_organizations' as table_name,
  to_regclass('public.sib_organizations') is not null as exists;

select
  'sib_memberships' as table_name,
  to_regclass('public.sib_memberships') is not null as exists;

-- Vérifie l'organisation connue, sans créer ni modifier de ligne.
select id, name, short_name
from public.organizations
where id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid;

-- Vérifie les colonnes et la présence de RLS sur les tables d'accès existantes.
select
  c.table_name,
  c.column_name,
  c.data_type,
  c.is_nullable
from information_schema.columns c
where c.table_schema = 'public'
  and c.table_name in ('organizations', 'organization_memberships')
order by c.table_name, c.ordinal_position;

select
  t.tablename,
  t.rowsecurity as rls_enabled
from pg_tables t
where t.schemaname = 'public'
  and t.tablename in ('organizations', 'organization_memberships');
