-- Fix recursive RLS policies in internal communications.
-- The conversation policy queried conversation_members, while the member policy
-- queried conversations, causing PostgreSQL error 42P17 on real authenticated requests.
-- These SECURITY DEFINER helpers perform only scoped boolean checks and avoid
-- evaluating either table's RLS policies recursively.

CREATE OR REPLACE FUNCTION public.sib_internal_can_read_conversation(p_conversation uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.sib_internal_conversations c
    WHERE c.id = p_conversation
      AND public.sib_internal_is_member(c.organization_id)
      AND (
        c.created_by = (SELECT auth.uid())
        OR public.sib_internal_is_admin(c.organization_id)
        OR EXISTS (
          SELECT 1
          FROM public.sib_internal_conversation_members cm
          WHERE cm.conversation_id = c.id
            AND cm.user_id = (SELECT auth.uid())
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.sib_internal_can_read_conversation_members(p_conversation uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.sib_internal_conversations c
    WHERE c.id = p_conversation
      AND public.sib_internal_is_admin(c.organization_id)
  );
$function$;

REVOKE ALL ON FUNCTION public.sib_internal_can_read_conversation(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sib_internal_can_read_conversation_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sib_internal_can_read_conversation(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sib_internal_can_read_conversation_members(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS sib_internal_conversations_read ON public.sib_internal_conversations;
CREATE POLICY sib_internal_conversations_read
ON public.sib_internal_conversations
FOR SELECT TO authenticated
USING (public.sib_internal_can_read_conversation(id));

DROP POLICY IF EXISTS sib_internal_members_read ON public.sib_internal_conversation_members;
CREATE POLICY sib_internal_members_read
ON public.sib_internal_conversation_members
FOR SELECT TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR public.sib_internal_can_read_conversation_members(conversation_id)
);
