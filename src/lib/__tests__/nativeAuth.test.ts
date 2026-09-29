import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getNativeAuthRedirect, parseNativeAuthCallback } from '../nativeAuth';
const platform = vi.hoisted(() => ({ android: false }));
vi.mock('@/lib/nativePlatform', () => ({ isNativeAndroid: () => platform.android, isNativePlatform: () => true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

describe('native OAuth callback allowlist', () => {
  beforeEach(() => { platform.android = false; });
  it.each([
    'https://honsgarden.se/auth/callback?code=x',
    'se.honsgarden.app://other/callback?code=x',
    'se.honsgarden.app://auth/other?code=x',
    'se.honsgarden.app://attacker@auth/callback?code=x',
    'se.honsgarden.app://auth/callback?code=x&code=y',
    'se.honsgarden.app://auth/callback#access_token=untrusted',
    'not a URL',
  ])('does not accept an unrelated or ambiguous callback: %s', (url) => {
    expect(parseNativeAuthCallback(url)).toBeNull();
  });
  it('accepts only a code for the local PKCE exchange', () => {
    expect(parseNativeAuthCallback('se.honsgarden.app://auth/callback?code=one-use-code'))
      .toEqual({ code: 'one-use-code', recovery: false });
    expect(parseNativeAuthCallback('se.honsgarden.app://auth/recovery?code=one-use-code'))
      .toEqual({ code: 'one-use-code', recovery: true });
  });
  it('does not expose provider-supplied error text', () => {
    expect(() => parseNativeAuthCallback('se.honsgarden.app://auth/callback?error=secret-value'))
      .toThrow('Inloggningen avbröts eller kunde inte slutföras.');
  });
  it.each([
    [false, 'se.honsgarden.app', 'se.auroramedia.honsgarden'],
    [true, 'se.auroramedia.honsgarden', 'se.honsgarden.app'],
  ])('uses only this platform for OAuth and password recovery (Android=%s)', (android, own, other) => {
    platform.android = android;
    expect(getNativeAuthRedirect()).toBe(`${own}://auth/callback`);
    expect(getNativeAuthRedirect(true)).toBe(`${own}://auth/recovery`);
    for (const path of ['callback', 'recovery']) {
      expect(parseNativeAuthCallback(`${own}://auth/${path}?code=one-use-code`))
        .toEqual({ code: 'one-use-code', recovery: path === 'recovery' });
      expect(parseNativeAuthCallback(`${other}://auth/${path}?code=one-use-code`)).toBeNull();
    }
  });
});
