-- Allow users to dismiss an in-app notification without marking it as read.
begin;

alter table public.sib_internal_notifications
  add column if not exists dismissed_at timestamptz;

create index if not exists sib_internal_notifications_user_visible_idx
  on public.sib_internal_notifications(user_id, dismissed_at, created_at desc);

commit;
