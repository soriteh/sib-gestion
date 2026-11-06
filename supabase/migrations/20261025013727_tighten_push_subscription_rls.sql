-- Tighten push subscription updates: a user may only keep subscriptions in an active organization.
begin;
drop policy if exists sib_push_subscriptions_update_own on public.sib_push_subscriptions;
create policy sib_push_subscriptions_update_own on public.sib_push_subscriptions
  for update to authenticated
  using (
    user_id = (select auth.uid()) and
    exists (select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id = sib_push_subscriptions.organization_id and m.active = true)
  )
  with check (
    user_id = (select auth.uid()) and
    exists (select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id = sib_push_subscriptions.organization_id and m.active = true)
  );
commit;
