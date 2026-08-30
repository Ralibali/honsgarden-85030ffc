import { describe, expect, it } from 'vitest';
import { evaluateNativeReadiness, type NativeReadinessFacts } from '../nativeReadiness';

const READY_FACTS: NativeReadinessFacts = {
  capacitor: { appId: 'se.honsgarden.app', appName: 'Hönsgården', webDir: 'dist', hasServerUrl: false },
  ios: {
    projectExists: true,
    hasInfoPlist: true,
    hasEntitlements: true,
    hasPrivacyManifest: true,
    hasUsageDescriptions: true,
    declaresEncryption: true,
    hasAts: true,
    iconCount: 1,
    splashCount: 3,
    hasAppleSignIn: true,
    apsEnvironment: 'production',
    marketingVersion: '1.0',
    buildNumber: '1',
    storeKitProductIds: ['se.honsgarden.plus.monthly'],
  },
};

describe('native readiness evaluator', () => {
  it('passes a fully ready project as TESTFLIGHT_READY', () => {
    const report = evaluateNativeReadiness(READY_FACTS);
    expect(report.verdict).toBe('TESTFLIGHT_READY');
    expect(report.summary.fail).toBe(0);
    expect(report.summary.gated).toBe(0);
  });

  it('flags server.url as fail (Apple 4.2 wrapper risk)', () => {
    const report = evaluateNativeReadiness({
      ...READY_FACTS,
      capacitor: { ...READY_FACTS.capacitor, hasServerUrl: true },
    });
    expect(report.verdict).toBe('NOT_READY');
    expect(report.checks.find((c) => c.id === 'bundled_web')?.level).toBe('fail');
  });

  it('gates on development push environment instead of failing', () => {
    const report = evaluateNativeReadiness({
      ...READY_FACTS,
      ios: { ...READY_FACTS.ios, apsEnvironment: 'development' },
    });
    expect(report.verdict).toBe('GATED');
    expect(report.checks.find((c) => c.id === 'push_environment')?.level).toBe('gated');
    // ...men missing helt = fail
    const missing = evaluateNativeReadiness({
      ...READY_FACTS,
      ios: { ...READY_FACTS.ios, apsEnvironment: undefined },
    });
    expect(missing.checks.find((c) => c.id === 'push_environment')?.level).toBe('fail');
    expect(missing.verdict).toBe('NOT_READY');
  });

  it('fails without encryption declaration or privacy manifest', () => {
    const noEnc = evaluateNativeReadiness({
      ...READY_FACTS,
      ios: { ...READY_FACTS.ios, declaresEncryption: false },
    });
    expect(noEnc.verdict).toBe('NOT_READY');
    const noPrivacy = evaluateNativeReadiness({
      ...READY_FACTS,
      ios: { ...READY_FACTS.ios, hasPrivacyManifest: false },
    });
    expect(noPrivacy.verdict).toBe('NOT_READY');
  });

  it('fails without Sign in with Apple when third-party login exists', () => {
    const report = evaluateNativeReadiness({
      ...READY_FACTS,
      ios: { ...READY_FACTS.ios, hasAppleSignIn: false },
    });
    expect(report.checks.find((c) => c.id === 'apple_sign_in')?.level).toBe('fail');
  });

  it('fails without icons, versions or IAP products', () => {
    const bare = evaluateNativeReadiness({
      ...READY_FACTS,
      ios: { ...READY_FACTS.ios, iconCount: 0, marketingVersion: undefined, storeKitProductIds: [] },
    });
    expect(bare.checks.find((c) => c.id === 'icons')?.level).toBe('fail');
    expect(bare.checks.find((c) => c.id === 'versions')?.level).toBe('fail');
    expect(bare.checks.find((c) => c.id === 'iap_products')?.level).toBe('fail');
    expect(bare.verdict).toBe('NOT_READY');
  });

  it('handles entirely missing facts without crashing', () => {
    const report = evaluateNativeReadiness({ capacitor: {}, ios: {} });
    expect(report.verdict).toBe('NOT_READY');
    expect(report.summary.fail).toBeGreaterThan(5);
  });
});
