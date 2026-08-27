# iOS App Store compliance — digital Plus

This document is the review-note source for Guideline 3.1.1. It does not change Stripe price IDs on the web.

## Product classification

Hönsgården Plus unlocks in-app digital features (Agda AI, weekly insights, finance tools). It is **not** a reader app.

Apple’s reader exception in [Guideline 3.1.3(a)](https://developer.apple.com/app-store/review/guidelines/#payments) is limited to magazines, newspapers, books, audio, music, and video. Plus is a feature unlock, so that exception does not apply.

## Payment rule (2026)

[Guideline 3.1.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase) requires In-App Purchase to unlock features or functionality inside the app. Apps may not use their own checkout (including Stripe in a webview or in-app CTA) for that.

US storefronts and some EU/EEA storefronts can add an *additional* external purchase link only with a StoreKit External Purchase Link entitlement ([3.1.1(a)](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [ExternalPurchaseLink](https://developer.apple.com/documentation/storekit/externalpurchaselink)). This binary does **not** include that entitlement, so Stripe checkout CTAs are removed from the iOS app.

[Guideline 3.1.3(b)](https://developer.apple.com/app-store/review/guidelines/#other-purchase-methods) (multiplatform) allows users to keep access to subscriptions bought on the website, provided the same digital items are also offered as IAP in the app.

## What this build does

| Surface | Behavior |
| --- | --- |
| Web / PWA | Unchanged Stripe Checkout (39 / 299 SEK). Price IDs untouched. |
| iOS binary | StoreKit 2 auto-renewable subscriptions `se.honsgarden.plus.monthly` and `se.honsgarden.plus.yearly`. Restore purchases. App Store subscription management. |
| iOS + existing web Plus | `check-subscription` still honors `profiles.subscription_status` / `premium_expires_at` from Stripe. |
| iOS + IAP | Verified StoreKit JWS writes the same profile columns so web and iOS stay in sync. |
| Stripe CTA in iOS | Not shown. `create-checkout` also rejects `platform=ios`. |

If App Store Connect products are not live yet, the iOS Plus page hides buy buttons and keeps Restore + web-entitlement sync. That is only a TestFlight fallback — App Review submissions must have the IAP products configured and visible ([2.1(b)](https://developer.apple.com/app-store/review/guidelines/#app-completeness)).

## Other review items in this change

- Sign in with Apple is shown next to Google (Guideline 4.8). Native SIWA is used on iOS when the capability is enabled.
- Account deletion is in-app at `/app/settings#delete-account` and `/delete-account` (Guideline 5.1.1(v)).
- `PrivacyInfo.xcprivacy` declares required-reason APIs used by Capacitor.
- Info.plist adds photo-add usage text, ATS (no arbitrary loads), export-compliance flag, and URL schemes.

## Owner steps that cannot be done in this repo

1. Paid Apple Developer Program + 2FA.
2. App Store Connect app for bundle ID `se.honsgarden.app`.
3. Paid Applications agreement, tax, and banking.
4. Create the two auto-renewable IAP products and a subscription group.
5. Enable In-App Purchase + Sign in with Apple on the App ID.
6. Enable Apple as an auth provider (Supabase / Lovable).
7. Point App Store Server Notifications V2 at `…/functions/v1/apple-subscription-webhook`.
8. Screenshots, privacy answers, and a demo Plus account for review.
