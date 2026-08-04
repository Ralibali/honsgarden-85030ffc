
-- Welcome email trigger: sends a branded welcome email TO the new user
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

  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'to', NEW.email,
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Välkommen till Hönsgården! 🐔',
      'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 500px; padding: 30px 25px;">'
        || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />'
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">Hej ' || _display || '! 👋</h1>'
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

  RETURN NEW;
END;
$function$;

-- Attach to profiles table AFTER insert (runs after admin notification)
CREATE TRIGGER on_new_profile_send_welcome
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.send_welcome_email();

-- Feedback confirmation trigger: sends ack email to user
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
  -- Look up user email and name from profiles
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
      'to', _email,
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Tack för din feedback! 💚',
      'html', '<div style="font-family: Inter, Arial, sans-serif; max-width: 500px; padding: 30px 25px;">'
        || '<img src="https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png" width="140" alt="Hönsgården" style="margin: 0 0 24px;" />'
        || '<h1 style="font-family: Young Serif, Georgia, serif; font-size: 22px; color: hsl(22,18%,12%); margin: 0 0 20px;">Tack, ' || _display || '! 💚</h1>'
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

CREATE TRIGGER on_feedback_send_confirmation
  AFTER INSERT ON public.feedback
  FOR EACH ROW
  EXECUTE FUNCTION public.send_feedback_confirmation();
