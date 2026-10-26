-- Add covering indexes for foreign keys that Supabase's database advisor
-- reports as unindexed. Additive only; no table or row changes.
begin;

do $block$
declare
  fk record;
  idx_name text;
begin
  for fk in
    select
      c.conrelid::regclass as relation_name,
      c.conrelid::oid as relation_oid,
      t.relname as table_name,
      a.attname as column_name,
      c.conname as constraint_name,
      c.conkey[1] as column_number
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f'
      and n.nspname = 'public'
      and cardinality(c.conkey) = 1
      and not exists (
        select 1
        from pg_index i
        where i.indrelid = c.conrelid
          and i.indisvalid
          and i.indisready
          and i.indpred is null
          and i.indexprs is null
          and i.indkey[0] = c.conkey[1]
      )
    order by t.relname, a.attname
  loop
    idx_name := 'idx_' || left(fk.table_name, 40) || '_' ||
      left(fk.column_name, 10) || '_' ||
      substr(md5(fk.table_name || '.' || fk.column_name), 1, 6);
    execute format(
      'create index if not exists %I on public.%I (%I)',
      idx_name, fk.table_name, fk.column_name
    );
  end loop;
end
$block$;

commit;
