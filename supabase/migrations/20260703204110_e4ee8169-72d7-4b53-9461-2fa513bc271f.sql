CREATE OR REPLACE FUNCTION public.protect_subscription_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Allow service_role and admins to change anything
  IF auth.role() = 'service_role' OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Regular users: force sensitive billing/subscription fields back to old values
  NEW.subscription_status := OLD.subscription_status;
  NEW.is_lifetime_premium := OLD.is_lifetime_premium;
  NEW.premium_expires_at := OLD.premium_expires_at;
  NEW.referral_code := OLD.referral_code;
  NEW.stripe_customer_id := OLD.stripe_customer_id;

  RETURN NEW;
END;
$function$;