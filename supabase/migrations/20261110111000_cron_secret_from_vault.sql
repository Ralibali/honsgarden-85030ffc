-- Cron-jobb ska läsa CRON_SECRET ur vault, aldrig bära den i klartext.
--
-- Bakgrund: flera jobb har schemalagts med hemligheten inskriven i själva
-- kommandot. Då går den inte att byta utan att varje sådant jobb slutar
-- fungera i samma stund. Först måste jobben sluta bära värdet själva.
--
-- Den här migrationen:
--   1. lägger till public.invoke_cron_function(), som hämtar hemligheten ur
--      vault vid varje körning,
--   2. skriver om jobb med inskriven hemlighet så att de använder den, men
--      BARA när det bevisligen är samma hemlighet som redan ligger i vault
--      (eller som läggs dit här, om vault är tomt och alla jobb är överens),
--   3. lägger till public.cron_auth_overview() som visar läget utan att
--      visa några hemligheter.
--
-- Jobb som inte går att tolka säkert lämnas orörda. Själva bytet av
-- hemligheten görs inte här, se docs/rotera-cron-secret.md.

CREATE OR REPLACE FUNCTION public.invoke_cron_function(
  _function text,
  _body jsonb DEFAULT '{}'::jsonb,
  _timeout_ms integer DEFAULT NULL
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  cron_secret text;
  target text;
  request_headers jsonb;
BEGIN
  IF _function IS NULL OR _function !~ '^[a-z0-9][a-z0-9-]{0,62}$' THEN
    RAISE EXCEPTION 'Ogiltigt funktionsnamn: %', _function;
  END IF;

  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CRON_SECRET'
  LIMIT 1;

  -- Hellre ett synligt fel i cron.job_run_details än ett tyst 401.
  IF cron_secret IS NULL OR cron_secret = '' THEN
    RAISE EXCEPTION 'CRON_SECRET saknas i vault, % anropades inte', _function;
  END IF;

  -- Hemligheten skickas bara till det här projektets egna funktioner.
  target := 'https://sikbymtrbhrofysgkqsj.supabase.co/functions/v1/' || _function;
  request_headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'x-cron-secret', cron_secret
  );

  IF _timeout_ms IS NULL THEN
    RETURN net.http_post(
      url := target,
      headers := request_headers,
      body := COALESCE(_body, '{}'::jsonb)
    );
  END IF;
  RETURN net.http_post(
    url := target,
    headers := request_headers,
    body := COALESCE(_body, '{}'::jsonb),
    timeout_milliseconds := _timeout_ms
  );
END;
$$;

-- Funktionen läser en hemlighet och får inte gå att nå via API:t.
REVOKE ALL ON FUNCTION public.invoke_cron_function(text, jsonb, integer)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.invoke_cron_function(text, jsonb, integer) TO postgres;

