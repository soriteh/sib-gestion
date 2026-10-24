-- SIB Gestion — communication interne (messagerie, groupes, annonces, notifications, audit)
-- Migration additive. À exécuter dans Supabase SQL Editor après vérification du schéma existant.
begin;

create table if not exists public.sib_internal_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  title text,
  conversation_type text not null default 'direct' check (conversation_type in ('direct','group')),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sib_internal_conversation_members (
  conversation_id uuid not null references public.sib_internal_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz,
  primary key (conversation_id,user_id)
);

create table if not exists public.sib_internal_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.sib_internal_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete restrict,
  body text not null check (length(trim(body)) between 1 and 10000),
  attachment_url text,
  created_at timestamptz not null default now(),
  edited_at timestamptz
);

create table if not exists public.sib_internal_announcements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  title text not null check (length(trim(title)) between 1 and 200),
  body text not null check (length(trim(body)) between 1 and 20000),
  audience text not null default 'all' check (audience in ('all','department','users')),
  audience_data jsonb not null default '{}'::jsonb,
  requires_ack boolean not null default false,
  published boolean not null default false,
  created_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sib_internal_announcement_reads (
  announcement_id uuid not null references public.sib_internal_announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  primary key (announcement_id,user_id)
);

create table if not exists public.sib_internal_notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null default '',
  target_type text,
  target_id text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.sib_internal_audit (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sib_internal_messages_conversation_idx on public.sib_internal_messages(conversation_id,created_at desc);
create index if not exists sib_internal_notifications_user_idx on public.sib_internal_notifications(user_id,read_at,created_at desc);
create index if not exists sib_internal_announcements_org_idx on public.sib_internal_announcements(organization_id,published,published_at desc);
create index if not exists sib_internal_audit_org_idx on public.sib_internal_audit(organization_id,created_at desc);

-- Membership checks use the existing organization_memberships table used by SIB Gestion.
create or replace function public.sib_internal_is_member(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.active = true
  );
$$;

create or replace function public.sib_internal_is_admin(p_org uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.organization_memberships m
    where m.organization_id = p_org and m.user_id = auth.uid() and m.active = true
      and lower(coalesce(m.role,'')) in ('administrateur','admin','direction')
  );
$$;

alter table public.sib_internal_conversations enable row level security;
alter table public.sib_internal_conversation_members enable row level security;
alter table public.sib_internal_messages enable row level security;
alter table public.sib_internal_announcements enable row level security;
alter table public.sib_internal_announcement_reads enable row level security;
alter table public.sib_internal_notifications enable row level security;
alter table public.sib_internal_audit enable row level security;

drop policy if exists sib_internal_conversations_read on public.sib_internal_conversations;
create policy sib_internal_conversations_read on public.sib_internal_conversations for select to authenticated
using (public.sib_internal_is_member(organization_id) and exists (
  select 1 from public.sib_internal_conversation_members cm where cm.conversation_id=id and cm.user_id=auth.uid()
));
drop policy if exists sib_internal_conversations_create on public.sib_internal_conversations;
create policy sib_internal_conversations_create on public.sib_internal_conversations for insert to authenticated
with check (public.sib_internal_is_member(organization_id) and created_by=auth.uid());
drop policy if exists sib_internal_conversations_admin_update on public.sib_internal_conversations;
create policy sib_internal_conversations_admin_update on public.sib_internal_conversations for update to authenticated
using (public.sib_internal_is_admin(organization_id)) with check (public.sib_internal_is_admin(organization_id));

drop policy if exists sib_internal_members_read on public.sib_internal_conversation_members;
create policy sib_internal_members_read on public.sib_internal_conversation_members for select to authenticated
using (user_id=auth.uid() or exists (
  select 1 from public.sib_internal_conversations c where c.id=conversation_id and public.sib_internal_is_admin(c.organization_id)
));
drop policy if exists sib_internal_members_add on public.sib_internal_conversation_members;
create policy sib_internal_members_add on public.sib_internal_conversation_members for insert to authenticated
with check (added_by=auth.uid() and exists (
  select 1 from public.sib_internal_conversations c where c.id=conversation_id
    and public.sib_internal_is_member(c.organization_id)
    and (c.created_by=auth.uid() or public.sib_internal_is_admin(c.organization_id))
) and exists (
  select 1 from public.organization_memberships m
  join public.sib_internal_conversations c on c.organization_id=m.organization_id
  where c.id=conversation_id and m.user_id=sib_internal_conversation_members.user_id and m.active=true
));
drop policy if exists sib_internal_members_update_self on public.sib_internal_conversation_members;
create policy sib_internal_members_update_self on public.sib_internal_conversation_members for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists sib_internal_messages_read on public.sib_internal_messages;
create policy sib_internal_messages_read on public.sib_internal_messages for select to authenticated
using (exists (
  select 1 from public.sib_internal_conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()
));
drop policy if exists sib_internal_messages_send on public.sib_internal_messages;
create policy sib_internal_messages_send on public.sib_internal_messages for insert to authenticated
with check (sender_id=auth.uid() and exists (
  select 1 from public.sib_internal_conversation_members cm where cm.conversation_id=conversation_id and cm.user_id=auth.uid()
));

drop policy if exists sib_internal_announcements_read on public.sib_internal_announcements;
create policy sib_internal_announcements_read on public.sib_internal_announcements for select to authenticated
using (public.sib_internal_is_member(organization_id) and (published=true or public.sib_internal_is_admin(organization_id)));
drop policy if exists sib_internal_announcements_admin_insert on public.sib_internal_announcements;
create policy sib_internal_announcements_admin_insert on public.sib_internal_announcements for insert to authenticated
with check (public.sib_internal_is_admin(organization_id) and created_by=auth.uid());
drop policy if exists sib_internal_announcements_admin_update on public.sib_internal_announcements;
create policy sib_internal_announcements_admin_update on public.sib_internal_announcements for update to authenticated
using (public.sib_internal_is_admin(organization_id)) with check (public.sib_internal_is_admin(organization_id));

drop policy if exists sib_internal_announcement_reads_read on public.sib_internal_announcement_reads;
create policy sib_internal_announcement_reads_read on public.sib_internal_announcement_reads for select to authenticated
using (user_id=auth.uid() or exists (
 select 1 from public.sib_internal_announcements a where a.id=announcement_id and public.sib_internal_is_admin(a.organization_id)
));
drop policy if exists sib_internal_announcement_reads_write on public.sib_internal_announcement_reads;
create policy sib_internal_announcement_reads_write on public.sib_internal_announcement_reads for insert to authenticated
with check (user_id=auth.uid() and exists (
 select 1 from public.sib_internal_announcements a where a.id=announcement_id and a.published=true and public.sib_internal_is_member(a.organization_id)
));

drop policy if exists sib_internal_notifications_read on public.sib_internal_notifications;
create policy sib_internal_notifications_read on public.sib_internal_notifications for select to authenticated using (user_id=auth.uid());
drop policy if exists sib_internal_notifications_update on public.sib_internal_notifications;
create policy sib_internal_notifications_update on public.sib_internal_notifications for update to authenticated
using (user_id=auth.uid()) with check (user_id=auth.uid());

drop policy if exists sib_internal_audit_admin_read on public.sib_internal_audit;
create policy sib_internal_audit_admin_read on public.sib_internal_audit for select to authenticated
using (public.sib_internal_is_admin(organization_id));

revoke all on public.sib_internal_audit from anon, authenticated;
grant select on public.sib_internal_audit to authenticated;
grant select, insert, update on public.sib_internal_conversations, public.sib_internal_conversation_members,
  public.sib_internal_messages, public.sib_internal_announcements, public.sib_internal_announcement_reads,
  public.sib_internal_notifications to authenticated;
revoke all on function public.sib_internal_is_member(uuid) from public, anon;
revoke all on function public.sib_internal_is_admin(uuid) from public, anon;
grant execute on function public.sib_internal_is_member(uuid), public.sib_internal_is_admin(uuid) to authenticated;

-- Empêche l'écriture directe dans le journal d'audit par les utilisateurs.
revoke insert, update, delete on public.sib_internal_audit from authenticated;

commit;
