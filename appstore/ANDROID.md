# Android release status — 28 September 2026

This is work in progress. No Android release has been uploaded or published.

The existing Play Console application is **Hönsgården - digital hönsgård** in the existing organization account. The console requires the first uploaded binary before subscription products can be configured. The package is `se.honsgarden.app`, with minimum API 24 and target/compile API 36.

## Prepared locally

- Capacitor Android project and Google Play Billing plugin integration.
- Native Plus page uses Google Play product prices, retries unavailable prices, and offers restore/manage actions. It cannot fall through to Stripe checkout.
- Proposed Play product `honsgarden_plus` with auto-renewing base plans `monthly` and `yearly`. These have **not** been created in Play Console. Intended Swedish prices follow the existing Plus offer: 39 SEK/month and 299 SEK/year; only actual store-returned prices appear in the app.
- Google purchase account IDs use SHA-256. Pending purchases do not grant access. Purchases must be verified and acknowledged by the server.
- External-browser OAuth and PKCE callback handling for native apps. Android manifest supports the app scheme. Android backup is disabled to avoid copying saved sessions between devices.
- Android icons and splash images have been generated from the existing approved Hönsgården resources. A fresh build and Capacitor sync are required for this integrated branch.
- Real remote push implementation is prepared locally; configuration, deployment and device verification remain. See [PUSH.md](PUSH.md).

Firebase project `honsgarden-c4e22` and its Android registration are now configured, with FCM HTTP v1 enabled. The ignored Google services configuration exists in the original local release workspace; it is not included in this branch. Server credentials and remote-notification testing remain incomplete.

The previously built Android Debug APK predates that Firebase configuration and must be rebuilt. The earlier build compiled successfully (208 tasks) and its signature verified; this is not validation of the current branch. It targets API 36 and contains the billing and notification permissions. This is a local test build; there is no signed release AAB, Play upload or device test yet.

## Required before any release

1. Deploy and configure the implemented Google verifier and authenticated lifecycle notifications using [GOOGLE_BILLING.md](GOOGLE_BILLING.md). Local unit and isolated database tests pass; the production backend remains inaccessible through the connected Supabase account and the Lovable project shows no credits. No live deployment or real payment test has taken place.
2. Add exact native redirect allowlist entries in the authentication provider: `se.honsgarden.app://auth/callback` and `se.honsgarden.app://auth/recovery`. Confirm Google and Apple provider configuration supports these native flows. Lovable Auth was inspected: Email, Google and Apple are enabled, but the visible redirect URL list contains web destinations only and does not show either native URL. No auth setting was changed.
3. Configure, deploy and test real remote push notifications on both platforms as described in [PUSH.md](PUSH.md).
4. Complete web build, native build, signing and real-device/emulator checks. Never upload an old `dist` directory by mistake: build first, then sync Capacitor, then build the native package.
5. Upload an initial signed AAB privately to enable subscription setup, configure base plans/prices, and test a licensed sandbox purchase and restoration. Test renewal, cancellation, expiry, refund, pending payment, offline recovery, and another signed-in account.
6. Complete store listing and review every existing Data safety/app-content declaration against actual behavior. Upload screenshots from the real app. Complete release testing before production submission.

## Build

Use Java 21, Android SDK platform 36 and Build Tools 36.0.0. Run `npm ci`, `npm run build`, `npx cap sync android`, then the Gradle build in `android`. Keep local SDK configuration and all signing credentials out of Git. The checked-in release configuration currently has no upload signing key.

The store may only be described as published when Play Console confirms production availability. A draft, uploaded bundle, internal test or submitted review is not publication.
