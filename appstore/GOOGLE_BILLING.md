# Google Play billing rollout

Status 28 September 2026: implementation prepared and locally tested. Not deployed, not connected to live Play credentials, and no real purchase/restore has been verified. Do not publish Android production before completing the rollout below.

Package `se.honsgarden.app`; subscription `honsgarden_plus`; base plans `monthly` and `yearly`. The existing Android release client uses SHA-256 of `honsgarden:` plus the lowercase Supabase user UUID as the obfuscated account ID. The server enforces that exact binding.

## Rollout order

1. Review and apply `20260928072522_google_play_billing.sql` in Hönsgården's actual backend `sikbymtrbhrofysgkqsj`, then run security advisors. This project is in Lovable Cloud and is not exposed by the currently connected Supabase account. The migration adds a server-only purchase ledger and protects the Google entitlement metadata in profiles; do not deploy the new check-subscription function before the migration.
2. Privately configure `GOOGLE_PLAY_SERVICE_ACCOUNT`, using a service account restricted in Play Console to this app and the permissions required to read and acknowledge subscriptions. It must have Android Publisher API access. Never put this credential in Git, client code, screenshots or review notes.
3. Set `GOOGLE_PLAY_ALLOW_TEST=true` only for the deliberate licensed-tester workflow; default is false. This does not accept forged receipts: Google still verifies each purchase.
4. Deploy `verify-google-subscription` with JWT verification enabled, and `check-subscription`, including their shared dependencies. The verifier additionally resolves the user through Supabase Auth before accepting purchase tokens.
5. Deploy `google-play-notifications` with platform JWT verification disabled only because the handler validates Google's signed OIDC JWT instead. Set `GOOGLE_PLAY_RTDN_AUDIENCE` to the exact endpoint URL and `GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL` to the exact authorized Pub/Sub push identity. Configure authenticated Pub/Sub push and Play real-time developer notifications for this app. Verify a signed test notification and reject wrong issuer, audience and email.
6. The existing local Android client/release work is integrated with main on this branch. Rebuild and sign an initial AAB, upload it privately, and configure the two base plans and license testers. An initial private AAB is needed before Google subscription setup; it is not production publication.
7. On the installed internal release, test actual purchase, acknowledgement, restoration, account switching, renewal, cancellation, grace period, hold, expiry and refund. Verify the real notification flow and the resulting profile access. Run a Google/Apple/Stripe overlap scenario. Check login redirects and native auth providers.
8. Complete native device verification, screenshots, Data safety, review credentials, content declarations and the production release. Nothing here declares that these steps have been completed.

## Behavior

Only Google's SubscriptionPurchaseV2 API determines access. Unknown products/plans, mismatched or absent account IDs and unapproved test purchases are rejected. Active, grace-period and canceled subscriptions retain access only until expiry. Pending, paused, on-hold and expired states grant none. Eligible unacknowledged purchases are acknowledged by the server. Retryable provider/database errors return 503 without disclosing tokens.

Tokens are stored only in the server-accessible purchase ledger. A unique token cannot move to another user. Fresh server observations override older observations; replaying an older snapshot cannot resurrect refunded access. Notifications re-fetch authoritative purchase state, not notification-supplied entitlement values. Existing known purchases are also refreshed when subscription status is checked.

Apple and Stripe state calculations exclude the Google overlay, and the profile update trigger recombines current independent access. Refunds must not erase another provider, lifetime access or a separate gift. Tests exercise both refund orders and equal provider expiry dates. Deployment validation must also inspect the real production trigger definitions and grants; local tests cannot substitute for that.

## Validation

- Full local Vitest suite: 113 files, 983 tests passed, including Google billing, Apple billing, native OAuth and push.
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
