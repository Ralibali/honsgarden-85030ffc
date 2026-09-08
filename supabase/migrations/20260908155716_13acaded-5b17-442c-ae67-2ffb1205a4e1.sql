CREATE OR REPLACE FUNCTION public.claim_achievement_reward(_achievement_id text, _tier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  days integer;
  already integer;
  inserted boolean := false;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF _achievement_id IS NULL OR length(trim(_achievement_id)) = 0 OR length(_achievement_id) > 100 THEN
    RAISE EXCEPTION 'invalid achievement id';
  END IF;

  days := CASE lower(coalesce(_tier, ''))
    WHEN 'bronze' THEN 1
    WHEN 'silver' THEN 2
    WHEN 'gold' THEN 3
    WHEN 'diamond' THEN 5
    ELSE NULL
  END;
  IF days IS NULL THEN
    RAISE EXCEPTION 'invalid tier';
  END IF;

  INSERT INTO public.achievement_rewards (user_id, achievement_id)
  VALUES (uid, _achievement_id)
  ON CONFLICT (user_id, achievement_id) DO NOTHING;

  inserted := FOUND;
  IF NOT inserted THEN
    RETURN jsonb_build_object('inserted', false, 'granted_days', 0);
  END IF;

  SELECT coalesce(sum(granted_days), 0) INTO already
  FROM public.achievement_rewards
  WHERE user_id = uid;

  IF already + days > 7 THEN
    days := 0;
  END IF;

  IF days > 0 THEN
    UPDATE public.achievement_rewards
    SET granted_days = days
    WHERE user_id = uid AND achievement_id = _achievement_id;
    PERFORM public.grant_premium_days(uid, days);
  END IF;

  RETURN jsonb_build_object('inserted', true, 'granted_days', days);
END;
$$;

ALTER TABLE public.achievement_rewards
  ADD COLUMN IF NOT EXISTS granted_days integer NOT NULL DEFAULT 0;

GRANT EXECUTE ON FUNCTION public.claim_achievement_reward(text, text) TO authenticated;