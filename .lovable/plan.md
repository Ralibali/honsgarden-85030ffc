# Google Play launch check – result (read-only, nothing changed)

Backend: ref sikbymtrbhrofysgkqsj is the project's active Lovable Cloud backend and was reachable (database query and function endpoints answered).

- Migration 20260928072522_google_play_billing: NO – not in migration history; not in the local checkout either.
- verify-google-subscription: NO – production returns 404 NOT_FOUND; not in the local checkout.
- google-play-notifications: NO – production returns 404 NOT_FOUND; not in the local checkout.
- GOOGLE_PLAY_SERVICE_ACCOUNT: NO
- GOOGLE_PLAY_RTDN_AUDIENCE: NO
- GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL: NO
- Native auth redirect allowlist (Android/iOS, e.g. capacitor://localhost, https://localhost): UNAVAILABLE – no read access to Site URL / Additional Redirect URLs. Check these fields manually.

Cause: PR78 is not synced to this project. Next steps, only after your approval: sync PR78, run the migration, deploy both functions, and add the three secrets in Project Settings → Secrets.
