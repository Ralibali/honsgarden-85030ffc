CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
BEGIN
  IF NEW.referral_code IS NULL OR length(NEW.referral_code) = 0 THEN
    NEW.referral_code := upper(substr(md5(random()::text || clock_timestamp()::text || NEW.user_id::text), 1, 8));
  END IF;
  RETURN NEW;
END;
$function$;