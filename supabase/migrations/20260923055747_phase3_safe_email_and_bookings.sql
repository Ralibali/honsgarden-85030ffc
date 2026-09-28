-- Fas 3: escape untrusted mail content, rate-limit bookings and atomically deduplicate seller mail.
CREATE OR REPLACE FUNCTION public.html_escape(value text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$
  SELECT replace(replace(replace(replace(replace(coalesce(value, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), chr(39), '&#39;')
$$;

ALTER TABLE public.public_egg_sale_bookings ADD COLUMN IF NOT EXISTS seller_notified_at timestamptz;
CREATE INDEX IF NOT EXISTS bookings_email_hour_idx ON public.public_egg_sale_bookings (lower(trim(customer_email)), created_at);
CREATE INDEX IF NOT EXISTS bookings_listing_hour_idx ON public.public_egg_sale_bookings (listing_id, created_at);

CREATE OR REPLACE FUNCTION public.enforce_booking_rate_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE email_key text := lower(trim(NEW.customer_email));
BEGIN
  -- Serialize the check and insert for both quota keys, including simultaneous requests.
  IF nullif(email_key, '') IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended('booking-email:' || email_key, 0));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('booking-listing:' || NEW.listing_id::text, 0));
  IF nullif(email_key, '') IS NOT NULL AND (
    SELECT count(*) FROM public.public_egg_sale_bookings
    WHERE lower(trim(customer_email)) = email_key AND created_at > now() - interval '1 hour'
  ) >= 3 THEN
    RAISE EXCEPTION 'Du kan göra högst 3 bokningar per e-postadress och timme. Försök igen senare.' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.public_egg_sale_bookings
      WHERE listing_id = NEW.listing_id AND created_at > now() - interval '1 hour') >= 10 THEN
    RAISE EXCEPTION 'Annonsen har nått gränsen på 10 bokningar per timme. Försök igen senare.' USING ERRCODE = 'P0001';
  END IF;
  -- A caller-supplied historical timestamp must not bypass the rolling window.
  NEW.created_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS enforce_booking_rate_limit ON public.public_egg_sale_bookings;
CREATE TRIGGER enforce_booking_rate_limit BEFORE INSERT ON public.public_egg_sale_bookings
FOR EACH ROW EXECUTE FUNCTION public.enforce_booking_rate_limit();
REVOKE EXECUTE ON FUNCTION public.enforce_booking_rate_limit() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.enqueue_seller_booking_email(p_booking_id uuid, p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE notified timestamptz;
BEGIN
  SELECT seller_notified_at INTO notified FROM public.public_egg_sale_bookings
    WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;
  IF notified IS NOT NULL THEN RETURN false; END IF;
  PERFORM public.enqueue_email('transactional_emails', p_payload);
  UPDATE public.public_egg_sale_bookings SET seller_notified_at = now() WHERE id = p_booking_id;
  RETURN true;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enqueue_seller_booking_email(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_seller_booking_email(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_admin_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _message_id text;
BEGIN
  _message_id := 'reg-' || NEW.user_id::text || '-' || extract(epoch from now())::bigint::text;

  BEGIN
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'to', 'info@auroramedia.se',
        'from', 'Hönsgården <noreply@notify.honsgarden.se>',
        'sender_domain', 'notify.honsgarden.se',
        'subject', 'Ny medlem registrerad på Hönsgården',
        'html', '<h2>Ny medlem!</h2><p><strong>E-post:</strong> ' || public.html_escape((COALESCE(NEW.email, 'okänd'))::text) || '</p><p><strong>Namn:</strong> ' || public.html_escape((COALESCE(NEW.display_name, 'ej angivet'))::text) || '</p><p><strong>Registrerad:</strong> ' || to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI') || '</p>',
        'text', 'Ny medlem registrerad: ' || COALESCE(NEW.email, 'okänd') || ' (' || COALESCE(NEW.display_name, 'ej angivet') || ')',
        'purpose', 'transactional',
        'label', 'admin-new-user',
        'message_id', _message_id,
        'queued_at', now()::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_admin_new_user misslyckades för %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_welcome_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _message_id text;
  _display text;
BEGIN
  _message_id := 'welcome-' || NEW.user_id::text || '-' || extract(epoch from now())::bigint::text;
  _display := COALESCE(NEW.display_name, split_part(COALESCE(NEW.email, ''), '@', 1));

  BEGIN
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'to', NEW.email,
        'from', 'Hönsgården <noreply@notify.honsgarden.se>',
        'sender_domain', 'notify.honsgarden.se',
        'subject', 'Välkommen till Hönsgården! 🐔',
        'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 500px; padding: 30px 25px;">'
          || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />'
          || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">Hej ' || public.html_escape((_display)::text) || '! 👋</h1>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">Vad kul att du har gått med i Hönsgården – din digitala kompanjon för hönsägare!</p>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">Här kan du registrera dina höns, logga ägg, hålla koll på foder och ekonomi – allt på ett ställe.</p>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 25px;">Du har dessutom <strong>7 dagars gratis Premium</strong> för att testa alla funktioner!</p>'
          || '<a href="https://honsgarden.lovable.app/app" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Kom igång →</a>'
          || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du registrerade dig på Hönsgården.</p>'
          || '</div>',
        'text', 'Välkommen till Hönsgården, ' || _display || '! Du har 7 dagars gratis Premium. Kom igång: https://honsgarden.lovable.app/app',
        'purpose', 'transactional',
        'label', 'welcome-email',
        'message_id', _message_id,
        'queued_at', now()::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'send_welcome_email misslyckades för %: %', NEW.user_id, SQLERRM;
  END;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.send_feedback_confirmation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _message_id text;
  _email text;
  _display text;
BEGIN
  SELECT email, display_name INTO _email, _display
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  IF _email IS NULL THEN
    RETURN NEW;
  END IF;

  _display := COALESCE(_display, split_part(_email, '@', 1));
  _message_id := 'feedback-ack-' || NEW.id::text || '-' || extract(epoch from now())::bigint::text;

  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'run_id', gen_random_uuid()::text,
      'to', _email,
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Tack för din feedback! 💚',
      'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 500px; padding: 30px 25px;">'
        || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />'
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">Tack, ' || public.html_escape((_display)::text) || '! 💚</h1>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 16px;">Vi har tagit emot din feedback och uppskattar verkligen att du tar dig tid att hjälpa oss bli bättre.</p>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 25px;">Vi läser allt som skickas in och återkommer om vi behöver mer information.</p>'
        || '<a href="https://honsgarden.lovable.app/app" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Tillbaka till appen →</a>'
        || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du skickade feedback via Hönsgården.</p>'
        || '</div>',
      'text', 'Tack för din feedback, ' || _display || '! Vi har tagit emot ditt meddelande och återkommer vid behov.',
      'purpose', 'transactional',
      'label', 'feedback-confirmation',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );

  RETURN NEW;
END;
$function$;

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
  _order_link text;
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
  _order_link := 'https://honsgarden.lovable.app/bestallning/' || COALESCE(_cancel_token, '');

  _amount := NEW.packs * COALESCE(_listing.price_per_pack, 0);
  _swish_msg := COALESCE(_listing.swish_message, 'Äggbokning') || ' ' || NEW.customer_name;
  _pickup_info := COALESCE(_listing.pickup_info, '');

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
      || '<a href="' || public.html_escape((_maps_link)::text) || '" style="color:hsl(142,32%,34%);font-size:14px;text-decoration:underline;">📍 Öppna i Google Maps →</a>';
  END IF;

  _message_id := 'buyer-confirm-' || NEW.id::text || '-' || extract(epoch from now())::bigint::text;

  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'run_id', gen_random_uuid()::text,
      'to', NEW.customer_email,
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Förfrågan mottagen: din äggbokning hos ' || COALESCE(_listing.swish_name, _listing.title, 'säljaren'),
      'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">'
        || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />'
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Tack ' || public.html_escape((NEW.customer_name)::text) || '! 🥚</h1>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Din förfrågan om <strong>' || NEW.packs || ' förpackning' || CASE WHEN NEW.packs>1 THEN 'ar' ELSE '' END || '</strong> hos <strong>' || public.html_escape((COALESCE(_listing.title, 'säljaren'))::text) || '</strong> är mottagen. Säljaren bekräftar tillgång och hämtning och hör av sig – ingen betalning behövs förrän vid upphämtning.</p>'
        || '<div style="background: hsl(35,32%,97%); border: 1px solid hsl(22,15%,90%); border-radius: 14px; padding: 18px 20px; margin: 0 0 20px;">'
        || '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Pris (betalas vid upphämtning)</p>'
        || '<p style="margin:0 0 14px;font-size:18px;color:hsl(22,18%,12%);font-weight:700;">' || round(_amount)::text || ' kr</p>'
        || CASE WHEN _listing.swish_number IS NOT NULL THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Swisha till</p>'
             || '<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || public.html_escape((_listing.swish_number)::text) || ' (' || public.html_escape((COALESCE(_listing.swish_name,''))::text) || ')</p>'
             || '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Meddelande i Swish</p>'
             || '<p style="margin:0 0 10px;font-size:14px;color:hsl(22,18%,12%);">' || public.html_escape((_swish_msg)::text) || '</p>'
             || '<p style="margin:0 0 14px;font-size:12px;color:hsl(22,12%,44%);font-style:italic;">Swisha först vid upphämtning, efter att säljaren bekräftat din bokning.</p>'
           ELSE '' END
        || CASE WHEN _slot_text <> '' THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtningstid</p>'
             || '<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || _slot_text || '</p>'
           ELSE '' END
        || CASE WHEN _pickup_info <> '' THEN
             '<p style="margin:0 0 6px;font-size:13px;color:hsl(22,12%,44%);">Hämtning</p>'
             || '<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);">' || public.html_escape((_pickup_info)::text) || '</p>'
           ELSE '' END
        || _maps_html
        || '</div>'
        || CASE WHEN _cancel_token IS NOT NULL THEN
             '<a href="' || public.html_escape((_order_link)::text) || '" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block; margin: 0 0 16px;">Öppna din beställning →</a>'
             || '<p style="font-size:12px;color:hsl(22,12%,44%);margin:8px 0 0;">Här kan du när som helst se din bokning, byta upphämtningstid, hitta vägbeskrivningen eller avboka.</p>'
           ELSE '' END
        || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du gjort en bokning via Agdas bod på Hönsgården.</p>'
        || '</div>',
      'text', 'Tack ' || NEW.customer_name || '! Din förfrågan om ' || NEW.packs || ' förp. hos ' || COALESCE(_listing.title,'säljaren') || ' är mottagen. Säljaren bekräftar och hör av sig. Pris (betalas vid upphämtning): ' || round(_amount)::text || ' kr'
        || CASE WHEN _listing.swish_number IS NOT NULL THEN '. Swisha först vid upphämtning till ' || _listing.swish_number ELSE '' END
        || CASE WHEN _slot_text <> '' THEN '. Hämtning: ' || _slot_text ELSE '' END
        || CASE WHEN _maps_link <> '' THEN '. Vägbeskrivning: ' || _maps_link ELSE '' END
        || CASE WHEN _cancel_token IS NOT NULL THEN '. Hantera din beställning: ' || _order_link ELSE '' END,
      'purpose', 'transactional',
      'label', 'buyer-booking-confirmation',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_waitlist_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next RECORD;
  _listing RECORD;
  _message_id text;
  _link text;
BEGIN
  IF OLD.status = 'cancelled' OR NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO _listing FROM public.public_egg_sale_listings WHERE id = NEW.listing_id;
  IF _listing IS NULL OR _listing.is_active = false THEN RETURN NEW; END IF;
  SELECT * INTO _next FROM public.egg_sale_waitlist
   WHERE listing_id = NEW.listing_id AND notified_at IS NULL AND customer_email IS NOT NULL
   ORDER BY created_at ASC LIMIT 1;
  IF _next IS NULL THEN RETURN NEW; END IF;
  _link := 'https://honsgarden.lovable.app/s/' || COALESCE(_listing.slug, _listing.id::text);
  _message_id := 'waitlist-notify-' || _next.id::text || '-' || extract(epoch from now())::bigint::text;
  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'run_id', gen_random_uuid()::text,
      'to', _next.customer_email,
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Det finns ägg igen hos ' || COALESCE(_listing.title, 'säljaren') || '! 🥚',
      'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">'
        || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />'
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ' || public.html_escape((_next.customer_name)::text) || '!</h1>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">En plats har öppnats på <strong>' || public.html_escape((COALESCE(_listing.title,'säljarens'))::text) || '</strong> äggförsäljning. Du stod först på väntelistan – var snabb, först till kvarn gäller!</p>'
        || '<a href="' || public.html_escape((_link)::text) || '" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Gå till sidan och boka →</a>'
        || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du anmälde intresse via väntelistan.</p>'
        || '</div>',
      'text', 'En plats har öppnats hos ' || COALESCE(_listing.title,'säljaren') || '. Boka: ' || _link,
      'purpose', 'transactional',
      'label', 'waitlist-slot-open',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );
  UPDATE public.egg_sale_waitlist SET notified_at = now() WHERE id = _next.id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_cancellation_email_to_buyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _listing RECORD;
  _seller_email text;
  _seller_name text;
  _seller_phone text;
  _link text;
  _message_id text;
  _contact_html text := '';
  _contact_text text := '';
BEGIN
  -- Bara när status går från icke-avbokad till avbokad
  IF OLD.status = 'cancelled' OR NEW.status <> 'cancelled' THEN
    RETURN NEW;
  END IF;

  IF NEW.customer_email IS NULL OR length(NEW.customer_email) < 5 THEN
    RETURN NEW;
  END IF;

  SELECT * INTO _listing FROM public.public_egg_sale_listings WHERE id = NEW.listing_id;
  IF _listing IS NULL THEN RETURN NEW; END IF;

  -- Hämta säljarens kontaktuppgifter
  IF _listing.user_id IS NOT NULL THEN
    SELECT email, COALESCE(display_name, split_part(email,'@',1)), phone
    INTO _seller_email, _seller_name, _seller_phone
    FROM public.profiles WHERE user_id = _listing.user_id;
  END IF;

  _link := 'https://honsgarden.lovable.app/s/' || COALESCE(_listing.slug, _listing.id::text);
  _message_id := 'buyer-cancel-' || NEW.id::text || '-' || extract(epoch from now())::bigint::text;

  IF _seller_name IS NOT NULL OR _seller_email IS NOT NULL OR _seller_phone IS NOT NULL OR _listing.swish_name IS NOT NULL THEN
    _contact_html := '<div style="background: hsl(35,32%,97%); border: 1px solid hsl(22,15%,90%); border-radius: 14px; padding: 18px 20px; margin: 0 0 20px;">'
      || '<p style="margin:0 0 8px;font-size:13px;color:hsl(22,12%,44%);">Kontakt till säljaren</p>'
      || CASE WHEN _seller_name IS NOT NULL OR _listing.swish_name IS NOT NULL
              THEN '<p style="margin:0 0 6px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || public.html_escape((COALESCE(_seller_name, _listing.swish_name))::text) || '</p>'
              ELSE '' END
      || CASE WHEN _seller_email IS NOT NULL
              THEN '<p style="margin:0 0 4px;font-size:14px;color:hsl(22,18%,12%);">E-post: <a href="mailto:' || public.html_escape((_seller_email)::text) || '" style="color:hsl(142,32%,34%);">' || public.html_escape((_seller_email)::text) || '</a></p>'
              ELSE '' END
      || CASE WHEN _seller_phone IS NOT NULL
              THEN '<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);">Telefon: ' || public.html_escape((_seller_phone)::text) || '</p>'
              ELSE '' END
      || '</div>';

    _contact_text := ' Kontakt: ' || COALESCE(_seller_name, _listing.swish_name, '')
      || CASE WHEN _seller_email IS NOT NULL THEN ', ' || _seller_email ELSE '' END
      || CASE WHEN _seller_phone IS NOT NULL THEN ', tel ' || _seller_phone ELSE '' END;
  END IF;

  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'run_id', gen_random_uuid()::text,
      'to', NEW.customer_email,
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Din bokning hos ' || COALESCE(_listing.title, 'säljaren') || ' är avbokad',
      'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">'
        || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin:0 0 24px;" />'
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ' || public.html_escape((COALESCE(NEW.customer_name, 'där'))::text) || '!</h1>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Din bokning av <strong>' || NEW.packs || ' förpackning' || CASE WHEN NEW.packs>1 THEN 'ar' ELSE '' END || '</strong> hos <strong>' || public.html_escape((COALESCE(_listing.title, 'säljaren'))::text) || '</strong> är nu avbokad. Du behöver inte göra något mer.</p>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Har du redan hunnit swisha? Hör av dig till säljaren så löser ni återbetalning direkt.</p>'
        || _contact_html
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Vill du boka igen vid ett senare tillfälle?</p>'
        || '<a href="' || public.html_escape((_link)::text) || '" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Gå till säljsidan →</a>'
        || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att din bokning via Agdas bod på Hönsgården har avbokats.</p>'
        || '</div>',
      'text', 'Din bokning av ' || NEW.packs || ' förp. hos ' || COALESCE(_listing.title,'säljaren') || ' är avbokad.' || _contact_text || ' Boka igen: ' || _link,
      'purpose', 'transactional',
      'label', 'buyer-booking-cancellation',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );

  RETURN NEW;
END;
$$;

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
          || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ' || public.html_escape((_seller_name)::text) || '!</h1>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;"><strong>' || public.html_escape((_sender_name)::text) || '</strong> har skickat ett meddelande om din annons <em>"' || public.html_escape((COALESCE(_listing_title,''))::text) || '"</em>:</p>'
          || '<div style="background: hsl(35,32%,97%); border-left: 3px solid hsl(142,32%,34%); padding: 14px 18px; margin: 0 0 22px; border-radius: 8px;">'
          || '<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);line-height:1.6;">' || public.html_escape((substring(NEW.content from 1 for 400))::text) || CASE WHEN length(NEW.content)>400 THEN '...' ELSE '' END || '</p>'
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

CREATE OR REPLACE FUNCTION public.notify_post_owner_on_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _owner_id uuid;
  _owner_email text;
  _owner_name text;
  _commenter_name text;
  _post_title text;
  _post_excerpt text;
  _message_id text;
BEGIN
  -- Hämta postägare
  SELECT user_id, COALESCE(title, ''),
         CASE WHEN length(content) > 80 THEN substring(content, 1, 80) || '...' ELSE content END
  INTO _owner_id, _post_title, _post_excerpt
  FROM public.community_posts
  WHERE id = NEW.post_id;

  -- Hoppa över notis om man kommenterar sitt eget inlägg
  IF _owner_id IS NULL OR _owner_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Hämta kommentatorns namn
  SELECT COALESCE(display_name, split_part(email, '@', 1), 'Någon')
  INTO _commenter_name
  FROM public.profiles
  WHERE user_id = NEW.user_id;

  -- Hämta ägarens kontaktuppgifter
  SELECT email, COALESCE(display_name, split_part(email, '@', 1), 'där')
  INTO _owner_email, _owner_name
  FROM public.profiles
  WHERE user_id = _owner_id;

  -- 1. In-app-notis
  INSERT INTO public.user_notifications (user_id, type, title, body, link, metadata)
  VALUES (
    _owner_id,
    'community_reply',
    _commenter_name || ' svarade på ditt inlägg',
    '"' || _post_title || '"',
    '/app/community',
    jsonb_build_object(
      'post_id', NEW.post_id,
      'comment_id', NEW.id,
      'commenter_id', NEW.user_id,
      'commenter_name', _commenter_name
    )
  );

  -- 2. Mejl
  IF _owner_email IS NOT NULL THEN
    _message_id := 'comment-' || NEW.id::text || '-' || extract(epoch from now())::bigint::text;
    PERFORM public.enqueue_email(
      'transactional_emails',
      jsonb_build_object(
        'run_id', gen_random_uuid()::text,
        'to', _owner_email,
        'from', 'Hönsgården <noreply@notify.honsgarden.se>',
        'sender_domain', 'notify.honsgarden.se',
        'subject', _commenter_name || ' svarade på ditt inlägg i Community',
        'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">'
          || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />'
          || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ' || public.html_escape((_owner_name)::text) || '!</h1>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;"><strong>' || public.html_escape((_commenter_name)::text) || '</strong> har svarat på ditt inlägg <em>"' || public.html_escape((_post_title)::text) || '"</em>.</p>'
          || '<div style="background: hsl(35,32%,97%); border-left: 3px solid hsl(142,32%,34%); padding: 14px 18px; margin: 0 0 22px; border-radius: 8px;">'
          || '<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);line-height:1.6;font-style:italic;">' || public.html_escape((substring(NEW.content from 1 for 240))::text) || CASE WHEN length(NEW.content) > 240 THEN '...' ELSE '' END || '</p>'
          || '</div>'
          || '<a href="https://honsgarden.lovable.app/app/community" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Öppna i Community →</a>'
          || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att någon svarat på ditt inlägg på Hönsgården.</p>'
          || '</div>',
        'text', _commenter_name || ' svarade på ditt inlägg "' || _post_title || '" i Community: ' || substring(NEW.content from 1 for 200) || ' — Öppna: https://honsgarden.lovable.app/app/community',
        'purpose', 'transactional',
        'label', 'community-comment-notify',
        'message_id', _message_id,
        'queued_at', now()::text
      )
    );
  END IF;

  RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.notify_seller_on_booking()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _seller_email text;
  _seller_name text;
  _listing_title text;
  _message_id text;
  _link text;
BEGIN
  -- Hämta säljarens uppgifter
  SELECT email, display_name INTO _seller_email, _seller_name
  FROM public.profiles
  WHERE user_id = NEW.seller_user_id;

  SELECT COALESCE(title, 'Din äggförsäljning') INTO _listing_title
  FROM public.public_egg_sale_listings
  WHERE id = NEW.listing_id;

  _link := '/app/egg-sales';

  -- 1. In-app-notis
  INSERT INTO public.user_notifications (user_id, type, title, body, link, metadata)
  VALUES (
    NEW.seller_user_id,
    'booking',
    'Ny bokning! 🥚',
    NEW.customer_name || ' har bokat ' || NEW.packs || ' förpackning' ||
      CASE WHEN NEW.packs > 1 THEN 'ar' ELSE '' END || ' av "' || _listing_title || '".',
    _link,
    jsonb_build_object(
      'booking_id', NEW.id,
      'listing_id', NEW.listing_id,
      'customer_name', NEW.customer_name,
      'packs', NEW.packs
    )
  );

  -- 2. Mejl till säljaren
  IF _seller_email IS NOT NULL THEN
    _message_id := 'booking-' || NEW.id::text || '-' || extract(epoch from now())::bigint::text;
    PERFORM public.enqueue_seller_booking_email(
      NEW.id,
      jsonb_build_object(
        'run_id', gen_random_uuid()::text,
        'to', _seller_email,
        'from', 'Hönsgården <noreply@notify.honsgarden.se>',
        'sender_domain', 'notify.honsgarden.se',
        'subject', 'Ny bokning på din äggförsäljning 🥚',
        'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 540px; padding: 30px 25px;">'
          || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />'
          || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ' || public.html_escape((COALESCE(_seller_name, 'där'))::text) || '!</h1>'
          || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Du har en ny bokning på <strong>' || public.html_escape((_listing_title)::text) || '</strong>.</p>'
          || '<div style="background: hsl(35,32%,97%); border: 1px solid hsl(22,15%,90%); border-radius: 14px; padding: 18px 20px; margin: 0 0 20px;">'
          || '<p style="margin:0 0 8px;font-size:13px;color:hsl(22,12%,44%);">Kund</p>'
          || '<p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || public.html_escape((NEW.customer_name)::text) || '</p>'
          || CASE WHEN NEW.customer_phone IS NOT NULL THEN '<p style="margin:0 0 8px;font-size:13px;color:hsl(22,12%,44%);">Telefon</p><p style="margin:0 0 14px;font-size:15px;color:hsl(22,18%,12%);">' || public.html_escape((NEW.customer_phone)::text) || '</p>' ELSE '' END
          || '<p style="margin:0 0 8px;font-size:13px;color:hsl(22,12%,44%);">Antal förpackningar</p>'
          || '<p style="margin:0;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || NEW.packs::text || ' st</p>'
          || CASE WHEN NEW.customer_message IS NOT NULL AND length(NEW.customer_message) > 0 THEN '<p style="margin:14px 0 8px;font-size:13px;color:hsl(22,12%,44%);">Meddelande</p><p style="margin:0;font-size:14px;color:hsl(22,18%,12%);font-style:italic;">"' || public.html_escape((NEW.customer_message)::text) || '"</p>' ELSE '' END
          || '</div>'
          || '<a href="https://honsgarden.lovable.app/app/egg-sales" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Öppna Agdas Bod →</a>'
          || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du har en aktiv äggförsäljning på Hönsgården.</p>'
          || '</div>',
        'text', 'Ny bokning på "' || _listing_title || '" från ' || NEW.customer_name || ' (' || NEW.packs || ' förpackningar). Logga in: https://honsgarden.lovable.app/app/egg-sales',
        'purpose', 'transactional',
        'label', 'seller-new-booking',
        'message_id', _message_id,
        'queued_at', now()::text
      )
    );
  END IF;

  RETURN NEW;
END;
$function$
;
