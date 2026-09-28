ALTER TABLE public.newsletter_subscribers
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirm_token uuid,
  ADD COLUMN IF NOT EXISTS confirmation_sent_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_confirm_token_idx
  ON public.newsletter_subscribers(confirm_token) WHERE confirm_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS newsletter_normalized_email_idx
  ON public.newsletter_subscribers(lower(btrim(email)));

-- The only client write caller is NewsletterSignup, which supplies email only.
-- Admin SELECT keeps the public metadata, never a confirmation bearer token.
REVOKE INSERT, UPDATE, SELECT ON TABLE public.newsletter_subscribers FROM PUBLIC, anon, authenticated;
REVOKE INSERT (confirmed_at, confirm_token, confirmation_sent_at),
  UPDATE (confirmed_at, confirm_token, confirmation_sent_at),
  SELECT (confirm_token) ON public.newsletter_subscribers FROM PUBLIC, anon, authenticated;
GRANT INSERT (email) ON public.newsletter_subscribers TO anon, authenticated;
GRANT SELECT (id, email, created_at, confirmed_at, confirmation_sent_at)
  ON public.newsletter_subscribers TO authenticated;

CREATE OR REPLACE FUNCTION public.request_newsletter_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing public.newsletter_subscribers%ROWTYPE;
  _token uuid;
  _url text;
BEGIN
  NEW.email := lower(btrim(NEW.email));
  IF NEW.email IS NULL OR length(NEW.email) > 254
    OR NEW.email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Ange en giltig e-postadress' USING ERRCODE = '23514';
  END IF;
  -- Serialize new subscriptions and resends for the same normalized address.
  PERFORM pg_advisory_xact_lock(hashtextextended('newsletter:' || NEW.email, 0));
  SELECT * INTO _existing FROM public.newsletter_subscribers
    WHERE lower(btrim(email)) = NEW.email
    ORDER BY confirmed_at DESC NULLS LAST, created_at
    LIMIT 1 FOR UPDATE;
  IF FOUND AND (_existing.confirmed_at IS NOT NULL
    OR _existing.confirmation_sent_at > now() - interval '24 hours') THEN
    RETURN NULL;
  END IF;

  _token := gen_random_uuid();
  IF _existing.id IS NOT NULL THEN
    UPDATE public.newsletter_subscribers
      SET confirm_token = _token, confirmation_sent_at = now()
      WHERE id = _existing.id;
  ELSE
    NEW.created_at := now();
    NEW.confirmed_at := NULL;
    NEW.confirm_token := _token;
    NEW.confirmation_sent_at := now();
  END IF;
  _url := 'https://honsgarden.se/blogg#newsletter-confirm=' || _token::text;
  PERFORM public.enqueue_email('transactional_emails', jsonb_build_object(
    'to', NEW.email,
    'from', 'Hönsgården <noreply@notify.honsgarden.se>',
    'subject', 'Bekräfta din prenumeration på Hönsgårdens nyhetsbrev',
    'html', '<p>Bekräfta att du vill få Hönsgårdens nyhetsbrev.</p><p><a href="'
      || public.html_escape(_url) || '">Bekräfta prenumerationen</a></p>'
      || '<p>Om du inte har bett om detta kan du ignorera mejlet.</p>',
    'text', 'Bekräfta din prenumeration: ' || _url
      || E'\nOm du inte har bett om detta kan du ignorera mejlet.',
    'message_id', 'newsletter-confirm-' || _token::text,
    'label', 'newsletter-confirmation'
  ));
  IF _existing.id IS NOT NULL THEN RETURN NULL; END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.request_newsletter_confirmation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_newsletter_confirmation() TO service_role;
DROP TRIGGER IF EXISTS newsletter_confirmation ON public.newsletter_subscribers;
CREATE TRIGGER newsletter_confirmation BEFORE INSERT ON public.newsletter_subscribers
  FOR EACH ROW EXECUTE FUNCTION public.request_newsletter_confirmation();

CREATE OR REPLACE FUNCTION public.confirm_newsletter(p_token uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.newsletter_subscribers
    SET confirmed_at = now(), confirm_token = NULL
    WHERE confirm_token = p_token AND confirmed_at IS NULL;
  RETURN FOUND;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.confirm_newsletter(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_newsletter(uuid) TO anon, authenticated, service_role;
