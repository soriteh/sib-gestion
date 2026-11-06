-- Fix a tautological membership predicate that could let any conversation member
-- send into a conversation they do not belong to.
drop policy if exists sib_internal_messages_send on public.sib_internal_messages;
create policy sib_internal_messages_send
on public.sib_internal_messages
for insert
to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.sib_internal_conversation_members cm
    where cm.conversation_id = sib_internal_messages.conversation_id
      and cm.user_id = (select auth.uid())
  )
);
