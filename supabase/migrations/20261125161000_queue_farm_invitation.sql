-- A queue error rolls back the invitation, so the owner can retry the same address.
CREATE FUNCTION public.queue_farm_invitation(
  p_farm_id uuid, p_invited_by uuid, p_email text, p_role text, p_token text, p_message jsonb
) RETURNS bigint LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  queue_id bigint;
BEGIN
  -- Serialize two submissions for the same farm and recipient.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_farm_id::text || lower(p_email), 0));

  IF NOT EXISTS (
    SELECT 1 FROM public.farm_members
    WHERE farm_id = p_farm_id AND user_id = p_invited_by AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'An invitation requires the farm owner';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.farm_invitations
    WHERE farm_id = p_farm_id AND lower(email) = lower(p_email)
      AND status = 'pending' AND expires_at > now()
  ) THEN
    RAISE EXCEPTION 'An active invitation already exists' USING ERRCODE = 'PT409';
  END IF;

  INSERT INTO public.farm_invitations (farm_id, invited_by, email, role, token)
  VALUES (p_farm_id, p_invited_by, lower(p_email), p_role, p_token);

  queue_id := public.enqueue_email('transactional_emails', p_message);
  IF queue_id IS NULL THEN RAISE EXCEPTION 'Email was not queued'; END IF;
  RETURN queue_id;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_farm_invitation(uuid, uuid, text, text, text, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.queue_farm_invitation(uuid, uuid, text, text, text, jsonb)
  TO service_role;
