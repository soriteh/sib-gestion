-- Create internal conversations atomically through a narrowly scoped RPC.
-- This avoids INSERT ... RETURNING failures caused by RLS SELECT checks and
-- prevents orphan conversations if member insertion fails.
CREATE OR REPLACE FUNCTION public.sib_internal_create_conversation(
  p_organization_id uuid,
  p_title text,
  p_member_ids uuid[],
  p_conversation_type text DEFAULT 'group'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user uuid := (SELECT auth.uid());
  v_conversation_id uuid;
  v_member_count integer;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentification requise' USING ERRCODE = '28000';
  END IF;

  IF p_conversation_type NOT IN ('direct', 'group') THEN
    RAISE EXCEPTION 'Type de conversation invalide' USING ERRCODE = '22023';
  END IF;

  IF p_title IS NULL OR length(trim(p_title)) NOT BETWEEN 1 AND 160 THEN
    RAISE EXCEPTION 'Le titre doit contenir entre 1 et 160 caractères' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organization_memberships m
    WHERE m.organization_id = p_organization_id
      AND m.user_id = v_user AND m.active = true
  ) THEN
    RAISE EXCEPTION 'Appartenance active à l’organisation requise' USING ERRCODE = '42501';
  END IF;

  IF p_member_ids IS NULL OR cardinality(p_member_ids) = 0 THEN
    RAISE EXCEPTION 'Sélectionnez au moins un autre membre' USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT x.user_id) INTO v_member_count
  FROM unnest(p_member_ids) AS x(user_id)
  WHERE x.user_id <> v_user;

  IF v_member_count = 0 THEN
    RAISE EXCEPTION 'Sélectionnez au moins un autre membre' USING ERRCODE = '22023';
  END IF;

  IF p_conversation_type = 'direct' AND v_member_count <> 1 THEN
    RAISE EXCEPTION 'Une conversation privée doit avoir exactement deux participants' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (SELECT DISTINCT x.user_id FROM unnest(p_member_ids) AS x(user_id)) selected
    WHERE selected.user_id <> v_user
      AND NOT EXISTS (
        SELECT 1 FROM public.organization_memberships m
        WHERE m.organization_id = p_organization_id
          AND m.user_id = selected.user_id
          AND m.active = true
      )
  ) THEN
    RAISE EXCEPTION 'Un participant n’est pas membre actif de cette organisation' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.sib_internal_conversations
    (organization_id, title, conversation_type, created_by)
  VALUES
    (p_organization_id, trim(p_title), p_conversation_type, v_user)
  RETURNING id INTO v_conversation_id;

  INSERT INTO public.sib_internal_conversation_members
    (conversation_id, user_id, added_by)
  SELECT v_conversation_id, v_user, v_user
  UNION
  SELECT v_conversation_id, DISTINCT_MEMBER.user_id, v_user
  FROM (
    SELECT DISTINCT x.user_id
    FROM unnest(p_member_ids) AS x(user_id)
    WHERE x.user_id <> v_user
  ) AS DISTINCT_MEMBER;

  RETURN v_conversation_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.sib_internal_create_conversation(uuid,text,uuid[],text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sib_internal_create_conversation(uuid,text,uuid[],text) TO authenticated, service_role;
