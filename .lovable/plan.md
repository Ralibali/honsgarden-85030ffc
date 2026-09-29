# Google Play billing: pre-deployment comparison (read-only, nothing changed)

Backend: sikbymtrbhrofysgkqsj is the active backend and is reachable. The archive has 10 files, including a 15 618-byte migration.

## Current state
- Migration 20260928072522_google_play_billing: NOT applied.
- Functions verify-google-subscription and google-play-notifications: NOT deployed (both return 404).
- Secrets GOOGLE_PLAY_SERVICE_ACCOUNT, GOOGLE_PLAY_RTDN_AUDIENCE and GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL: none are set.
- Native redirect allowlist for Android/iOS: UNAVAILABLE. Site URL and Additional Redirect URLs aren't readable here, so check them manually.
- google_play_purchases table, merge_google_play_access, apply_google_play_purchase and billing_without_google_expiry: all absent. No name collisions.

## profiles columns (all present, all compatible)
- user_id uuid NOT NULL UNIQUE, FK to auth.users with cascade delete
- preferences jsonb NOT NULL, default '{}'
- premium_expires_at timestamptz, nullable
- is_lifetime_premium boolean NOT NULL, default false
- subscription_status text NOT NULL, default 'free'
- stripe_customer_id text, nullable
- No check constraint limits subscription_status values.

## Existing billing functions compared with the migration
- protect_apple_iap_preferences: SECURITY INVOKER, search_path=public. Live code strips only apple_iap and stripe_plus for non-service callers. The migration adds google_play and is otherwise identical. The trigger is recreated with the same definition (BEFORE INSERT OR UPDATE).
- apply_apple_iap_entitlement and apply_stripe_plus_status: SECURITY INVOKER, search_path=public, same signatures. EXECUTE is limited to postgres, service_role and the sandbox read role; anon and authenticated have none. The migration keeps the signatures and grants. Its only logic change is stripping the Google expiry first, via billing_without_google_expiry.
- guard_premium_expires_at, which has two duplicate BEFORE UPDATE triggers: forces lifetime to premium with a NULL expiry, and keeps the old expiry on partial premium updates. No conflict.
- protect_subscription_fields (SECURITY DEFINER, BEFORE UPDATE): non-service, non-admin callers get subscription_status, is_lifetime_premium, premium_expires_at, stripe_customer_id and referral_code reverted to OLD. No conflict: merge_google_play_access runs after it and uses only data the server protects.
- grant_premium_days and set_lifetime_premium (SECURITY DEFINER) still work. merge_google_play_access treats a changed expiry as independent access, so gifts and trials are kept. Lifetime still forces a NULL expiry.

## Trigger order on profiles (BEFORE, alphabetical)
guard_premium_expires_at_trigger, protect_apple_iap_preferences, protect_subscription_fields_trigger, set_referral_code, trg_guard_premium_expires_at, update_profiles_updated_at, then the new zz_merge_google_play_access runs last, as intended.

## Compatibility result
No incompatible security rule or billing structure was found. Minor notes that don't block deployment:
1. EXECUTE on the existing trigger functions is open to PUBLIC, anon and authenticated. They can't be called directly, so this isn't a risk. CREATE OR REPLACE keeps those grants.
2. CREATE TABLE and CREATE TRIGGER zz_merge_google_play_access don't use IF NOT EXISTS. That's safe now because neither exists, but the migration can't be run twice.
3. Only billing_without_google_expiry and apply_google_play_purchase get a service_role grant. merge_google_play_access is a trigger function, so it needs none.

## Next step, after approval
Apply the exact migration in one transaction. Then deploy the attached handlers and helpers unchanged: check-subscription, verify-google-subscription, google-play-notifications and _shared/*. Add the three secrets in Project Settings → Secrets, and check the redirect allowlist manually.
