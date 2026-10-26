-- Let a conversation creator add active organization members without relying
-- on the caller's row-level visibility of other users' memberships.
CREATE OR REPLACE FUNCTION public.sib_internal_can_add_conversation_member(
  p_conversation_id uuid,
  p_target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.sib_internal_conversations c
    WHERE c.id = p_conversation_id
      AND public.sib_internal_is_member(c.organization_id)
      AND (
        c.created_by = (SELECT auth.uid())
        OR public.sib_internal_is_admin(c.organization_id)
      )
      AND EXISTS (
        SELECT 1
        FROM public.organization_memberships target_member
        WHERE target_member.organization_id = c.organization_id
          AND target_member.user_id = p_target_user_id
          AND target_member.active = true
      )
  );
$function$;

REVOKE ALL ON FUNCTION public.sib_internal_can_add_conversation_member(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sib_internal_can_add_conversation_member(uuid,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS sib_internal_members_add ON public.sib_internal_conversation_members;
CREATE POLICY sib_internal_members_add
ON public.sib_internal_conversation_members
FOR INSERT TO authenticated
WITH CHECK (
  added_by = (SELECT auth.uid())
  AND public.sib_internal_can_add_conversation_member(conversation_id, user_id)
);
