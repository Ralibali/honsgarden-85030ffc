-- Revoke access to sensitive columns on public_egg_sale_listings from anon/authenticated.
-- These fields must never be readable by public/authenticated visitors; only owners
-- and admins access them server-side via service_role (edge functions).
REVOKE SELECT (manage_token, owner_email, submitted_ip)
  ON public.public_egg_sale_listings FROM anon;
REVOKE SELECT (manage_token, owner_email, submitted_ip)
  ON public.public_egg_sale_listings FROM authenticated;

-- Make sure service_role retains full access.
GRANT SELECT ON public.public_egg_sale_listings TO service_role;

-- Remove the table from the Supabase Realtime publication so these
-- sensitive columns are not broadcast to any realtime subscriber.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'public_egg_sale_listings'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime DROP TABLE public.public_egg_sale_listings';
  END IF;
END $$;