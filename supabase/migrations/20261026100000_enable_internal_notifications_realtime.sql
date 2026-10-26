-- SIB Gestion: enable live delivery of in-app notification changes.
begin;
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'sib_internal_notifications'
     ) then
    alter publication supabase_realtime add table public.sib_internal_notifications;
  end if;
end $$;
commit;
