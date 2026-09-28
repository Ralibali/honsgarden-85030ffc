import { describe, expect, it, vi } from 'vitest';
import { parseNativeAuthCallback } from '../nativeAuth';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

describe('native OAuth callback allowlist', () => {
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
});
