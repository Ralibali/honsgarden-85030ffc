#!/usr/bin/env node
/**
 * Native readiness-check (Swarm R).
 *
 * Samlar fakta från repo-filsystemet och låter den rena utvärderaren i
 * src/lib/nativeReadiness.mjs avgöra TestFlight-beredskap. Oberoende
 * granskare: försöker bevisa att appen INTE är redo.
 *
 *   node scripts/native-readiness.mjs          # rapport, exit 0
 *   node scripts/native-readiness.mjs --check  # exit 1 vid fail
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateNativeReadiness } from '../src/lib/nativeReadiness.mjs';

const ROOT = new URL('..', import.meta.url).pathname;

const read = (p) => {
  try {
    return readFileSync(join(ROOT, p), 'utf8');
  } catch {
    return null;
  }
};

const countFiles = (dir, ext) => {
  try {
    return readdirSync(join(ROOT, dir)).filter((f) => f.endsWith(ext)).length;
  } catch {
    return 0;
  }
};

function collectFacts() {
  const capSrc = read('capacitor.config.ts') || '';
  const plist = read('ios/App/App/Info.plist') || '';
  const entitlements = read('ios/App/App/App.entitlements') || '';
  const privacy = read('ios/App/App/PrivacyInfo.xcprivacy') || '';
  const pbxproj = read('ios/App/App.xcodeproj/project.pbxproj') || '';
  const storekit = read('ios/App/App/Products.storekit') || '';

  const serverBlock = /server\s*:\s*\{[^}]*url/s.test(capSrc) && !/^\s*\/\/[^\n]*server\s*:/m.test(capSrc);
  // Kommenterade server-block räknas inte — bara faktisk aktiv konfig.
  const activeServerUrl = /^\s*server\s*:\s*\{/m.test(capSrc);

  return {
    capacitor: {
      appId: (capSrc.match(/appId:\s*'([^']+)'/) || [])[1],
      appName: (capSrc.match(/appName:\s*'([^']+)'/) || [])[1],
      webDir: (capSrc.match(/webDir:\s*'([^']+)'/) || [])[1],
      hasServerUrl: serverBlock && activeServerUrl,
    },
    ios: {
      projectExists: existsSync(join(ROOT, 'ios/App')),
      hasInfoPlist: plist.length > 0,
      hasEntitlements: entitlements.length > 0,
      hasPrivacyManifest:
        privacy.includes('NSPrivacyCollectedDataTypes') && privacy.includes('NSPrivacyAccessedAPITypes'),
      hasUsageDescriptions:
        plist.includes('NSCameraUsageDescription') && plist.includes('NSPhotoLibraryUsageDescription'),
      declaresEncryption: plist.includes('ITSAppUsesNonExemptEncryption'),
      hasAts: plist.includes('NSAppTransportSecurity'),
      iconCount: countFiles('ios/App/App/Assets.xcassets/AppIcon.appiconset', '.png'),
      splashCount: countFiles('ios/App/App/Assets.xcassets/Splash.imageset', '.png'),
      hasAppleSignIn: entitlements.includes('com.apple.developer.applesignin'),
      apsEnvironment: (entitlements.match(/<key>aps-environment<\/key>\s*<string>([^<]+)<\/string>/) || [])[1],
      marketingVersion: (pbxproj.match(/MARKETING_VERSION = ([^;]+);/) || [])[1],
      buildNumber: (pbxproj.match(/CURRENT_PROJECT_VERSION = ([^;]+);/) || [])[1],
      storeKitProductIds: [...storekit.matchAll(/"productID"\s*:\s*"([^"]+)"/g)].map((m) => m[1]),
    },
  };
}

const ICON = { pass: '✅', gated: '🟡', fail: '❌' };

const facts = collectFacts();
const report = evaluateNativeReadiness(facts);

console.log('\n📱 Native readiness — iOS / TestFlight\n');
for (const c of report.checks) {
  console.log(`${ICON[c.level]} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
}
console.log(
  `\nSlutomdöme: ${report.verdict} (${report.summary.pass} pass, ${report.summary.gated} gated, ${report.summary.fail} fail)\n`,
);
if (report.verdict !== 'TESTFLIGHT_READY') {
  console.log('GATED/NOT_READY = bygg- och mänskliga steg kvar före TestFlight. Inga App Store-ändringar sker automatiskt.');
}

if (process.argv.includes('--check') && report.summary.fail > 0) process.exit(1);
