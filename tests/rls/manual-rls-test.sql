-- =============================================================================
-- Manuellt RLS-test för Hönsgården (DEL 8.5: testtäckning)
-- =============================================================================
-- Verifierar att de fyra granulära RLS-policys (SELECT/INSERT/UPDATE/DELETE)
-- på de 8 farm-delade tabellerna håller för rollerna owner / editor / viewer
-- samt för icke-medlem.
--
-- KÖR DETTA MOT EN TESTINSTANS — ALDRIG MOT PROD.
--
-- Förutsättningar:
--   - Migrationen 20260513212441_*.sql är applicerad
--     (utökar farm_members.role till owner|editor|viewer + skapar
--     has_farm_role_for_owner() + 4 policys per tabell).
--
-- Användning:
--   psql "$TEST_DB_URL" -v ON_ERROR_STOP=1 -f tests/rls/manual-rls-test.sql
--
-- Tolkning:
--   Varje SELECT-block returnerar en rad med ett expected/actual-fält.
--   Om "actual" inte matchar "expected" — RLS är trasig.
-- =============================================================================

BEGIN;

-- 1) Skapa fyra test-användare i auth.users (kräver service_role / superuser)
DO $$
DECLARE
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob   uuid := '22222222-2222-2222-2222-222222222222';
  charlie uuid := '33333333-3333-3333-3333-333333333333';
  eve   uuid := '44444444-4444-4444-4444-444444444444';
  farm  uuid := '99999999-9999-9999-9999-999999999991';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  VALUES
    (alice,   'alice@test.local',   '', now(), now(), now(), 'authenticated', 'authenticated'),
    (bob,     'bob@test.local',     '', now(), now(), now(), 'authenticated', 'authenticated'),
    (charlie, 'charlie@test.local', '', now(), now(), now(), 'authenticated', 'authenticated'),
    (eve,     'eve@test.local',     '', now(), now(), now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  -- 2) Skapa en farm där alice är owner (auto-trigger borde sätta in farm_member-rad)
  INSERT INTO public.coop_settings (id, user_id, coop_name)
  VALUES (farm, alice, 'Test Farm')
  ON CONFLICT (id) DO NOTHING;

  -- 3) Lägg till bob som editor och charlie som viewer
  INSERT INTO public.farm_members (farm_id, user_id, role) VALUES
    (farm, bob,     'editor'),
    (farm, charlie, 'viewer')
  ON CONFLICT (farm_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  -- 4) Alice skapar 1 hen, 1 egg_log, 1 health_event (som service_role)
  INSERT INTO public.hens (id, user_id, name)
  VALUES ('aaaa1111-0000-0000-0000-000000000001', alice, 'Agda')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.egg_logs (id, user_id, date, count)
  VALUES ('aaaa2222-0000-0000-0000-000000000001', alice, CURRENT_DATE, 5)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.health_events (id, user_id, hen_id, event_date, event_type, title)
  VALUES (
    'aaaa3333-0000-0000-0000-000000000001', alice,
    'aaaa1111-0000-0000-0000-000000000001',
    CURRENT_DATE, 'observation', 'frisk'
  )
  ON CONFLICT (id) DO NOTHING;
END $$;

-- =============================================================================
-- HJÄLPARE: byt till en specifik användare för att simulera RLS
-- =============================================================================
-- I psql kör:
--   SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
--   SET LOCAL ROLE authenticated;
-- och kör sen testblocken nedan ETT i taget.
-- =============================================================================

-- ----------- ALICE (owner) -----------
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SET LOCAL ROLE authenticated;

SELECT 'alice/hens/select' AS test, 1 AS expected_min,
       COUNT(*) AS actual FROM public.hens;

SELECT 'alice/egg_logs/insert' AS test;
INSERT INTO public.egg_logs (user_id, date, count)
VALUES ('11111111-1111-1111-1111-111111111111', CURRENT_DATE, 1);

SELECT 'alice/hens/update' AS test;
UPDATE public.hens SET notes = 'pigg'
WHERE id = 'aaaa1111-0000-0000-0000-000000000001';

-- ----------- BOB (editor) -----------
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SET LOCAL ROLE authenticated;

SELECT 'bob/hens/select' AS test, 1 AS expected_min,
       COUNT(*) AS actual FROM public.hens;

SELECT 'bob/hens/insert (user_id=alice)' AS test;
INSERT INTO public.hens (user_id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Berta');

SELECT 'bob/hens/update' AS test;
UPDATE public.hens SET notes = 'editor uppdaterade'
WHERE id = 'aaaa1111-0000-0000-0000-000000000001';

-- Bob ska INTE få radera på hens (owner-only):
SELECT 'bob/hens/delete (förväntat: 0 rader raderade pga RLS)' AS test;
DELETE FROM public.hens WHERE id = 'aaaa1111-0000-0000-0000-000000000001';

-- ----------- CHARLIE (viewer) -----------
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
SET LOCAL ROLE authenticated;

SELECT 'charlie/hens/select' AS test, 1 AS expected_min,
       COUNT(*) AS actual FROM public.hens;

-- Förväntat: alla nedan kastar 'new row violates row-level security policy'
-- eller berör 0 rader. Kör manuellt och bekräfta.
SELECT 'charlie/hens/insert (förväntat: NEKAS)' AS test;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.hens (user_id, name)
    VALUES ('11111111-1111-1111-1111-111111111111', 'CharlieFörsök');
    RAISE NOTICE 'FEL: charlie kunde INSERT på hens';
  EXCEPTION WHEN insufficient_privilege OR check_violation OR others THEN
    RAISE NOTICE 'OK: charlie nekades INSERT på hens (%)', SQLERRM;
  END;
END $$;

SELECT 'charlie/hens/update (förväntat: 0 rader)' AS test;
UPDATE public.hens SET notes = 'viewer-försök'
WHERE id = 'aaaa1111-0000-0000-0000-000000000001';

SELECT 'charlie/hens/delete (förväntat: 0 rader)' AS test;
DELETE FROM public.hens WHERE id = 'aaaa1111-0000-0000-0000-000000000001';

-- ----------- EVE (icke-medlem) -----------
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
SET LOCAL ROLE authenticated;

SELECT 'eve/hens/select (förväntat: 0)' AS test, 0 AS expected,
       COUNT(*) AS actual FROM public.hens;

SELECT 'eve/egg_logs/select (förväntat: 0)' AS test, 0 AS expected,
       COUNT(*) AS actual FROM public.egg_logs;

SELECT 'eve/health_events/select (förväntat: 0)' AS test, 0 AS expected,
       COUNT(*) AS actual FROM public.health_events;

-- Smoke-test övriga 6 tabeller — Eve ska INTE se något
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
SET LOCAL ROLE authenticated;

SELECT 'eve/breeding_pairs' AS t, COUNT(*) AS actual FROM public.breeding_pairs;
SELECT 'eve/hatch_sessions' AS t, COUNT(*) AS actual FROM public.hatch_sessions;
SELECT 'eve/hen_photos' AS t, COUNT(*) AS actual FROM public.hen_photos;
SELECT 'eve/inventory_items' AS t, COUNT(*) AS actual FROM public.inventory_items;
SELECT 'eve/inventory_transactions' AS t, COUNT(*) AS actual FROM public.inventory_transactions;

-- =============================================================================
-- ROLLBACK — vi vill inte lämna testdata kvar
-- =============================================================================
ROLLBACK;