-- plpgsql så att funktionen går att skapa även där pg_cron saknas.
CREATE OR REPLACE FUNCTION public.cron_auth_overview()
RETURNS TABLE (jobname text, schedule text, active boolean, edge_function text, auth text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.jobname::text,
    j.schedule::text,
    j.active,
    substring(j.command from 'functions/v1/([a-z0-9-]+)'),
    CASE
      WHEN j.command ~* 'invoke_cron_function' THEN 'vault (hjälpfunktion)'
      WHEN j.command ~* 'x-cron-secret' AND j.command ~* 'decrypted_secrets' THEN 'vault'
      WHEN j.command ~* 'x-cron-secret' THEN 'KLARTEXT'
      WHEN j.command ~* 'functions/v1/' THEN 'annan (ingen cron-hemlighet)'
      ELSE 'anropar ingen funktion'
    END
  FROM cron.job j
  ORDER BY j.jobname;
END;
$$;

REVOKE ALL ON FUNCTION public.cron_auth_overview()
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cron_auth_overview() TO postgres;

DO $$
DECLARE
  vault_secret text;
  inline_secrets text[];
  job record;
  new_command text;
  converted integer := 0;
  left_alone integer := 0;
BEGIN
  IF to_regclass('cron.job') IS NULL OR to_regclass('vault.decrypted_secrets') IS NULL THEN
    RAISE NOTICE 'cron eller vault finns inte här, inga jobb ändras';
    RETURN;
  END IF;

  SELECT decrypted_secret INTO vault_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CRON_SECRET'
  LIMIT 1;

  -- Hemligheter som står inskrivna i jobb i dag. Båda skrivsätten täcks:
  --   jsonb_build_object('x-cron-secret', '...')  och  '{"x-cron-secret": "..."}'::jsonb
  SELECT array_agg(DISTINCT s.inline_secret) INTO inline_secrets
  FROM (
    SELECT COALESCE(
      substring(j.command from $re$(?i)'x-cron-secret'\s*,\s*'([^']+)'$re$),
      substring(j.command from $re$(?i)"x-cron-secret"\s*:\s*"([^"]+)"$re$)
    ) AS inline_secret
    FROM cron.job j
    WHERE j.command ~* 'x-cron-secret'
      AND j.command !~* 'decrypted_secrets'
      AND j.command !~* 'invoke_cron_function'
  ) s
  WHERE s.inline_secret IS NOT NULL;

  -- Tomt vault och alla jobb överens: då är det värdet den hemlighet som
  -- funktionerna godkänner i dag. Lägg den i vault så att inget ändras när
  -- jobben börjar läsa därifrån.
  IF (vault_secret IS NULL OR vault_secret = '') AND array_length(inline_secrets, 1) = 1 THEN
    BEGIN
      PERFORM vault.create_secret(
        inline_secrets[1],
        'CRON_SECRET',
        'Delad hemlighet mellan pg_cron och edge functions'
      );
      vault_secret := inline_secrets[1];
      RAISE NOTICE 'CRON_SECRET lades i vault';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Kunde inte lägga CRON_SECRET i vault (%), inga jobb ändras', SQLERRM;
    END;
  END IF;

  FOR job IN
    SELECT
      j.jobid,
      j.jobname,
      COALESCE(
        substring(j.command from $re$(?i)'x-cron-secret'\s*,\s*'([^']+)'$re$),
        substring(j.command from $re$(?i)"x-cron-secret"\s*:\s*"([^"]+)"$re$)
      ) AS inline_secret,
      substring(j.command from 'https://sikbymtrbhrofysgkqsj\.supabase\.co/functions/v1/([a-z0-9-]+)') AS edge_function,
      (SELECT count(*) FROM regexp_matches(j.command, 'functions/v1/', 'g')) AS url_count,
      substring(j.command from 'timeout_milliseconds\s*:=\s*([0-9]+)') AS timeout_ms
    FROM cron.job j
    WHERE j.command ~* 'x-cron-secret'
      AND j.command !~* 'decrypted_secrets'
      AND j.command !~* 'invoke_cron_function'
  LOOP
    -- Skriv bara om när resultatet bevisligen blir samma anrop som i dag:
    -- ett enda känt funktionsanrop, och samma hemlighet som vault ger.
    -- send-payment-reminder undantas: den läser sin body och kräver en JWT.
    IF job.inline_secret IS NULL
       OR job.edge_function IS NULL
       OR job.url_count <> 1
       OR job.edge_function = 'send-payment-reminder'
       OR vault_secret IS NULL
       OR job.inline_secret <> vault_secret THEN
      left_alone := left_alone + 1;
      RAISE NOTICE 'Lämnar jobbet % orört', job.jobname;
      CONTINUE;
    END IF;

    new_command := CASE
      WHEN job.timeout_ms IS NULL THEN
        format('SELECT public.invoke_cron_function(%L);', job.edge_function)
      ELSE
        format('SELECT public.invoke_cron_function(%L, %L::jsonb, %s);', job.edge_function, '{}', job.timeout_ms)
    END;

    BEGIN
      PERFORM cron.alter_job(job.jobid, command := new_command);
      converted := converted + 1;
      RAISE NOTICE 'Jobbet % läser nu hemligheten ur vault', job.jobname;
    EXCEPTION WHEN OTHERS THEN
      left_alone := left_alone + 1;
      RAISE NOTICE 'Kunde inte ändra jobbet % (%)', job.jobname, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'Cron-jobb: % skrevs om, % lämnades orörda', converted, left_alone;
END $$;
