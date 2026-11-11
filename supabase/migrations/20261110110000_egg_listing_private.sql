-- Privata fält för enkla kartannonser flyttas till en egen tabell.
--
-- Bakgrund: manage_token, owner_email, contact_phone och submitted_ip låg på
-- public_egg_sale_listings. anon har kolumnvisa rättigheter där, men
-- authenticated har SELECT på hela tabellen, och då har en kolumnvis REVOKE
-- ingen effekt. En kolumnvis GRANT för authenticated hade i sin tur brutit
-- alla `select('*')` i redan utgivna appversioner. Därför flyttas värdena.
--
-- Efter migrationen:
--   * värdena finns bara i public.egg_listing_private (endast service role),
--   * de gamla kolumnerna finns kvar men är alltid NULL, så befintliga
--     klienter och typer fortsätter fungera,
--   * triggern stoppar varje försök att skriva till de gamla kolumnerna.
--
-- Ordning vid utrullning: deploya map-listing-submit, map-listing-manage och
-- map-listing-verify FÖRST. De klarar båda lägena. Kör sedan migrationen.

CREATE TABLE IF NOT EXISTS public.egg_listing_private (
  listing_id uuid PRIMARY KEY
    REFERENCES public.public_egg_sale_listings(id) ON DELETE CASCADE,
  manage_token uuid UNIQUE,
  owner_email text,
  contact_phone text,
  submitted_ip text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_egg_listing_private_owner_email
  ON public.egg_listing_private (owner_email);

-- Inga policys: RLS nekar då allt för anon och authenticated. Rättigheterna
-- dras dessutom in uttryckligen så att tabellen inte ens syns i deras API.
ALTER TABLE public.egg_listing_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.egg_listing_private FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.egg_listing_private TO service_role;

-- Kopiera och kontrollera i ett block: stämmer inte antalet avbryts allt
-- innan något har tömts.
DO $$
DECLARE
  expected integer;
  copied integer;
BEGIN
  SELECT count(*) INTO expected
  FROM public.public_egg_sale_listings
  WHERE manage_token IS NOT NULL OR owner_email IS NOT NULL
     OR contact_phone IS NOT NULL OR submitted_ip IS NOT NULL;

  INSERT INTO public.egg_listing_private
    (listing_id, manage_token, owner_email, contact_phone, submitted_ip, created_at)
  SELECT id, manage_token, owner_email, contact_phone, submitted_ip, created_at
  FROM public.public_egg_sale_listings
  WHERE manage_token IS NOT NULL OR owner_email IS NOT NULL
     OR contact_phone IS NOT NULL OR submitted_ip IS NOT NULL
  ON CONFLICT (listing_id) DO UPDATE SET
    manage_token  = COALESCE(EXCLUDED.manage_token,  public.egg_listing_private.manage_token),
    owner_email   = COALESCE(EXCLUDED.owner_email,   public.egg_listing_private.owner_email),
    contact_phone = COALESCE(EXCLUDED.contact_phone, public.egg_listing_private.contact_phone),
    submitted_ip  = COALESCE(EXCLUDED.submitted_ip,  public.egg_listing_private.submitted_ip),
    updated_at    = now();

  SELECT count(*) INTO copied
  FROM public.public_egg_sale_listings l
  JOIN public.egg_listing_private p ON p.listing_id = l.id
  WHERE (l.manage_token IS NOT NULL OR l.owner_email IS NOT NULL
         OR l.contact_phone IS NOT NULL OR l.submitted_ip IS NOT NULL)
    AND (l.manage_token  IS NULL OR p.manage_token  = l.manage_token)
    AND (l.owner_email   IS NULL OR p.owner_email   = l.owner_email)
    AND (l.contact_phone IS NULL OR p.contact_phone = l.contact_phone)
    AND (l.submitted_ip  IS NULL OR p.submitted_ip  = l.submitted_ip);

  IF copied <> expected THEN
    RAISE EXCEPTION 'egg_listing_private: % av % rader kopierades, avbryter', copied, expected;
  END IF;
END $$;

-- Triggern krävde tidigare att enkla annonser HADE token och e-post på raden.
-- Nu är kravet det omvända: fälten får aldrig mer skrivas hit. Vid UPDATE
-- stoppas bara nya eller ändrade värden, så att en rad som ännu inte hunnit
-- tömmas inte blockerar orelaterade uppdateringar.
CREATE OR REPLACE FUNCTION public.validate_simple_listing()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  writes_private boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    writes_private := NEW.manage_token IS NOT NULL OR NEW.owner_email IS NOT NULL
      OR NEW.contact_phone IS NOT NULL OR NEW.submitted_ip IS NOT NULL;
  ELSE
    writes_private :=
         (NEW.manage_token  IS NOT NULL AND NEW.manage_token  IS DISTINCT FROM OLD.manage_token)
      OR (NEW.owner_email   IS NOT NULL AND NEW.owner_email   IS DISTINCT FROM OLD.owner_email)
      OR (NEW.contact_phone IS NOT NULL AND NEW.contact_phone IS DISTINCT FROM OLD.contact_phone)
      OR (NEW.submitted_ip  IS NOT NULL AND NEW.submitted_ip  IS DISTINCT FROM OLD.submitted_ip);
  END IF;

  IF writes_private THEN
    RAISE EXCEPTION 'Privata annonsfält lagras i egg_listing_private, inte på annonsen'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

UPDATE public.public_egg_sale_listings
SET manage_token = NULL, owner_email = NULL, contact_phone = NULL, submitted_ip = NULL
WHERE manage_token IS NOT NULL OR owner_email IS NOT NULL
   OR contact_phone IS NOT NULL OR submitted_ip IS NOT NULL;

-- Skräppostspärren "högst tre aktiva annonser per e-post" behöver räkna över
-- båda tabellerna. Endast service role får anropa funktionen.
CREATE OR REPLACE FUNCTION public.simple_listing_active_count(_email text)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.egg_listing_private p
  JOIN public.public_egg_sale_listings l ON l.id = p.listing_id
  WHERE p.owner_email = lower(btrim(_email))
    AND l.listing_kind = 'simple'
    AND l.is_active = true;
$$;
REVOKE ALL ON FUNCTION public.simple_listing_active_count(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.simple_listing_active_count(text) TO service_role;

COMMENT ON TABLE public.egg_listing_private IS
  'Hanteringstoken och kontaktuppgifter för enkla kartannonser. Endast service role.';
COMMENT ON COLUMN public.public_egg_sale_listings.manage_token IS
  'Utfasad, alltid NULL. Värdet finns i egg_listing_private.';
COMMENT ON COLUMN public.public_egg_sale_listings.owner_email IS
  'Utfasad, alltid NULL. Värdet finns i egg_listing_private.';
COMMENT ON COLUMN public.public_egg_sale_listings.contact_phone IS
  'Utfasad, alltid NULL. Värdet finns i egg_listing_private.';
COMMENT ON COLUMN public.public_egg_sale_listings.submitted_ip IS
  'Utfasad, alltid NULL. Värdet finns i egg_listing_private.';
