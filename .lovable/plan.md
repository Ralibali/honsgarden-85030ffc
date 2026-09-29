# Google Play billing: deployed backend, release work remains

Status verified through Lovable on 29 September 2026 for active backend `sikbymtrbhrofysgkqsj`:

- Migration `20260928072522_google_play_billing` is applied and recorded. Do not rerun it. The Drizzle migration file is a mirror of the same migration, not a second operation.
- `verify-google-subscription`, `check-subscription` and `google-play-notifications`, with six shared helpers, are deployed from the reviewed source.
- Purchase ledger RLS is enabled, clients have no grants, and billing RPCs are server-only.
- Unauthenticated verification/status requests returned 401. Notifications returned 503 while Google credentials were missing; configuration fails closed.
- The private Google verifier credential is configured, Android Publisher API is enabled, and the billing identity has app-scoped Play permissions with zero account-wide permissions. Its OAuth probe returned 200; querying the new package returned expected applicationNotFound before the first AAB. Authenticated RTDN setup is incomplete; actual purchases remain unverified.
- Android uses `se.auroramedia.honsgarden`; iOS retains `se.honsgarden.app`. The old Android package belongs to another developer.
- Matching Android Firebase configuration with both upload-certificate fingerprints is installed privately. Google sign-in uses external-browser Supabase OAuth, so no Firebase GoogleAuth client is required; actual redirect/provider flows remain unverified.

Next: complete authenticated Pub/Sub notification setup, verify the native redirect allowlist, finish the signed initial bundle, configure subscription products and run licensed purchase/restore/lifecycle and native push tests. See `appstore/ANDROID.md`, `appstore/GOOGLE_BILLING.md` and `appstore/PUSH.md`. No Android production availability has been confirmed.
