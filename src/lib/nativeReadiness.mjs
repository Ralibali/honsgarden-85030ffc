/**
 * Native readiness (Swarm R) — ren utvärderare, skriptvariant.
 *
 * Bedömer om iOS-appen är redo för TestFlight utifrån fakta som
 * scripts/native-readiness.mjs samlar in från filsystemet. HÅLLS I SYNK
 * med nativeReadiness.ts (typad spegel som testerna kör mot).
 *
 * Området är medvetet konservativt: ett "gated" betyder att ett
 * mänskligt steg krävs före release (t.ex. aps-environment=production
 * i releasekonfigurationen) — aldrig automatiska App Store-ändringar.
 */

export const READINESS_LEVELS = ['pass', 'gated', 'fail'];

/**
 * facts: {
 *   capacitor: { appId, appName, webDir, hasServerUrl },
 *   ios: { projectExists, hasInfoPlist, hasEntitlements, hasPrivacyManifest,
 *          hasUsageDescriptions, declaresEncryption, hasAts,
 *          iconCount, splashCount, hasAppleSignIn, apsEnvironment,
 *          marketingVersion, buildNumber, storeKitProductIds: [] }
 * }
 */
export function evaluateNativeReadiness(facts) {
  const checks = [];
  const add = (id, level, label, detail = '') => checks.push({ id, level, label, detail });

  // --- Capacitor-grund ---
  const cap = facts.capacitor || {};
  add('app_id', cap.appId && cap.appId.includes('.') ? 'pass' : 'fail', 'Bundle-ID satt', cap.appId || 'saknas');
  add('app_name', cap.appName ? 'pass' : 'fail', 'App-namn satt', cap.appName || 'saknas');
  add(
    'bundled_web',
    cap.hasServerUrl ? 'fail' : 'pass',
    'Appen laddar inbyggda filer (ingen server.url)',
    cap.hasServerUrl ? 'server.url hittad — wrapper-risk (Apple 4.2) och dev-rest' : `webDir: ${cap.webDir || 'okänd'}`,
  );

  // --- iOS-projekt ---
  const ios = facts.ios || {};
  add('ios_project', ios.projectExists ? 'pass' : 'fail', 'iOS-projekt finns', ios.projectExists ? 'ios/App' : 'saknas');
  add('info_plist', ios.hasInfoPlist ? 'pass' : 'fail', 'Info.plist finns');
  add(
    'usage_descriptions',
    ios.hasUsageDescriptions ? 'pass' : 'fail',
    'Behörighetstexter (kamera/bibliotek)',
    'Krävs för fotofunktioner — Apple avvisar annars binären direkt',
  );
  add(
    'encryption_declaration',
    ios.declaresEncryption ? 'pass' : 'fail',
    'Kryptodeklaration (ITSAppUsesNonExemptEncryption)',
    'Utan den stoppas varje TestFlight-export av ett manuellt steg',
  );
  add('privacy_manifest', ios.hasPrivacyManifest ? 'pass' : 'fail', 'PrivacyInfo.xcprivacy', 'Obligatoriskt sedan 2024 för SDK:er med accessed APIs');
  add('icons', (ios.iconCount ?? 0) > 0 ? 'pass' : 'fail', 'App-ikoner', `${ios.iconCount ?? 0} ikonfiler`);
  add('splash', (ios.splashCount ?? 0) > 0 ? 'pass' : 'fail', 'Splash-bilder', `${ios.splashCount ?? 0} bilder`);
  add(
    'versions',
    ios.marketingVersion && ios.buildNumber ? 'pass' : 'fail',
    'Versionsnummer',
    `MARKETING_VERSION=${ios.marketingVersion || '?'} CURRENT_PROJECT_VERSION=${ios.buildNumber || '?'}`,
  );

  // --- Tjänster ---
  add('apple_sign_in', ios.hasAppleSignIn ? 'pass' : 'fail', 'Sign in with Apple-entitlement', 'Obligatoriskt när tredjepartsinlogg (Google) erbjuds');
  if (ios.apsEnvironment === 'production') {
    add('push_environment', 'pass', 'Push-miljö (aps-environment)', 'production');
  } else if (ios.apsEnvironment === 'development') {
    add(
      'push_environment',
      'gated',
      'Push-miljö (aps-environment)',
      'development — sätts till production i release-konfigurationen före TestFlight',
    );
  } else {
    add('push_environment', 'fail', 'Push-miljö (aps-environment)', 'saknas i App.entitlements');
  }
  const skCount = (ios.storeKitProductIds || []).length;
  add(
    'iap_products',
    skCount > 0 ? 'pass' : 'fail',
    'IAP-produkter (StoreKit-konfiguration)',
    skCount > 0 ? `${skCount} produkt(er): ${(ios.storeKitProductIds || []).join(', ')}` : 'Products.storekit saknar produkter',
  );

  const fails = checks.filter((c) => c.level === 'fail').length;
  const gated = checks.filter((c) => c.level === 'gated').length;
  const verdict = fails > 0 ? 'NOT_READY' : gated > 0 ? 'GATED' : 'TESTFLIGHT_READY';
  return { verdict, checks, summary: { pass: checks.filter((c) => c.level === 'pass').length, gated, fail: fails } };
}
