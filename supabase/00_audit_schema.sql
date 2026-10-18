-- SIB Gestion — audit SQL en lecture seule
-- À exécuter dans Supabase > SQL Editor sur le projet SIB.
-- Ce script n'ajoute, ne modifie et ne supprime aucune donnée.

-- 1) Tables applicatives existantes
select table_schema, table_name
from information_schema.tables
where table_schema in ('public')
  and table_type = 'BASE TABLE'
order by table_schema, table_name;

-- 2) Colonnes, types et valeurs par défaut
select table_name, ordinal_position, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
order by table_name, ordinal_position;

-- 3) Clés primaires et étrangères
select
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  kcu.column_name,
  ccu.table_name as foreign_table_name,
  ccu.column_name as foreign_column_name
from information_schema.table_constraints tc
left join information_schema.key_column_usage kcu
  on tc.constraint_name = kcu.constraint_name
 and tc.constraint_schema = kcu.constraint_schema
left join information_schema.constraint_column_usage ccu
  on ccu.constraint_name = tc.constraint_name
 and ccu.constraint_schema = tc.constraint_schema
where tc.table_schema = 'public'
  and tc.constraint_type in ('PRIMARY KEY', 'FOREIGN KEY', 'UNIQUE')
order by tc.table_name, tc.constraint_type, tc.constraint_name;

-- 4) État RLS de chaque table publique
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relname;

-- 5) Politiques RLS existantes
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;

-- 6) Fonctions publiques liées à l'application (noms et signatures seulement)
select routine_name, routine_type, data_type
from information_schema.routines
where routine_schema = 'public'
order by routine_name;
