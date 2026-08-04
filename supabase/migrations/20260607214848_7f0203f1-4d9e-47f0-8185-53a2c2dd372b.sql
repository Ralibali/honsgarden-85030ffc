
-- =============================================================================
-- 1. MARKETPLACE_LISTINGS
-- =============================================================================
CREATE TABLE public.marketplace_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (length(title) BETWEEN 3 AND 120),
  description text NOT NULL CHECK (length(description) BETWEEN 10 AND 5000),
  category text NOT NULL CHECK (category IN (
    'hons-kycklingar','tuppar','klackagg','andra-djur',
    'honshus-inredning','foder-tillskott','maskiner-redskap',
    'stangsel','ovrigt','skankes','kopes'
  )),
  price numeric(10,2) CHECK (price IS NULL OR price >= 0),
  currency text NOT NULL DEFAULT 'SEK',
  is_giveaway boolean NOT NULL DEFAULT false,
  condition text CHECK (condition IS NULL OR condition IN ('nytt','begagnat','skick-ej-angivet')),
  region text,
  city text,
  postal_code text CHECK (postal_code IS NULL OR postal_code ~ '^[0-9 ]{0,10}$'),
  image_urls text[] NOT NULL DEFAULT '{}' CHECK (array_length(image_urls,1) IS NULL OR array_length(image_urls,1) <= 8),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','expired','draft','hidden')),
  slug text UNIQUE NOT NULL,
  view_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '60 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_marketplace_listings_status_created ON public.marketplace_listings (status, created_at DESC);
CREATE INDEX idx_marketplace_listings_category ON public.marketplace_listings (category) WHERE status = 'active';
CREATE INDEX idx_marketplace_listings_user ON public.marketplace_listings (user_id);
CREATE INDEX idx_marketplace_listings_slug ON public.marketplace_listings (slug);
CREATE INDEX idx_marketplace_listings_region ON public.marketplace_listings (region) WHERE status = 'active';
CREATE INDEX idx_marketplace_listings_search ON public.marketplace_listings USING gin (to_tsvector('swedish', coalesce(title,'') || ' ' || coalesce(description,'')));

GRANT SELECT ON public.marketplace_listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketplace_listings TO authenticated;
GRANT ALL ON public.marketplace_listings TO service_role;

ALTER TABLE public.marketplace_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone reads active listings"
  ON public.marketplace_listings FOR SELECT
  USING (status IN ('active','sold') OR auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users insert own listings"
  ON public.marketplace_listings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own listings"
  ON public.marketplace_listings FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users delete own listings"
  ON public.marketplace_listings FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================================================
-- 2. MARKETPLACE_MESSAGES
-- =============================================================================
CREATE TABLE public.marketplace_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (sender_user_id <> recipient_user_id)
);

CREATE INDEX idx_marketplace_messages_listing ON public.marketplace_messages (listing_id, created_at DESC);
CREATE INDEX idx_marketplace_messages_recipient ON public.marketplace_messages (recipient_user_id, read_at);
CREATE INDEX idx_marketplace_messages_thread ON public.marketplace_messages (listing_id, sender_user_id, recipient_user_id);

GRANT SELECT, INSERT, UPDATE ON public.marketplace_messages TO authenticated;
GRANT ALL ON public.marketplace_messages TO service_role;

ALTER TABLE public.marketplace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own messages"
  ON public.marketplace_messages FOR SELECT TO authenticated
  USING (auth.uid() = sender_user_id OR auth.uid() = recipient_user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users send own messages"
  ON public.marketplace_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_user_id
    AND EXISTS (
      SELECT 1 FROM public.marketplace_listings l
      WHERE l.id = listing_id AND l.user_id = recipient_user_id AND l.status = 'active'
    )
  );

CREATE POLICY "Recipients mark read"
  ON public.marketplace_messages FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

-- =============================================================================
-- 3. MARKETPLACE_REPORTS
-- =============================================================================
CREATE TABLE public.marketplace_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.marketplace_listings(id) ON DELETE CASCADE,
  reported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (length(reason) BETWEEN 3 AND 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed','removed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.marketplace_reports TO authenticated;
GRANT ALL ON public.marketplace_reports TO service_role;

ALTER TABLE public.marketplace_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own reports"
  ON public.marketplace_reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Admins read all reports"
  ON public.marketplace_reports FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update reports"
  ON public.marketplace_reports FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- =============================================================================
-- 4. SLUG GENERATOR
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_marketplace_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _base text;
  _slug text;
  _suffix text;
  _attempts int := 0;
BEGIN
  IF NEW.slug IS NOT NULL AND length(NEW.slug) > 0 THEN
    RETURN NEW;
  END IF;

  _base := lower(coalesce(NEW.category, 'annons')) || '-' ||
           regexp_replace(
             lower(unaccent(coalesce(NEW.title, 'annons'))),
             '[^a-z0-9]+', '-', 'g'
           );
  _base := regexp_replace(_base, '^-+|-+$', '', 'g');
  IF length(_base) > 80 THEN _base := substr(_base, 1, 80); END IF;

  LOOP
    _suffix := substr(md5(NEW.id::text || _attempts::text || now()::text), 1, 6);
    _slug := _base || '-' || _suffix;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.marketplace_listings WHERE slug = _slug);
    _attempts := _attempts + 1;
    EXIT WHEN _attempts > 5;
  END LOOP;

  NEW.slug := _slug;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_listings_slug
