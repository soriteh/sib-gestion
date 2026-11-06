-- Permit INSERT ... RETURNING for a conversation creator without recursive table lookups.
-- PostgreSQL's RLS SELECT check for RETURNING may run before a query inside a
-- helper can observe the newly inserted row. Pass row fields directly instead.
CREATE OR REPLACE FUNCTION public.sib_internal_can_read_conversation_row(
  p_organization_id uuid,
  p_created_by uuid,
  p_conversation_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
BEGIN
  IF v_user IS NULL OR NOT public.sib_internal_is_member(p_organization_id) THEN
    RETURN false;
  END IF;

  IF p_created_by = v_user OR public.sib_internal_is_admin(p_organization_id) THEN
    RETURN true;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.sib_internal_conversation_members cm
    WHERE cm.conversation_id = p_conversation_id
      AND cm.user_id = v_user
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sib_internal_can_read_conversation_row(uuid,uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sib_internal_can_read_conversation_row(uuid,uuid,uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS sib_internal_conversations_read ON public.sib_internal_conversations;
CREATE POLICY sib_internal_conversations_read
ON public.sib_internal_conversations
FOR SELECT TO authenticated
USING (
  public.sib_internal_can_read_conversation_row(organization_id, created_by, id)
);
