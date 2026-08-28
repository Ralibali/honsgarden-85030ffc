import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isNewAuthAccount,
  maybeTrackAuthSignup,
  resetSignupTrackingForTests,
  trackSignupIfNew,
  type AuthAccountSnapshot,
} from '@/lib/analytics';

const CREATED = '2026-08-28T16:00:00.000Z';
const SAME_INSTANT = '2026-08-28T16:00:00.200Z';
const LATER_LOGIN = '2026-08-28T17:00:00.000Z';

function emailNewUser(overrides: Partial<AuthAccountSnapshot> = {}): AuthAccountSnapshot {
  return {
    id: 'user-email-new',
    created_at: CREATED,
    last_sign_in_at: null,
    identities: [{ provider: 'email', created_at: CREATED, last_sign_in_at: null }],
    ...overrides,
  };
}

function oauthNewUser(overrides: Partial<AuthAccountSnapshot> = {}): AuthAccountSnapshot {
  return {
    id: 'user-oauth-new',
    created_at: CREATED,
    last_sign_in_at: SAME_INSTANT,
    app_metadata: { provider: 'google', providers: ['google'] },
    identities: [{ provider: 'google', created_at: CREATED, last_sign_in_at: SAME_INSTANT }],
    ...overrides,
  };
}

function oauthReturningUser(): AuthAccountSnapshot {
  return oauthNewUser({
    id: 'user-oauth-old',
    last_sign_in_at: LATER_LOGIN,
    identities: [{ provider: 'google', created_at: CREATED, last_sign_in_at: LATER_LOGIN }],
  });
}

describe('isNewAuthAccount', () => {
  it('is true for a real email signUp (identities present, no prior sign-in)', () => {
    expect(isNewAuthAccount(emailNewUser())).toBe(true);
  });

  it('is true for a first-time OAuth session (created_at ≈ last_sign_in_at)', () => {
    expect(isNewAuthAccount(oauthNewUser())).toBe(true);
  });

  it('is false for a returning OAuth login', () => {
    expect(isNewAuthAccount(oauthReturningUser())).toBe(false);
  });

  it('is false for a returning email login', () => {
    expect(
      isNewAuthAccount(
        emailNewUser({
          last_sign_in_at: LATER_LOGIN,
          identities: [{ provider: 'email', created_at: CREATED, last_sign_in_at: LATER_LOGIN }],
        }),
      ),
    ).toBe(false);
  });

  it('is false for Supabase anti-enumeration signUp (empty identities)', () => {
    expect(isNewAuthAccount(emailNewUser({ identities: [] }))).toBe(false);
  });

  it('is false without a user id or for anonymous users', () => {
    expect(isNewAuthAccount(emailNewUser({ id: null }))).toBe(false);
    expect(isNewAuthAccount(emailNewUser({ is_anonymous: true }))).toBe(false);
    expect(isNewAuthAccount(null)).toBe(false);
  });
});

describe('trackSignupIfNew / maybeTrackAuthSignup', () => {
  const plausible = vi.fn();

  beforeEach(() => {
    resetSignupTrackingForTests();
    localStorage.clear();
    plausible.mockReset();
    window.plausible = plausible;
  });

  afterEach(() => {
    resetSignupTrackingForTests();
    localStorage.clear();
    delete window.plausible;
  });

  it('fires Signup Completed once for a new email account', () => {
    const user = emailNewUser({ id: 'signup-once' });
    expect(trackSignupIfNew(user, { source: 'signup_form' })).toBe(true);
    expect(trackSignupIfNew(user, { source: 'signup_form' })).toBe(false);

    expect(plausible).toHaveBeenCalledTimes(1);
    expect(plausible).toHaveBeenCalledWith('Signup Completed', {
      props: { source: 'signup_form' },
    });
  });

  it('does not fire for a returning login-shaped user', () => {
    expect(trackSignupIfNew(oauthReturningUser())).toBe(false);
    expect(
      trackSignupIfNew(
        emailNewUser({
          id: 'login-user',
          last_sign_in_at: LATER_LOGIN,
          identities: [{ provider: 'email', created_at: CREATED, last_sign_in_at: LATER_LOGIN }],
        }),
      ),
    ).toBe(false);
    expect(plausible).not.toHaveBeenCalled();
  });

  it('fires on SIGNED_IN only for a first-time OAuth account', () => {
    expect(maybeTrackAuthSignup('SIGNED_IN', oauthNewUser({ id: 'oauth-signed-in' }))).toBe(true);
    expect(plausible).toHaveBeenCalledTimes(1);
    expect(plausible).toHaveBeenCalledWith('Signup Completed', undefined);
  });

  it('does not fire OAuth Signup on login, refresh, or email SIGNED_IN', () => {
    expect(maybeTrackAuthSignup('SIGNED_IN', oauthReturningUser())).toBe(false);
    expect(maybeTrackAuthSignup('INITIAL_SESSION', oauthNewUser({ id: 'oauth-init' }))).toBe(false);
    expect(maybeTrackAuthSignup('TOKEN_REFRESHED', oauthNewUser({ id: 'oauth-refresh' }))).toBe(false);
    expect(maybeTrackAuthSignup('SIGNED_IN', emailNewUser({ id: 'email-signed-in' }))).toBe(false);
    expect(plausible).not.toHaveBeenCalled();
  });
});
