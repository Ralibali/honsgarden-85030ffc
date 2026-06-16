
DO $$
DECLARE
  logo TEXT := 'https://sikbymtrbhrofysgkqsj.supabase.co/storage/v1/object/public/email-assets/logo-honsgarden.png';
  cta_link TEXT := 'https://honsgarden.lovable.app/app/settings';
  base_style TEXT := '<div style="font-family:''Inter'',Arial,sans-serif;max-width:540px;padding:36px 28px;background:#ffffff;">';
BEGIN
  -- Sandra
  PERFORM enqueue_email('transactional_emails', jsonb_build_object(
    'run_id', gen_random_uuid()::text,
    'to', 'sandrahermann79@gmail.com',
    'from', 'Hönsgården <noreply@notify.honsgarden.se>',
    'sender_domain', 'notify.honsgarden.se',
    'subject', 'Svar på din feedback – nu ska det funka 🐔',
    'html', base_style ||
      '<img src="' || logo || '" width="140" alt="Hönsgården" style="margin:0 0 28px;" />' ||
      '<h1 style="font-family:''Young Serif'',Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 20px;">Tack för att du sa till, Sandra! 🐔</h1>' ||
      '<p style="font-size:15px;color:hsl(22,12%,44%);line-height:1.6;margin:0 0 16px;">Hej Sandra!</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 16px;">Det är extra surt att stöta på problem när man precis blivit medlem. Vi har nu gått igenom det som händer när en ny medlem lägger till sin första höna och hittat ett litet konstruktionsfel i hur standardflocken skapades.</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 16px;"><strong>Det är fixat sedan idag.</strong> Jag ser också att du nu har fyra hönor och en flock registrerad i din gård – snyggt jobbat! Försök gärna lägga till en till och hör av dig direkt om något fortfarande skaver så jagar vi det igen.</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 24px;">Varmt välkommen till Hönsgården!</p>' ||
      '<a href="' || cta_link || '" style="background-color:hsl(142,32%,34%);color:hsl(35,32%,97%);font-size:15px;font-weight:600;border-radius:14px;padding:14px 28px;text-decoration:none;display:inline-block;">Öppna appen →</a>' ||
      '<p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">Du får detta mejl för att du skickade feedback via Hönsgården.</p>' ||
      '</div>',
    'text', E'Hej Sandra! Tack för att du hörde av dig direkt – vi har fixat ett fel i hur standardflocken skapades för nya medlemmar. Försök lägga till en höna igen och hör av dig om något fortfarande strular. /Hönsgården-teamet',
    'purpose', 'transactional',
    'label', 'feedback-reply',
    'message_id', 'feedback-reply-7e4b1365-' || extract(epoch from now())::text,
    'queued_at', now()::text
  ));

  -- Åsa
  PERFORM enqueue_email('transactional_emails', jsonb_build_object(
    'run_id', gen_random_uuid()::text,
    'to', 'asa.lunden71@gmail.com',
    'from', 'Hönsgården <noreply@notify.honsgarden.se>',
    'sender_domain', 'notify.honsgarden.se',
    'subject', 'Svar på din feedback – båda fixade 🫶',
    'html', base_style ||
      '<img src="' || logo || '" width="140" alt="Hönsgården" style="margin:0 0 28px;" />' ||
      '<h1 style="font-family:''Young Serif'',Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 20px;">Tack för två vassa observationer, Åsa! 🫶</h1>' ||
      '<p style="font-size:15px;color:hsl(22,12%,44%);line-height:1.6;margin:0 0 16px;">Hej Åsa!</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 12px;">Tack för att du tog dig tid – båda dina punkter är åtgärdade:</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 16px;"><strong>1. Redigera hälsonoteringar.</strong> Du kan nu både redigera och ta bort befintliga noteringar. Gå in på en hönas profil, scrolla till "Hälsa och anteckningar" så ser du en penna och en papperskorg bredvid varje notering.</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 16px;"><strong>2. 15 hönor på Dashboarden.</strong> Du hade helt rätt – det var förvirrande. Vi räknade tupparna som hönor i den lilla siffran. Nu står det istället <em>"13 hönor · 2 tuppar"</em> så det blir tydligt.</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 24px;">När det gäller äggstatistiken har den hela tiden räknats korrekt enbart på dina <strong>13 värphönor</strong> – tupparna har aldrig påverkat snittet per höna eller värpfrekvensen. Så där har siffrorna stämt.</p>' ||
      '<a href="' || cta_link || '" style="background-color:hsl(142,32%,34%);color:hsl(35,32%,97%);font-size:15px;font-weight:600;border-radius:14px;padding:14px 28px;text-decoration:none;display:inline-block;">Se ditt ärende i appen →</a>' ||
      '<p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">Du får detta mejl för att du skickade feedback via Hönsgården.</p>' ||
      '</div>',
    'text', E'Hej Åsa! Båda dina punkter är åtgärdade: 1) Du kan nu redigera och ta bort hälsonoteringar från hönans profil. 2) Dashboarden visar nu "13 hönor · 2 tuppar" separat. Äggstatistiken har hela tiden räknats korrekt på dina 13 värphönor. /Hönsgården-teamet',
    'purpose', 'transactional',
    'label', 'feedback-reply',
    'message_id', 'feedback-reply-ddbce857-' || extract(epoch from now())::text,
    'queued_at', now()::text
  ));

  -- Sarah
  PERFORM enqueue_email('transactional_emails', jsonb_build_object(
    'run_id', gen_random_uuid()::text,
    'to', 'sarah.ylvinger@gmail.com',
    'from', 'Hönsgården <noreply@notify.honsgarden.se>',
    'sender_domain', 'notify.honsgarden.se',
    'subject', 'Översikten är tillbaka, Sarah 🥧',
    'html', base_style ||
      '<img src="' || logo || '" width="140" alt="Hönsgården" style="margin:0 0 28px;" />' ||
      '<h1 style="font-family:''Young Serif'',Georgia,serif;font-size:22px;color:hsl(22,18%,12%);margin:0 0 20px;">Pajbiten är tillbaka 🥧</h1>' ||
      '<p style="font-size:15px;color:hsl(22,12%,44%);line-height:1.6;margin:0 0 16px;">Hej Sarah!</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 16px;">Tack för att du sa till – och vad kul att höra från en statistiknörd! Vi pillade på navigationen för ett tag sedan och råkade gömma genvägen lite för väl.</p>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:0 0 24px;">Du hittar <strong>Översikt</strong> igen under <strong>Mer → Insikter → Översikt</strong>. Där kan du som vanligt bläddra månad för månad och se hela årets äggproduktion.</p>' ||
      '<a href="https://honsgarden.lovable.app/app/overview" style="background-color:hsl(142,32%,34%);color:hsl(35,32%,97%);font-size:15px;font-weight:600;border-radius:14px;padding:14px 28px;text-decoration:none;display:inline-block;">Öppna Översikt →</a>' ||
      '<p style="font-size:14px;color:hsl(22,12%,44%);line-height:1.7;margin:24px 0 0;">Ha en härlig dag i hönsgården!<br/>/Hönsgården-teamet</p>' ||
      '<p style="font-size:12px;color:#999;margin:32px 0 0;line-height:1.5;">Du får detta mejl för att du skickade feedback via Hönsgården.</p>' ||
      '</div>',
    'text', E'Hej Sarah! Översikten är tillbaka. Du hittar den under Mer → Insikter → Översikt, eller direkt på /app/overview. Där kan du bläddra månad för månad. /Hönsgården-teamet',
    'purpose', 'transactional',
    'label', 'feedback-reply',
    'message_id', 'feedback-reply-35c4f937-' || extract(epoch from now())::text,
    'queued_at', now()::text
  ));
END $$;