BEFORE INSERT ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.generate_marketplace_slug();

-- Need unaccent for nice slugs
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =============================================================================
-- 5. RATE-LIMIT TRIGGER (max 5 nya annonser/dygn per user)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.enforce_marketplace_listing_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count int;
BEGIN
  IF auth.role() = 'service_role' OR public.has_role(NEW.user_id, 'admin'::app_role) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _count
  FROM public.marketplace_listings
  WHERE user_id = NEW.user_id AND created_at >= now() - interval '24 hours';

  IF _count >= 5 THEN
    RAISE EXCEPTION 'Du kan publicera max 5 annonser per dygn. Försök igen imorgon.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_listings_rate_limit
BEFORE INSERT ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.enforce_marketplace_listing_limit();

-- =============================================================================
-- 6. UPDATED_AT TRIGGER
-- =============================================================================
CREATE TRIGGER trg_marketplace_listings_updated_at
BEFORE UPDATE ON public.marketplace_listings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================================================
-- 7. NOTIFY SELLER ON FIRST MESSAGE
-- =============================================================================
CREATE OR REPLACE FUNCTION public.notify_seller_on_marketplace_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _seller_email text;
  _seller_name text;
  _sender_name text;
  _listing_title text;
  _listing_slug text;
  _msg_id text;
  _is_first boolean;
BEGIN
  -- Bara mejla på första meddelandet i tråden
  SELECT NOT EXISTS (
    SELECT 1 FROM public.marketplace_messages
    WHERE listing_id = NEW.listing_id
      AND sender_user_id = NEW.sender_user_id
      AND id <> NEW.id
  ) INTO _is_first;

  IF NOT _is_first THEN RETURN NEW; END IF;

  SELECT email, COALESCE(display_name, split_part(email,'@',1),'där')
  INTO _seller_email, _seller_name
  FROM public.profiles WHERE user_id = NEW.recipient_user_id;

  SELECT COALESCE(display_name, split_part(email,'@',1),'En användare')
  INTO _sender_name
  FROM public.profiles WHERE user_id = NEW.sender_user_id;

  SELECT title, slug INTO _listing_title, _listing_slug
  FROM public.marketplace_listings WHERE id = NEW.listing_id;

  -- 1. In-app-notis
  INSERT INTO public.user_notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.recipient_user_id,
    'marketplace_message',
    'Nytt meddelande om "' || COALESCE(_listing_title,'annons') || '"',
    _sender_name || ': ' || substring(NEW.content from 1 for 120),
    '/app/marknad/mina',
    jsonb_build_object('listing_id', NEW.listing_id, 'sender_id', NEW.sender_user_id)
  );

  -- 2. Mejl
  IF _seller_email IS NOT NULL THEN
    _msg_id := 'mkt-msg-' || NEW.id::text || '-' || extract(epoch from now())::bigint::text;
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'run_id', gen_random_uuid()::text,
        'to', _seller_email,
        'from', 'Hönsgården <noreply@notify.honsgarden.se>',
        'sender_domain', 'notify.honsgarden.se',
        'subject', _sender_name || ' är intresserad av "' || COALESCE(_listing_title,'din annons') || '"',
        'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">'
          || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />'
          || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ' || _seller_name || '!</h1>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;"><strong>' || _sender_name || '</strong> har skickat ett meddelande om din annons <em>"' || COALESCE(_listing_title,'') || '"</em>:</p>'
          || '<div style="background: hsl(35,32%,97%); border-left: 3px solid hsl(142,32%,34%); padding: 14px 18px; margin: 0 0 22px; border-radius: 8px;">'
          || '<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);line-height:1.6;">' || substring(NEW.content from 1 for 400) || CASE WHEN length(NEW.content)>400 THEN '...' ELSE '' END || '</p>'
          || '</div>'
          || '<a href="https://honsgarden.lovable.app/app/marknad/mina" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Svara på Hönsgården →</a>'
          || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att någon kontaktat dig om en av dina marknadsannonser.</p>'
          || '</div>',
        'text', _sender_name || ' skrev: ' || NEW.content || ' — Svara: https://honsgarden.lovable.app/app/marknad/mina',
        'purpose', 'transactional',
        'label', 'marketplace-new-message',
        'message_id', _msg_id,
        'queued_at', now()::text
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_marketplace_message_notify
AFTER INSERT ON public.marketplace_messages
FOR EACH ROW EXECUTE FUNCTION public.notify_seller_on_marketplace_message();

-- =============================================================================
-- 8. VIEW COUNTER (publik säker funktion)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.increment_marketplace_view(_slug text)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marketplace_listings
  SET view_count = view_count + 1
  WHERE slug = _slug AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.increment_marketplace_view(text) TO anon, authenticated;

-- =============================================================================
-- 9. CRON-FRIENDLY EXPIRY FUNCTION (kan triggas av cron senare)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.expire_marketplace_listings()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.marketplace_listings
  SET status = 'expired'
  WHERE status = 'active' AND expires_at < now();
$$;
