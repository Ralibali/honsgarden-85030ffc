
-- Booking confirmation email to BUYER on insert
CREATE OR REPLACE FUNCTION public.send_booking_confirmation_to_buyer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
        || CASE WHEN _cancel_token IS NOT NULL THEN '. Avboka: ' || _cancel_link ELSE '' END,
      'purpose', 'transactional',
      'label', 'buyer-booking-confirmation',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_send_booking_confirmation_to_buyer ON public.public_egg_sale_bookings;
CREATE TRIGGER trg_send_booking_confirmation_to_buyer
AFTER INSERT ON public.public_egg_sale_bookings
FOR EACH ROW EXECUTE FUNCTION public.send_booking_confirmation_to_buyer();

-- Notify next person on waitlist when a booking is cancelled
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

  _link := 'https://honsgarden.lovable.app/saljare/' || NEW.listing_id::text;
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
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ' || _next.customer_name || '!</h1>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">En plats har öppnats på <strong>' || COALESCE(_listing.title,'säljarens') || '</strong> äggförsäljning. Du stod först på väntelistan – var snabb, först till kvarn gäller!</p>'
        || '<a href="' || _link || '" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Gå till sidan och boka →</a>'
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

DROP TRIGGER IF EXISTS trg_notify_waitlist_on_cancel ON public.public_egg_sale_bookings;
CREATE TRIGGER trg_notify_waitlist_on_cancel
AFTER UPDATE OF status ON public.public_egg_sale_bookings
FOR EACH ROW EXECUTE FUNCTION public.notify_waitlist_on_cancel();
