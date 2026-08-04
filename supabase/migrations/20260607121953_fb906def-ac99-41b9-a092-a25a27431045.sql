
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
