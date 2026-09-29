# Google Play billing rollout

Status 29 September 2026: migration and three billing handlers with six shared helpers deployed through Lovable to the actual backend. Ledger RLS/client denial and server-only RPC grants verified. Unauthenticated verifier and status requests return 401; notifications return 503 while unconfigured. The three Google credentials remain absent. No real purchase/restore has been verified. Do not publish Android production before completing the rollout below.

Android package `se.auroramedia.honsgarden`; subscription `honsgarden_plus`; base plans `monthly` and `yearly`. The old Android package belongs to another developer; the user's Play draft has not yet received a package. iOS keeps `se.honsgarden.app` and its existing Apple products. The Android release client uses SHA-256 of `honsgarden:` plus the lowercase Supabase user UUID as the obfuscated account ID. The server enforces that exact binding.

## Rollout order

1. Completed on 29 September: `20260928072522_google_play_billing.sql` applied in Hönsgården's actual Lovable Cloud backend `sikbymtrbhrofysgkqsj`, followed by the three handlers and six shared helpers. Ledger RLS is enabled, client grants are zero and billing RPCs are server-only. Do not rerun this one-time migration. Inspect real production billing guards/functions before any future replacement and keep security-advisor checks current.
2. Privately configure `GOOGLE_PLAY_SERVICE_ACCOUNT`, using a service account restricted in Play Console to this app and the permissions required to read and acknowledge subscriptions. It must have Android Publisher API access. Never put this credential in Git, client code, screenshots or review notes.
3. Set `GOOGLE_PLAY_ALLOW_TEST=true` only for the deliberate licensed-tester workflow; default is false. This does not accept forged receipts: Google still verifies each purchase.
4. Deploy `verify-google-subscription` with JWT verification enabled, and `check-subscription`, including their shared dependencies. The verifier additionally resolves the user through Supabase Auth before accepting purchase tokens.
5. Deploy `google-play-notifications` with platform JWT verification disabled only because the handler validates Google's signed OIDC JWT instead. Set `GOOGLE_PLAY_RTDN_AUDIENCE` to the exact endpoint URL and `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` to the exact authorized Pub/Sub push identity. Configure authenticated Pub/Sub push and Play real-time developer notifications for this app. Verify a signed test notification and reject wrong issuer, audience and email.
6. The existing local Android client/release work is integrated with main on this branch. Rebuild and sign an initial AAB, upload it privately, and configure the two base plans and license testers. An initial private AAB is needed before Google subscription setup; it is not production publication.
7. On the installed internal release, test actual purchase, acknowledgement, restoration, account switching, renewal, cancellation, grace period, hold, expiry and refund. Verify the real notification flow and the resulting profile access. Run a Google/Apple/Stripe overlap scenario. Check login redirects and native auth providers.
8. Complete native device verification, screenshots, Data safety, review credentials, content declarations and the production release. Nothing here declares that these steps have been completed.

Backend source can be deployed before Google credentials: the new ledger is empty, so existing Apple/Stripe checks continue; missing credentials make Google verification fail with generic 503 before any grant. Missing notification configuration also returns 503. The three entrypoints depend on `_shared/googlePlay.ts`, `googlePlaySync.ts`, `googleServiceAccount.ts`, `appleIap.ts`, `localPremium.ts` and `stripeBilling.ts`. Google verification and acknowledgment both pin the new Android package.

## Behavior

Only Google's SubscriptionPurchaseV2 API determines access. Unknown products/plans, mismatched or absent account IDs and unapproved test purchases are rejected. Active, grace-period and canceled subscriptions retain access only until expiry. Pending, paused, on-hold and expired states grant none. Eligible unacknowledged purchases are acknowledged by the server. Retryable provider/database errors return 503 without disclosing tokens.

Tokens are stored only in the server-accessible purchase ledger. A unique token cannot move to another user. Fresh server observations override older observations; replaying an older snapshot cannot resurrect refunded access. Notifications re-fetch authoritative purchase state, not notification-supplied entitlement values. Existing known purchases are also refreshed when subscription status is checked.

Apple and Stripe state calculations exclude the Google overlay, and the profile update trigger recombines current independent access. Refunds must not erase another provider, lifetime access or a separate gift. Tests exercise both refund orders and equal provider expiry dates. Deployment validation must also inspect the real production trigger definitions and grants; local tests cannot substitute for that.

## Validation

- 29 September full local Vitest suite: 117 files, 1002 tests passed, including Google billing, Apple billing, native OAuth, push, registration and native Apple cancellation recovery. One additional Android dependency-path regression test was then added and its complete seven-test identity suite passed.
- Both native sync outputs verified: Android `se.auroramedia.honsgarden`, iOS `se.honsgarden.app`. Platform-specific OAuth/recovery and rejecting the other platform's scheme passed; ambiguous sync and mismatched platform environment are rejected.
- TypeScript project check passed. ESLint completed with zero errors and 682 warnings (existing and inherited native work); warnings remain to review.
- Isolated PostgreSQL/PGlite integration tests: account ownership, denied client reads/writes/RPC, forged preferences, out-of-order replay, refunds, Apple/Stripe overlap, equal expiries, independent gift, lifetime and preference preservation.
- Production web build, SEO and route checks passed.
- Native push database isolation tests passed.
- Deno typecheck of verification, notification, check-subscription and push entrypoints passed.
- No production schema changes, credential creation, payments or store submission performed by these tests.

## Sources

- [Google SubscriptionPurchaseV2 API](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2)
- [Google subscription lifecycle](https://developer.android.com/google/play/billing/lifecycle/subscriptions)
- [Supabase function authentication](https://supabase.com/docs/guides/functions/auth)
