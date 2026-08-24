
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
        || '<p style="font-size: 14px; color: hsl(22,12%,44%); line-height: 1.6; margin: 0 0 25px;">Du har dessutom <strong>sju dagars gratis Premium</strong> för att testa alla funktioner!</p>'
        || '<a href="https://honsgarden.lovable.app/app" style="background-color: hsl(142,32%,34%); color: hsl(35,32%,97%); font-size: 14px; border-radius: 14px; padding: 12px 24px; text-decoration: none; display: inline-block;">Kom igång →</a>'
        || '<p style="font-size: 12px; color: #999; margin: 30px 0 0;">Du får detta mejl för att du registrerade dig på Hönsgården.</p>'
        || '</div>',
      'text', 'Välkommen till Hönsgården, ' || _display || '! Du har sju dagars gratis Premium. Kom igång: https://honsgarden.lovable.app/app',
      'purpose', 'transactional',
      'label', 'welcome-email',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );

  RETURN NEW;
END;
$function$;
