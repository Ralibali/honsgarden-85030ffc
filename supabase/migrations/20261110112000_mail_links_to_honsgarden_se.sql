-- Länkar i mejl ska gå till honsgarden.se.
--
-- Flera databasfunktioner som köar mejl (välkomstmejl, avbokning, väntelista,
-- marknadsmeddelande, feedbackkvitto) byggde länkar till
-- honsgarden.lovable.app. Det är en annan origin än honsgarden.se: där är
-- användaren inte inloggad och möter den internationella varianten.
--
-- Funktionerna skrivs om från sin nuvarande definition i databasen i stället
-- för från en kopia i den här filen. Då bevaras allt annat exakt som det är
-- (SECURITY DEFINER, search_path, rättigheter, ägare), även om en funktion
-- har ändrats utanför migrationerna.
--
-- Bara funktioner som köar mejl berörs. Listor över tillåtna origins, där
-- lovable.app ska stå kvar, innehåller inget anrop till enqueue_email.

DO $$
DECLARE
  fn record;
  changed integer := 0;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_functiondef(p.oid) AS definition
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.prosrc LIKE '%https://honsgarden.lovable.app%'
      AND p.prosrc LIKE '%enqueue_email%'
  LOOP
    BEGIN
      EXECUTE replace(fn.definition, 'https://honsgarden.lovable.app', 'https://honsgarden.se');
      changed := changed + 1;
      RAISE NOTICE 'Mejllänkar uppdaterade i %', fn.proname;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Kunde inte uppdatera % (%)', fn.proname, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE '% funktioner länkar nu till honsgarden.se', changed;
END $$;
