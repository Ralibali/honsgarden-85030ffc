-- Run after phase 1 in an isolated database. Every failure aborts the test.
DO $$
DECLARE f record; expected_name text;
BEGIN
  FOREACH expected_name IN ARRAY ARRAY['enqueue_email', 'read_email_batch', 'delete_email', 'move_to_dlq', 'shop_finalize_paid_order', 'grant_premium_days', 'set_lifetime_premium', 'grant_referral_reward_for_referred', 'process_referral', 'check_rate_limit', 'count_user_backups_today', 'count_user_reports_today', 'deactivate_expired_simple_listings', 'expire_marketplace_listings']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = expected_name) THEN
      RAISE EXCEPTION 'Missing function: %', expected_name;
    END IF;
    FOR f IN SELECT p.oid, p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = expected_name LOOP
      IF has_function_privilege('anon', f.oid, 'EXECUTE') OR has_function_privilege('authenticated', f.oid, 'EXECUTE') OR NOT has_function_privilege('service_role', f.oid, 'EXECUTE') THEN
        RAISE EXCEPTION 'Unsafe function grants: %', f.signature;
      END IF;
    END LOOP;
  END LOOP;
  IF has_column_privilege('authenticated', 'public.public_egg_sale_listings', 'manage_token', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated can read manage_token';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE 'public' = ANY(roles) AND (coalesce(qual, '') || coalesce(with_check, '')) ~ '(get_farm_user_ids|get_user_farm_ids|get_farm_member_display_names)') THEN
    RAISE EXCEPTION 'Public policy still calls a protected farm helper';
  END IF;
END;
$$;

SET ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.grant_premium_days('11111111-1111-4111-8111-111111111111', 7);
    RAISE EXCEPTION 'Anonymous premium grant unexpectedly succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
END;
$$;
RESET ROLE;
