
-- Revoke read access to sensitive columns for anonymous and authenticated roles.
-- Service role (edge functions) is unaffected and remains the only path to read these fields.
REVOKE SELECT (manage_token, owner_email, contact_phone, submitted_ip)
  ON public.public_egg_sale_listings FROM anon;

REVOKE SELECT (manage_token, owner_email, contact_phone, submitted_ip)
  ON public.public_egg_sale_listings FROM authenticated;
