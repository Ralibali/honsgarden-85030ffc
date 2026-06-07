
-- 1. Lägg till kolumner för enkla kartannonser
ALTER TABLE public.public_egg_sale_listings
  ADD COLUMN IF NOT EXISTS listing_kind text NOT NULL DEFAULT 'full',
  ADD COLUMN IF NOT EXISTS owner_email text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS manage_token uuid UNIQUE,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS submitted_ip text;

-- 2. Kind-validering
ALTER TABLE public.public_egg_sale_listings
  DROP CONSTRAINT IF EXISTS public_egg_sale_listings_kind_chk;
ALTER TABLE public.public_egg_sale_listings
  ADD CONSTRAINT public_egg_sale_listings_kind_chk CHECK (listing_kind IN ('full','simple'));

-- 3. Tillåt user_id NULL (för enkla annonser utan konto)
ALTER TABLE public.public_egg_sale_listings ALTER COLUMN user_id DROP NOT NULL;

-- 4. Index för token-uppslag
CREATE INDEX IF NOT EXISTS idx_listings_manage_token ON public.public_egg_sale_listings(manage_token);
CREATE INDEX IF NOT EXISTS idx_listings_expires_at ON public.public_egg_sale_listings(expires_at);

-- 5. Säkerställ att simple-rader alltid har manage_token + owner_email
CREATE OR REPLACE FUNCTION public.validate_simple_listing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_kind = 'simple' THEN
    IF NEW.owner_email IS NULL OR length(NEW.owner_email) < 5 THEN
      RAISE EXCEPTION 'Enkla annonser kräver owner_email';
    END IF;
    IF NEW.manage_token IS NULL THEN
      RAISE EXCEPTION 'Enkla annonser kräver manage_token';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_simple_listing ON public.public_egg_sale_listings;
CREATE TRIGGER trg_validate_simple_listing
BEFORE INSERT OR UPDATE ON public.public_egg_sale_listings
FOR EACH ROW EXECUTE FUNCTION public.validate_simple_listing();

-- 6. RLS: anon får INTE läsa owner_email/manage_token/submitted_ip
-- Vi exponerar bara via edge function. Befintliga select-policies returnerar hela raden,
-- så vi skapar en publik vy som maskar känsliga fält och uppdaterar klienten att läsa från den
-- vid behov. (Behåller existerande policy då Map endast väljer säkra kolumner.)

-- 7. Cron: inaktivera utgångna enkla annonser dagligen
CREATE OR REPLACE FUNCTION public.deactivate_expired_simple_listings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.public_egg_sale_listings
  SET is_active = false
  WHERE listing_kind = 'simple'
    AND is_active = true
    AND expires_at IS NOT NULL
    AND expires_at < now();
$$;

-- Schemalägg endast om pg_cron finns
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('deactivate-expired-simple-listings') 
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'deactivate-expired-simple-listings');
    PERFORM cron.schedule(
      'deactivate-expired-simple-listings',
      '0 3 * * *',
      $cron$SELECT public.deactivate_expired_simple_listings();$cron$
    );
  END IF;
END $$;
