
-- Sandra Hermann
UPDATE feedback SET
  admin_reply = E'Hej Sandra! 🐔\n\nTack för att du hörde av dig direkt – det är extra surt att stöta på problem när man precis blivit medlem. Vi har nu gått igenom det som händer när en ny medlem lägger till sin första höna och hittat ett litet konstruktionsfel i hur standardflocken skapades. Det är fixat sedan idag.\n\nJag ser också att du nu har fyra hönor och en flock registrerad i din gård – snyggt jobbat! Försök gärna lägga till en till och hör av dig direkt om något fortfarande skaver så jagar vi det igen.\n\nVarmt välkommen till Hönsgården!\n/Hönsgården-teamet',
  admin_reply_at = now(),
  status = 'resolved'
WHERE id = '7e4b1365-e635-43ee-bb95-1bfc7e5fdb28';

INSERT INTO user_notifications (user_id, type, title, body, link, metadata)
VALUES ('cebceb64-0521-4ffd-b332-a1e7cc530c5f', 'system', 'Svar på din feedback 💬',
  'Vi har gått igenom det som strulade när du lade till din första höna och fixat ett fel i standardflocken. Försök gärna igen!',
  '/app/settings',
  jsonb_build_object('feedback_id','7e4b1365-e635-43ee-bb95-1bfc7e5fdb28','kind','feedback_reply'));

-- Åsa Lundén
UPDATE feedback SET
  admin_reply = E'Hej Åsa! 🫶\n\nTack för två riktigt bra observationer – båda är åtgärdade nu:\n\n1. **Redigera hälsonoteringar** – Du kan nu både redigera och ta bort befintliga noteringar. Gå in på en hönas profil, scrolla till "Hälsa och anteckningar" och du ser en pennikon och en papperskorg bredvid varje notering.\n\n2. **15 hönor på Dashboard** – Du hade helt rätt, det var förvirrande. Vi räknade tuppar som hönor i den lilla siffran. Nu står det "13 hönor · 2 tuppar" så det blir tydligt. När det gäller äggstatistiken har den hela tiden räknats korrekt enbart på dina 13 värphönor – tupparna har aldrig påverkat snittet per höna eller värpfrekvensen.\n\nTack för att du hjälper oss göra appen bättre!\n/Hönsgården-teamet',
  admin_reply_at = now(),
  status = 'resolved'
WHERE id = 'ddbce857-3d0e-4dc3-a62b-502ac31ffd36';

INSERT INTO user_notifications (user_id, type, title, body, link, metadata)
VALUES ('b820835d-2556-4e4d-a79f-7f303b6b1cda', 'system', 'Svar på din feedback 💬',
  'Båda dina frågor är åtgärdade: du kan nu redigera/ta bort hälsonoteringar, och Dashboarden visar nu hönor och tuppar separat.',
  '/app/settings',
  jsonb_build_object('feedback_id','ddbce857-3d0e-4dc3-a62b-502ac31ffd36','kind','feedback_reply'));

-- Sarah Ylvinger
UPDATE feedback SET
  admin_reply = E'Hej Sarah! 🥧\n\nTack för att du sa till – och vad kul att höra från en statistiknörd! Pajbiten är tillbaka. Du hittar "Översikt" igen under **Mer → Insikter → Översikt** (eller direkt på /app/overview). Där kan du som vanligt bläddra månad för månad och se hela årets äggproduktion.\n\nVi pillade på navigationen för ett tag sedan och råkade gömma genvägen lite för väl – nu är den på plats igen där den hör hemma.\n\nHa en härlig dag i hönsgården!\n/Hönsgården-teamet',
  admin_reply_at = now(),
  status = 'resolved'
WHERE id = '35c4f937-2589-4c27-8e51-562ce5054e4f';

INSERT INTO user_notifications (user_id, type, title, body, link, metadata)
VALUES ('24558504-7cc2-4131-b342-3c8b2b4c59bf', 'system', 'Svar på din feedback 💬',
  'Översikten med månadernas äggproduktion är tillbaka! Du hittar den under Mer → Insikter → Översikt.',
  '/app/overview',
  jsonb_build_object('feedback_id','35c4f937-2589-4c27-8e51-562ce5054e4f','kind','feedback_reply'));
