
CREATE OR REPLACE FUNCTION public.protect_referral_reward_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.rewarded := false;
    NEW.rewarded_at := NULL;
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.rewarded := OLD.rewarded;
    NEW.rewarded_at := OLD.rewarded_at;
    NEW.referrer_user_id := OLD.referrer_user_id;
    NEW.referred_user_id := OLD.referred_user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_referral_reward_fields_trigger ON public.referrals;
CREATE TRIGGER protect_referral_reward_fields_trigger
BEFORE INSERT OR UPDATE ON public.referrals
FOR EACH ROW EXECUTE FUNCTION public.protect_referral_reward_fields();
