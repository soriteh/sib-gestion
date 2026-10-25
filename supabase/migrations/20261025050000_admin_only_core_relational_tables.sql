-- Temporary least-privilege posture while module-scoped roles are not implemented.
-- Core business tables remain admin-only until role-specific access policies are ready.
begin;
do $$
declare t text;
begin
  foreach t in array array['sib_clients','sib_services','sib_documents','sib_document_lines','sib_payments','sib_expenses','sib_financial_accounts'] loop
    execute format('drop policy if exists %I on public.%I', t || '_org_member_all', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (exists (select 1 from public.organization_memberships m where m.organization_id = %I.organization_id and m.user_id = (select auth.uid()) and m.active = true and lower(trim(m.role)) in (''admin'',''administrateur'',''super_admin'',''super admin''))) with check (exists (select 1 from public.organization_memberships m where m.organization_id = %I.organization_id and m.user_id = (select auth.uid()) and m.active = true and lower(trim(m.role)) in (''admin'',''administrateur'',''super_admin'',''super admin'')))',
      t || '_admin_all', t, t, t
    );
  end loop;
end $$;
commit;
