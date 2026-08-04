
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
              THEN '<p style="margin:0 0 6px;font-size:15px;color:hsl(22,18%,12%);font-weight:600;">' || COALESCE(_seller_name, _listing.swish_name) || '</p>'
              ELSE '' END
      || CASE WHEN _seller_email IS NOT NULL
              THEN '<p style="margin:0 0 4px;font-size:14px;color:hsl(22,18%,12%);">E-post: <a href="mailto:' || _seller_email || '" style="color:hsl(142,32%,34%);">' || _seller_email || '</a></p>'
              ELSE '' END
      || CASE WHEN _seller_phone IS NOT NULL
              THEN '<p style="margin:0;font-size:14px;color:hsl(22,18%,12%);">Telefon: ' || _seller_phone || '</p>'
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
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 16px;">Hej ' || COALESCE(NEW.customer_name, 'där') || '!</h1>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Din bokning av <strong>' || NEW.packs || ' förpackning' || CASE WHEN NEW.packs>1 THEN 'ar' ELSE '' END || '</strong> hos <strong>' || COALESCE(_listing.title, 'säljaren') || '</strong> är nu avbokad. Du behöver inte göra något mer.</p>'
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Har du redan hunnit swisha? Hör av dig till säljaren så löser ni återbetalning direkt.</p>'
        || _contact_html
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 18px;">Vill du boka igen vid ett senare tillfälle?</p>'
        || '<a href="' || _link || '" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Gå till säljsidan →</a>'
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

DROP TRIGGER IF EXISTS trg_send_cancellation_email_to_buyer ON public.public_egg_sale_bookings;
CREATE TRIGGER trg_send_cancellation_email_to_buyer
AFTER UPDATE OF status ON public.public_egg_sale_bookings
FOR EACH ROW
EXECUTE FUNCTION public.send_cancellation_email_to_buyer();
