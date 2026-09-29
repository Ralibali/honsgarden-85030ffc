import { afterEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ANDROID_APPLICATION_ID, IOS_APPLICATION_ID } from '../nativeAppIds';
import { GOOGLE_PACKAGE } from '../../../supabase/functions/_shared/googlePlay';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.resetModules(); });

describe('native application identity contract', () => {
  it.each(['ios', 'android'])('syncs %s with its own identifier', async (platform) => {
    vi.stubEnv('HONSGARDEN_NATIVE_PLATFORM', platform);
    vi.resetModules();
    const { default: config } = await import('../../../capacitor.config');
    expect(config.appId).toBe(platform === 'android' ? ANDROID_APPLICATION_ID : IOS_APPLICATION_ID);
    expect(config.server?.url).toBeUndefined();
  });
  it('refuses an ambiguous sync that could copy the Apple ID into Android', async () => {
    const previous = process.argv;
    try {
      process.argv = ['node', 'capacitor', 'sync'];
      vi.resetModules();
      await expect(import('../../../capacitor.config')).rejects.toThrow('native:sync');
    } finally { process.argv = previous; }
  });
  it('refuses a stale platform environment during an explicit iOS sync', async () => {
    const previous = process.argv;
    try {
      process.argv = ['node', 'capacitor', 'sync', 'ios'];
      vi.stubEnv('HONSGARDEN_NATIVE_PLATFORM', 'android');
      vi.resetModules();
      await expect(import('../../../capacitor.config')).rejects.toThrow('does not match');
    } finally { process.argv = previous; }
  });
  it('keeps the Play verifier, launcher and Android auth scheme on the same package', () => {
    expect(GOOGLE_PACKAGE).toBe(ANDROID_APPLICATION_ID);
    const gradle = read('android/app/build.gradle');
    expect(gradle).toContain(`namespace = "${ANDROID_APPLICATION_ID}"`);
    expect(gradle).toContain(`applicationId "${ANDROID_APPLICATION_ID}"`);
    expect(read(`android/app/src/main/java/${ANDROID_APPLICATION_ID.split('.').join('/')}/MainActivity.java`))
      .toContain(`package ${ANDROID_APPLICATION_ID};`);
    const manifest = read('android/app/src/main/AndroidManifest.xml');
    expect(manifest).toContain(`android:scheme="${ANDROID_APPLICATION_ID}"`);
    expect(manifest).not.toContain(`android:scheme="${IOS_APPLICATION_ID}"`);
  });
  it('preserves the existing Apple record, deep links and billing namespace', () => {
    const project = read('ios/App/App.xcodeproj/project.pbxproj');
    const identifiers = [...project.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) => m[1]);
    expect(identifiers.length).toBeGreaterThan(0);
    expect(new Set(identifiers)).toEqual(new Set([IOS_APPLICATION_ID]));
    expect(read('ios/App/App/Info.plist')).toContain(`<string>${IOS_APPLICATION_ID}</string>`);
    expect(read('supabase/functions/_shared/appleIap.ts')).toContain('se.honsgarden.plus.monthly');
  });
  it('resolves every checked-in Android dependency from the current checkout', () => {
    const settings = read('android/capacitor.settings.gradle');
    const paths = [...settings.matchAll(/projectDir = new File\('([^']+)'\)/g)].map((m) => m[1]);
    expect(paths).toHaveLength(8);
    for (const path of paths) {
      expect(path.startsWith('../node_modules/')).toBe(true);
      expect(existsSync(resolve(process.cwd(), 'android', path, 'build.gradle'))).toBe(true);
    }
  });
});
