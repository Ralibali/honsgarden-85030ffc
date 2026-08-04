-- 1. Lägg till kolumnen
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_lifetime_premium boolean NOT NULL DEFAULT false;

-- 2. Backfilla: alla nuvarande premium-profiler utan slutdatum betraktas som livstid
UPDATE public.profiles
SET is_lifetime_premium = true
WHERE subscription_status = 'premium'
  AND premium_expires_at IS NULL
  AND is_lifetime_premium = false;

-- 3. Uppdatera guard-triggern att respektera flaggan
CREATE OR REPLACE FUNCTION public.guard_premium_expires_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Om livstidsflagga är PÅ: tvinga premium + NULL expires_at
  IF NEW.is_lifetime_premium = true THEN
    NEW.subscription_status := 'premium';
    NEW.premium_expires_at := NULL;
    RETURN NEW;
  END IF;

  -- Om status sätts till premium men expires_at blivit NULL,
  -- och OLD hade ett giltigt slutdatum, behåll det gamla värdet.
  -- Detta skyddar mot oavsiktliga partial updates.
  IF NEW.subscription_status = 'premium'
     AND NEW.premium_expires_at IS NULL
     AND OLD.premium_expires_at IS NOT NULL
     AND OLD.is_lifetime_premium = false
  THEN
    NEW.premium_expires_at := OLD.premium_expires_at;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Säkerställ att triggern är aktiv
DROP TRIGGER IF EXISTS guard_premium_expires_at_trigger ON public.profiles;
CREATE TRIGGER guard_premium_expires_at_trigger
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_premium_expires_at();

-- 5. Hjälpfunktion för att sätta/ta bort livstid (säker att kalla från admin/edge)
CREATE OR REPLACE FUNCTION public.set_lifetime_premium(_user_id uuid, _is_lifetime boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF _is_lifetime THEN
    UPDATE public.profiles
    SET is_lifetime_premium = true,
        subscription_status = 'premium',
        premium_expires_at = NULL
    WHERE user_id = _user_id;
  ELSE
    UPDATE public.profiles
    SET is_lifetime_premium = false
    WHERE user_id = _user_id;
  END IF;
END;
$function$;