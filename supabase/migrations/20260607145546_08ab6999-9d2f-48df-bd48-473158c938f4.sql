-- 1. Realtime för bokningar och listings
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.public_egg_sale_bookings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.public_egg_sale_listings;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.public_egg_sale_bookings REPLICA IDENTITY FULL;
ALTER TABLE public.public_egg_sale_listings REPLICA IDENTITY FULL;

-- 2. Abonnemangstabell
CREATE TABLE IF NOT EXISTS public.egg_sale_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.public_egg_sale_listings(id) ON DELETE CASCADE,
  seller_user_id uuid NOT NULL,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text,
  packs integer NOT NULL DEFAULT 1 CHECK (packs > 0),
  frequency text NOT NULL CHECK (frequency IN ('weekly','biweekly','monthly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  next_run_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  last_booking_id uuid,
  total_bookings integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.egg_sale_subscriptions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.egg_sale_subscriptions TO authenticated;
GRANT ALL ON public.egg_sale_subscriptions TO service_role;

ALTER TABLE public.egg_sale_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create subscription" ON public.egg_sale_subscriptions
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Seller views own subscriptions" ON public.egg_sale_subscriptions
  FOR SELECT TO authenticated USING (seller_user_id = auth.uid());
CREATE POLICY "Seller manages own subscriptions" ON public.egg_sale_subscriptions
  FOR UPDATE TO authenticated USING (seller_user_id = auth.uid()) WITH CHECK (seller_user_id = auth.uid());
CREATE POLICY "Seller deletes own subscriptions" ON public.egg_sale_subscriptions
  FOR DELETE TO authenticated USING (seller_user_id = auth.uid());

CREATE INDEX idx_egg_subs_seller ON public.egg_sale_subscriptions(seller_user_id, status);
CREATE INDEX idx_egg_subs_next_run ON public.egg_sale_subscriptions(next_run_at) WHERE status = 'active';

CREATE TRIGGER trg_egg_subs_updated_at
BEFORE UPDATE ON public.egg_sale_subscriptions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Uppdaterat bekräftelsemejl med Google Maps-länk
CREATE OR REPLACE FUNCTION public.send_booking_confirmation_to_buyer()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _listing RECORD;
  _slot RECORD;
  _cancel_token text;
  _cancel_link text;
  _amount numeric;
  _swish_msg text;
  _slot_text text := '';
  _pickup_info text := '';
  _message_id text;
  _maps_link text := '';
  _maps_html text := '';
  _maps_target text;
BEGIN
  IF NEW.customer_email IS NULL OR length(NEW.customer_email) < 5 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _listing FROM public.public_egg_sale_listings WHERE id = NEW.listing_id;
  IF _listing IS NULL THEN RETURN NEW; END IF;

  IF NEW.pickup_slot_id IS NOT NULL THEN
    SELECT * INTO _slot FROM public.egg_sale_pickup_slots WHERE id = NEW.pickup_slot_id;
    IF _slot IS NOT NULL THEN
      _slot_text := to_char(_slot.starts_at AT TIME ZONE 'Europe/Stockholm', 'YYYY-MM-DD HH24:MI')
        || ' – ' || to_char(_slot.ends_at AT TIME ZONE 'Europe/Stockholm', 'HH24:MI');
    END IF;
  END IF;

  SELECT token INTO _cancel_token FROM public.egg_sale_booking_tokens WHERE booking_id = NEW.id;
  _cancel_link := 'https://honsgarden.lovable.app/avboka/' || COALESCE(_cancel_token, '');

  _amount := NEW.packs * COALESCE(_listing.price_per_pack, 0);
  _swish_msg := COALESCE(_listing.swish_message, 'Äggbokning') || ' ' || NEW.customer_name;
  _pickup_info := COALESCE(_listing.pickup_info, '');

  -- Bygg Google Maps-länk (lat/lng helst, annars location + pickup_info)
  IF _listing.latitude IS NOT NULL AND _listing.longitude IS NOT NULL THEN
    _maps_link := 'https://www.google.com/maps/dir/?api=1&destination='
      || _listing.latitude::text || ',' || _listing.longitude::text;
  ELSE
    _maps_target := trim(COALESCE(_listing.location, '') || ' ' || COALESCE(_listing.pickup_info, ''));
    IF length(_maps_target) > 2 THEN
      _maps_link := 'https://www.google.com/maps/dir/?api=1&destination='
        || replace(replace(_maps_target, ' ', '+'), E'\n', '+');
    END IF;
  END IF;

  IF _maps_link <> '' THEN
    _maps_html := '<p style="margin:14px 0 6px;font-size:13px;color:hsl(22,12%,44%);">Vägbeskrivning</p>'
      || '<a href="' || _maps_link || '" style="color:hsl(142,32%,34%);font-size:14px;text-decoration:underline;">📍 Öppna i Google Maps →</a>';
  END IF;

  _message_id := 'buyer-confirm-' || NEW.id::text || '-' || extract(epoch from now())::bigint::text;

  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'run_id', gen_random_uuid()::text,
      'to', NEW.customer_email,
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Bekräftelse: din äggbokning hos ' || COALESCE(_listing.swish_name, _listing.title, 'säljaren'),
      'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">'
        || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />'
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Tack ' || NEW.customer_name || '! 🥚</h1>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Din bokning av <strong>' || NEW.packs || ' förpackning' || CASE WHEN NEW.packs>1 THEN 'ar' ELSE '' END || '</strong> hos <strong>' || COALESCE(_listing.title, 'säljaren') || '</strong> är registrerad.</p>'
        || '<div style="background: hsl(35,32%,97%); border: 1px solid hsl(22,15%,90%); border-radius: 14px; padding: 18px 20px; margin: 0 0 20px;">'
        || '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Att betala</p>'
        || '<p style="margin:0 0 14px;font-size:18px;color:hsl(22,18%,12%);font-weight:700;">' || round(_amount)::text || ' kr</p>'
        || CASE WHEN _listing.swish_number IS NOT NULL THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Swisha till</p>'
             || '<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || _listing.swish_number || ' (' || COALESCE(_listing.swish_name,'') || ')</p>'
             || '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Meddelande i Swish</p>'
             || '<p style="margin:0 0 14px;font-size:14px;color:hsl(22,18%,12%);">' || _swish_msg || '</p>'
           ELSE '' END
        || CASE WHEN _slot_text <> '' THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtningstid</p>'
             || '<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || _slot_text || '</p>'
           ELSE '' END
        || CASE WHEN _pickup_info <> '' THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtning</p>'
             || '<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);">' || _pickup_info || '</p>'
           ELSE '' END
        || _maps_html
        || '</div>'
        || CASE WHEN _cancel_token IS NOT NULL THEN
             '<p style="font-size:13px;color:hsl(22,12%,44%);margin:0 0 8px;">Behöver du avboka?</p>'
             || '<a href="' || _cancel_link || '" style="color:hsl(142,32%,34%);font-size:13px;text-decoration:underline;">Avboka din bokning →</a>'
           ELSE '' END
        || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du gjort en bokning via Agdas bod på Hönsgården.</p>'
        || '</div>',
      'text', 'Tack ' || NEW.customer_name || '! Din bokning av ' || NEW.packs || ' förp. hos ' || COALESCE(_listing.title,'säljaren') || ' är registrerad. Att betala: ' || round(_amount)::text || ' kr'
        || CASE WHEN _listing.swish_number IS NOT NULL THEN ' via Swish ' || _listing.swish_number ELSE '' END
        || CASE WHEN _slot_text <> '' THEN '. Hämtning: ' || _slot_text ELSE '' END
        || CASE WHEN _maps_link <> '' THEN '. Vägbeskrivning: ' || _maps_link ELSE '' END
        || CASE WHEN _cancel_token IS NOT NULL THEN '. Avboka: ' || _cancel_link ELSE '' END,
      'purpose', 'transactional',
      'label', 'buyer-booking-confirmation',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );
  RETURN NEW;
END;
$function$;