# Google Play billing: deployed backend, release work remains

Status verified through Lovable on 29 September 2026 for active backend `sikbymtrbhrofysgkqsj`:

- Migration `20260928072522_google_play_billing` is applied and recorded. Do not rerun it. The Drizzle migration file is a mirror of the same migration, not a second operation.
- `verify-google-subscription`, `check-subscription` and `google-play-notifications`, with six shared helpers, are deployed from the reviewed source.
- Purchase ledger RLS is enabled, clients have no grants, and billing RPCs are server-only.
- Unauthenticated verification/status requests returned 401. Notifications returned 503 while Google credentials were missing; configuration fails closed.
- The three Google secrets were absent at this verification. Limited service-account creation and notification setup are authorized and in progress; this does not establish payment readiness.
- Android uses `se.auroramedia.honsgarden`; iOS retains `se.honsgarden.app`. The old Android package belongs to another developer.
- Native redirect allowlist remains unverified. Check both platforms' exact callback and recovery URLs.

Next: complete private credentials, authenticated Pub/Sub notification setup, matching Android Firebase registration, signed initial bundle, subscription products and a licensed purchase/restore/lifecycle test. See `appstore/ANDROID.md`, `appstore/GOOGLE_BILLING.md` and `appstore/PUSH.md`. No Android production availability has been confirmed.
