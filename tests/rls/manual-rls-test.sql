-- =============================================================================
-- Automatiskt RLS-test för Hönsgården
-- Kör endast mot en isolerad testdatabas. Varje avvikelse kastar exception och
-- gör att psql/GitHub Actions avslutas med felkod.
-- =============================================================================

BEGIN;

DO $$
DECLARE
  alice uuid := '11111111-1111-1111-1111-111111111111';
  bob uuid := '22222222-2222-2222-2222-222222222222';
  charlie uuid := '33333333-3333-3333-3333-333333333333';
  eve uuid := '44444444-4444-4444-4444-444444444444';
  farm uuid := '99999999-9999-9999-9999-999999999991';
BEGIN
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, aud, role)
  VALUES
    (alice, 'alice@test.local', '', now(), now(), now(), 'authenticated', 'authenticated'),
    (bob, 'bob@test.local', '', now(), now(), now(), 'authenticated', 'authenticated'),
    (charlie, 'charlie@test.local', '', now(), now(), now(), 'authenticated', 'authenticated'),
    (eve, 'eve@test.local', '', now(), now(), now(), 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.coop_settings (id, user_id, coop_name)
  VALUES (farm, alice, 'RLS Test Farm')
  ON CONFLICT (id) DO UPDATE SET coop_name = EXCLUDED.coop_name;

  INSERT INTO public.farm_members (farm_id, user_id, role)
  VALUES
    (farm, bob, 'editor'),
    (farm, charlie, 'viewer')
  ON CONFLICT (farm_id, user_id) DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.hens (id, user_id, name)
  VALUES ('aaaa1111-0000-0000-0000-000000000001', alice, 'Agda')
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

  INSERT INTO public.egg_logs (id, user_id, date, count)
  VALUES ('aaaa2222-0000-0000-0000-000000000001', alice, CURRENT_DATE, 5)
  ON CONFLICT (id) DO UPDATE SET count = EXCLUDED.count;

  INSERT INTO public.health_events (id, user_id, hen_id, event_date, event_type, title)
  VALUES (
    'aaaa3333-0000-0000-0000-000000000001',
    alice,
    'aaaa1111-0000-0000-0000-000000000001',
    CURRENT_DATE,
    'observation',
    'frisk'
  )
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
END $$;

-- Owner ska kunna läsa, skapa, uppdatera och radera sina egna poster.
SET LOCAL request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  visible_count integer;
  changed_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM public.hens
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'RLS FAIL: owner expected 1 hen, got %', visible_count;
  END IF;

  UPDATE public.hens
  SET notes = 'owner update'
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'RLS FAIL: owner could not update own hen';
  END IF;

  INSERT INTO public.egg_logs (user_id, date, count)
  VALUES ('11111111-1111-1111-1111-111111111111', CURRENT_DATE - 1, 1);
END $$;

-- Editor ska kunna läsa och uppdatera delad gård men inte radera owner-data.
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  visible_count integer;
  changed_count integer;
BEGIN
  SELECT count(*) INTO visible_count
  FROM public.hens
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'RLS FAIL: editor expected shared hen, got %', visible_count;
  END IF;

  UPDATE public.hens
  SET notes = 'editor update'
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'RLS FAIL: editor could not update shared hen';
  END IF;

  DELETE FROM public.hens
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL: editor deleted owner hen';
  END IF;
END $$;

-- Viewer ska kunna läsa men aldrig skriva.
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  visible_count integer;
  changed_count integer;
  insert_was_blocked boolean := false;
BEGIN
  SELECT count(*) INTO visible_count
  FROM public.hens
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'RLS FAIL: viewer expected shared hen, got %', visible_count;
  END IF;

  UPDATE public.hens
  SET notes = 'viewer must not update'
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL: viewer updated owner hen';
  END IF;

  DELETE FROM public.hens
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL: viewer deleted owner hen';
  END IF;

  BEGIN
    INSERT INTO public.hens (user_id, name)
    VALUES ('11111111-1111-1111-1111-111111111111', 'Viewer write attempt');
  EXCEPTION WHEN insufficient_privilege OR check_violation THEN
    insert_was_blocked := true;
  END;
  IF NOT insert_was_blocked THEN
    RAISE EXCEPTION 'RLS FAIL: viewer inserted owner hen';
  END IF;
END $$;

-- Icke-medlem får inte se eller ändra någon gårdsdata.
RESET ROLE;
SET LOCAL request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  visible_count integer;
  changed_count integer;
BEGIN
  SELECT
    (SELECT count(*) FROM public.hens) +
    (SELECT count(*) FROM public.egg_logs) +
    (SELECT count(*) FROM public.health_events) +
    (SELECT count(*) FROM public.breeding_pairs) +
    (SELECT count(*) FROM public.hatch_sessions) +
    (SELECT count(*) FROM public.hen_photos) +
    (SELECT count(*) FROM public.inventory_items) +
    (SELECT count(*) FROM public.inventory_transactions)
  INTO visible_count;

  IF visible_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL: non-member can see % protected rows', visible_count;
  END IF;

  UPDATE public.hens
  SET notes = 'intrusion attempt'
  WHERE id = 'aaaa1111-0000-0000-0000-000000000001';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL: non-member updated protected row';
  END IF;

  DELETE FROM public.egg_logs
  WHERE id = 'aaaa2222-0000-0000-0000-000000000001';
  GET DIAGNOSTICS changed_count = ROW_COUNT;
  IF changed_count <> 0 THEN
    RAISE EXCEPTION 'RLS FAIL: non-member deleted protected row';
  END IF;
END $$;

RESET ROLE;
ROLLBACK;
