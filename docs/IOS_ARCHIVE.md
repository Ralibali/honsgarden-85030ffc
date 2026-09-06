# iOS archive checklist

Reversible Capacitor prep only. No App Store submit, secrets, Fastlane, or RevenueCat.

1. `npm run build`
2. `npx cap sync ios`
3. Open `ios/App/App.xcodeproj` in Xcode (shared scheme **App**)
4. Product → Archive (Release uses production `aps-environment`)

Native Plus is StoreKit via `@capgo/native-purchases`, not RevenueCat or Stripe. Web Stripe Plus still syncs through `profiles.subscription_status`.

Store listing and review notes: [appstore/metadata.md](../appstore/metadata.md), [appstore/COMPLIANCE.md](../appstore/COMPLIANCE.md).
