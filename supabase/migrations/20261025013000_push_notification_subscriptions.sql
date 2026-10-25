-- SIB Gestion — browser push notification subscriptions.
begin;
create table if not exists public.sib_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);
create index if not exists sib_push_subscriptions_user_idx
  on public.sib_push_subscriptions(user_id, organization_id);
alter table public.sib_push_subscriptions enable row level security;
drop policy if exists sib_push_subscriptions_read_own on public.sib_push_subscriptions;
create policy sib_push_subscriptions_read_own on public.sib_push_subscriptions
  for select to authenticated using (
    user_id = (select auth.uid()) and
    exists (select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id = sib_push_subscriptions.organization_id and m.active = true)
  );
drop policy if exists sib_push_subscriptions_insert_own on public.sib_push_subscriptions;
create policy sib_push_subscriptions_insert_own on public.sib_push_subscriptions
  for insert to authenticated with check (
    user_id = (select auth.uid()) and
    exists (select 1 from public.organization_memberships m
      where m.user_id = (select auth.uid())
        and m.organization_id = sib_push_subscriptions.organization_id and m.active = true)
  );
drop policy if exists sib_push_subscriptions_update_own on public.sib_push_subscriptions;
create policy sib_push_subscriptions_update_own on public.sib_push_subscriptions
  for update to authenticated using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
drop policy if exists sib_push_subscriptions_delete_own on public.sib_push_subscriptions;
create policy sib_push_subscriptions_delete_own on public.sib_push_subscriptions
  for delete to authenticated using (user_id = (select auth.uid()));
grant select, insert, update, delete on public.sib_push_subscriptions to authenticated;
revoke all on public.sib_push_subscriptions from anon;
commit;
