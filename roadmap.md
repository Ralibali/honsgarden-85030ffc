# Roadmap

- [x] Deploy Google Play billing backend from reviewed archive (/tmp/gp, 10 files): migration 20260928072522 applied and recorded, 3 functions + 6 shared helpers deployed unchanged, RLS/grants/responses verified.
- [x] Configure private Google verifier credentials and Android Publisher API; scope Play billing identity to Hönsgården with zero account-wide permissions. Register the new Android Firebase app and both upload certificate fingerprints.
- [ ] Complete authenticated RTDN/PubSub setup (GOOGLE_PLAY_RTDN_AUDIENCE and GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT_EMAIL); verify native auth redirect allowlist and actual native login/recovery. Complete signed bundle, licensed Play purchase/restore/lifecycle, push and real-device release validation.
