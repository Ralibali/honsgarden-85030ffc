# Roadmap

- [x] Deploy Google Play billing backend from reviewed archive (/tmp/gp, 10 files): migration 20260928072522 applied and recorded, 3 functions + 6 shared helpers deployed unchanged, RLS/grants/responses verified.
- [ ] Complete the authorized private setup: add secrets GOOGLE_PLAY_SERVICE_ACCOUNT, GOOGLE_PLAY_RTDN_AUDIENCE, GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL in Project Settings → Secrets before Google Play launch; verify native auth redirect allowlist (Site URL / Additional Redirect URLs) manually.
