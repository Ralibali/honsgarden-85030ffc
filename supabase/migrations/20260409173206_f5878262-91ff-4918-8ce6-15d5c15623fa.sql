
-- Prevent accidental NULL of premium_expires_at when status is premium
CREATE OR REPLACE FUNCTION public.guard_premium_expires_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- If status is being set to 'premium' and expires_at is NULL,
  -- but old row had a valid expires_at, keep the old value.
  -- This prevents accidental NULL from partial updates.
  -- Service role can explicitly set lifetime premium by setting status='premium'
  -- on a row that never had premium_expires_at.
  IF NEW.subscription_status = 'premium'
     AND NEW.premium_expires_at IS NULL
     AND OLD.premium_expires_at IS NOT NULL
  THEN
    NEW.premium_expires_at := OLD.premium_expires_at;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_premium_expires_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_premium_expires_at();
