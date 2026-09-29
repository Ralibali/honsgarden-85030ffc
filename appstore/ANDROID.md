# Android release status — 29 September 2026

This is work in progress. No Android release has been uploaded or published.

The existing Play Console draft is **Hönsgården - digital hönsgård** in the existing organization account and has no package assigned. The console requires the first uploaded binary before subscription products can be configured. Our Android package is `se.auroramedia.honsgarden`, with minimum API 24 and target/compile API 36. The old Android package `se.honsgarden.app` belongs to another developer (Zero-Shot Labs) and must not be used. iOS retains its existing Apple bundle `se.honsgarden.app`.

## Prepared locally

- Capacitor Android project and Google Play Billing plugin integration.
- Native Plus page uses Google Play product prices, retries unavailable prices, and offers restore/manage actions. It cannot fall through to Stripe checkout.
- Proposed Play product `honsgarden_plus` with auto-renewing base plans `monthly` and `yearly`. These have **not** been created in Play Console. Intended Swedish prices follow the existing Plus offer: 39 SEK/month and 299 SEK/year; only actual store-returned prices appear in the app.
- Google purchase account IDs use SHA-256. Pending purchases do not grant access. Purchases must be verified and acknowledged by the server.
- External-browser OAuth and PKCE callback handling for native apps. Android manifest supports the app scheme. Android backup is disabled to avoid copying saved sessions between devices.
- Android icons and splash images have been generated from the existing approved Hönsgården resources. A fresh build and Capacitor sync are required for this integrated branch.
- Real remote push implementation is prepared locally; configuration, deployment and device verification remain. See [PUSH.md](PUSH.md).

Firebase project `honsgarden-c4e22` has FCM HTTP v1 enabled. Its earlier Android registration and local ignored configuration belong to the old package and cannot be reused for this release. Register `se.auroramedia.honsgarden` and replace `android/app/google-services.json` with the matching private configuration. Server credentials and remote-notification testing remain incomplete. Release builds refuse missing or mismatched Firebase configuration.

The previously built Android Debug APK predates that Firebase configuration and must be rebuilt. The earlier build compiled successfully (208 tasks) and its signature verified; this is not validation of the current branch. It targets API 36 and contains the billing and notification permissions. This is a local test build; there is no signed release AAB, Play upload or device test yet.

## Required before any release

1. Configure the deployed Google verifier and authenticated lifecycle notifications using [GOOGLE_BILLING.md](GOOGLE_BILLING.md). On 29 September Lovable applied the migration and deployed three handlers plus six shared helpers in the actual backend. RLS/client-grant/RPC checks passed; unauthenticated verification/status returned 401 and unconfigured notifications returned 503. The three Google credentials remain absent; actual purchases and restoration remain unverified.
2. Allow all four exact native redirects: `se.auroramedia.honsgarden://auth/callback`, `se.auroramedia.honsgarden://auth/recovery`, `se.honsgarden.app://auth/callback` and `se.honsgarden.app://auth/recovery`. Google OAuth and password recovery must return to the calling platform. Apple uses native identity-token sign-in on iOS; the unavailable Apple web/Android button remains hidden. The live redirect allowlist is not yet verified.
3. Configure, deploy and test real remote push notifications on both platforms as described in [PUSH.md](PUSH.md).
4. Complete web build, native build, signing and real-device/emulator checks. Never upload an old `dist` directory by mistake: build first, then sync Capacitor, then build the native package.
5. Upload an initial signed AAB privately to enable subscription setup, configure base plans/prices, and test a licensed sandbox purchase and restoration. Test renewal, cancellation, expiry, refund, pending payment, offline recovery, and another signed-in account.
6. Complete store listing and review every existing Data safety/app-content declaration against actual behavior. Upload screenshots from the real app. Complete release testing before production submission.

## Build

Use Java 21, Android SDK platform 36 and Build Tools 36.0.0. Run `npm ci`, `npm run build`, `npm run native:sync:android`, then the Gradle build in `android`. For both platforms use `npm run native:sync`, which syncs each with its own application ID; an ambiguous `npx cap sync` is rejected.

Keep local SDK configuration and all signing credentials out of Git. Release signing reads ignored `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`) or private environment variables `HONSGARDEN_UPLOAD_STORE_FILE`, `HONSGARDEN_UPLOAD_STORE_PASSWORD`, `HONSGARDEN_UPLOAD_KEY_ALIAS`, `HONSGARDEN_UPLOAD_KEY_PASSWORD`. A relative store path resolves from `android/`. Release builds refuse incomplete signing rather than producing an unsigned upload. A new private RSA3072 upload key was generated with a strong password on 29 September and saved with owner-only permissions outside the repository; the ignored local signing properties reference it. Preserve and privately back up this key and password for future updates. No store upload has taken place.

The store may only be described as published when Play Console confirms production availability. A draft, uploaded bundle, internal test or submitted review is not publication.
