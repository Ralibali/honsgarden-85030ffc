
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
  
  PERFORM public.enqueue_email(
    'transactional_emails',
    jsonb_build_object(
      'to', 'info@auroramedia.se',
      'from', 'Hönsgården <noreply@notify.honsgarden.se>',
      'sender_domain', 'notify.honsgarden.se',
      'subject', 'Ny medlem registrerad på Hönsgården',
      'html', '<h2>Ny medlem!</h2><p><strong>E-post:</strong> ' || COALESCE(NEW.email, 'okänd') || '</p><p><strong>Namn:</strong> ' || COALESCE(NEW.display_name, 'ej angivet') || '</p><p><strong>Registrerad:</strong> ' || to_char(NEW.created_at, 'YYYY-MM-DD HH24:MI') || '</p>',
      'text', 'Ny medlem registrerad: ' || COALESCE(NEW.email, 'okänd') || ' (' || COALESCE(NEW.display_name, 'ej angivet') || ')',
      'purpose', 'transactional',
      'label', 'admin-new-user',
      'message_id', _message_id,
      'queued_at', now()::text
    )
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_profile_notify_admin
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.notify_admin_new_user();
