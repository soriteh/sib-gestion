-- SIB Gestion: avoid per-row re-evaluation of auth context in RLS policies.
-- This migration changes policy expressions only; it preserves the existing role
-- boundaries and all rows. It also adds indexes for the two uncovered email-log FKs.
begin;

drop policy if exists sib_attendance_checkins_read_self on public.sib_attendance_checkins;
create policy sib_attendance_checkins_read_self
on public.sib_attendance_checkins
for select to authenticated
using (
  user_id = (select auth.uid())
  or (select public.sib_internal_is_admin(organization_id))
);

drop policy if exists sib_internal_announcement_reads_read on public.sib_internal_announcement_reads;
create policy sib_internal_announcement_reads_read
on public.sib_internal_announcement_reads
for select to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1
    from public.sib_internal_announcements a
    where a.id = sib_internal_announcement_reads.announcement_id
      and (select public.sib_internal_is_admin(a.organization_id))
  )
);

drop policy if exists sib_internal_announcement_reads_write on public.sib_internal_announcement_reads;
create policy sib_internal_announcement_reads_write
on public.sib_internal_announcement_reads
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1
    from public.sib_internal_announcements a
    where a.id = sib_internal_announcement_reads.announcement_id
      and a.published = true
      and (select public.sib_internal_is_member(a.organization_id))
  )
);

drop policy if exists sib_internal_announcements_admin_insert on public.sib_internal_announcements;
create policy sib_internal_announcements_admin_insert
on public.sib_internal_announcements
for insert to authenticated
with check (
  (select public.sib_internal_is_admin(organization_id))
  and created_by = (select auth.uid())
);

drop policy if exists sib_internal_members_update_self on public.sib_internal_conversation_members;
create policy sib_internal_members_update_self
on public.sib_internal_conversation_members
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists sib_internal_conversations_create on public.sib_internal_conversations;
create policy sib_internal_conversations_create
on public.sib_internal_conversations
for insert to authenticated
with check (
  (select public.sib_internal_is_member(organization_id))
  and created_by = (select auth.uid())
);

drop policy if exists sib_internal_messages_read on public.sib_internal_messages;
create policy sib_internal_messages_read
on public.sib_internal_messages
for select to authenticated
using (
  exists (
    select 1
    from public.sib_internal_conversation_members cm
    where cm.conversation_id = sib_internal_messages.conversation_id
      and cm.user_id = (select auth.uid())
  )
);

drop policy if exists sib_internal_notifications_read on public.sib_internal_notifications;
create policy sib_internal_notifications_read
on public.sib_internal_notifications
for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists sib_internal_notifications_update on public.sib_internal_notifications;
create policy sib_internal_notifications_update
on public.sib_internal_notifications
for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists sib_whatsapp_contacts_manage on public.sib_whatsapp_contacts;
create policy sib_whatsapp_contacts_manage
on public.sib_whatsapp_contacts
for all to authenticated
using (
  organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
  and exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_whatsapp_contacts.organization_id
      and m.active = true
      and m.role = any(array['Administrateur','Direction','RH']::text[])
  )
)
with check (
  organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
  and exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_whatsapp_contacts.organization_id
      and m.active = true
      and m.role = any(array['Administrateur','Direction','RH']::text[])
  )
);

drop policy if exists sib_whatsapp_logs_read on public.sib_whatsapp_message_log;
create policy sib_whatsapp_logs_read
on public.sib_whatsapp_message_log
for select to authenticated
using (
  organization_id = '6070dc4b-5c5e-402c-911b-735cb754d241'::uuid
  and exists (
    select 1
    from public.organization_memberships m
    where m.user_id = (select auth.uid())
      and m.organization_id = sib_whatsapp_message_log.organization_id
      and m.active = true
      and m.role = any(array['Administrateur','Direction','RH','Comptable']::text[])
  )
);

create index if not exists sib_email_logs_actor_user_id_idx
  on public.sib_email_logs(actor_user_id);
create index if not exists sib_email_logs_organization_id_idx
  on public.sib_email_logs(organization_id);

commit;
