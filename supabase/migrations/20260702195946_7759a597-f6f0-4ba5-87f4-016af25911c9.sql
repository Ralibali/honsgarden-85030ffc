-- Extend referrals with reward tracking timestamps
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS redeemed_at timestamptz;
ALTER TABLE public.referrals ADD COLUMN IF NOT EXISTS rewarded_at timestamptz;

-- Generate 8-character codes going forward (existing shorter codes stay valid)
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.referral_code IS NULL OR length(NEW.referral_code) = 0 THEN
    NEW.referral_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));
  END IF;
  RETURN NEW;
END;
$function$;

-- Record the referral at signup, but DEFER reward until the referred user logs first egg.
CREATE OR REPLACE FUNCTION public.process_referral(_referral_code text, _new_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  referrer_id uuid;
BEGIN
  SELECT user_id INTO referrer_id FROM public.profiles WHERE referral_code = upper(_referral_code);
  IF referrer_id IS NULL THEN RETURN false; END IF;
  IF referrer_id = _new_user_id THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.referrals WHERE referred_user_id = _new_user_id) THEN RETURN false; END IF;

  INSERT INTO public.referrals (referrer_user_id, referred_user_id, rewarded)
    VALUES (referrer_id, _new_user_id, false);

  UPDATE public.profiles SET referred_by = upper(_referral_code) WHERE user_id = _new_user_id;

  RETURN true;
END;
$function$;

-- Grant reward when the referred user logs their first egg. Cap 12 rewarded referrals per referrer per rolling 365 days.
CREATE OR REPLACE FUNCTION public.grant_referral_reward_for_referred(_referred_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  ref_row public.referrals%ROWTYPE;
  yearly_count int;
BEGIN
  SELECT * INTO ref_row
    FROM public.referrals
    WHERE referred_user_id = _referred_user_id
      AND rewarded = false
    LIMIT 1;
  IF ref_row.id IS NULL THEN RETURN false; END IF;

  SELECT COUNT(*) INTO yearly_count
    FROM public.referrals
    WHERE referrer_user_id = ref_row.referrer_user_id
      AND rewarded = true
      AND rewarded_at > (now() - interval '365 days');

  IF yearly_count >= 12 THEN
    UPDATE public.referrals
      SET redeemed_at = COALESCE(redeemed_at, now())
      WHERE id = ref_row.id;
    RETURN false;
  END IF;

  PERFORM public.grant_premium_days(ref_row.referrer_user_id, 30);
  PERFORM public.grant_premium_days(ref_row.referred_user_id, 30);

  UPDATE public.referrals
    SET rewarded = true,
        rewarded_at = now(),
        redeemed_at = COALESCE(redeemed_at, now())
    WHERE id = ref_row.id;

  RETURN true;
END;
$function$;

-- Trigger: on first egg log by a user, try to grant referral reward.
CREATE OR REPLACE FUNCTION public.trigger_referral_on_first_egg()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  prior_count int;
BEGIN
  IF NEW.user_id IS NULL THEN RETURN NEW; END IF;
  SELECT COUNT(*) INTO prior_count
    FROM public.egg_logs
    WHERE user_id = NEW.user_id
      AND id <> NEW.id;
  IF prior_count = 0 THEN
    PERFORM public.grant_referral_reward_for_referred(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS referral_reward_on_first_egg ON public.egg_logs;
CREATE TRIGGER referral_reward_on_first_egg
  AFTER INSERT ON public.egg_logs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_referral_on_first_egg();

-- Helpful indexes for admin stats + trigger lookups
CREATE INDEX IF NOT EXISTS referrals_referrer_rewarded_at_idx
  ON public.referrals (referrer_user_id, rewarded_at DESC);
CREATE INDEX IF NOT EXISTS referrals_created_at_idx
  ON public.referrals (created_at DESC);