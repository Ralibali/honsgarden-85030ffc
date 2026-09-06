import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isConfirmedSignupTrial, profileHasSignupTrial, signupResultToast } from '@/lib/signupTrial';

const future = '2026-09-13T10:00:00.000Z';
const past = '2026-08-01T10:00:00.000Z';
const now = new Date('2026-09-06T10:00:00.000Z');

describe('signup trial toast vs entitlement', () => {
  it('treats a profiles row as a real signup trial only with premium + future expiry', () => {
    expect(profileHasSignupTrial({
      subscriptionStatus: 'premium',
      premiumExpiresAt: future,
      now,
    })).toBe(true);
    expect(profileHasSignupTrial({
      subscriptionStatus: 'free',
      premiumExpiresAt: future,
      now,
    })).toBe(false);
    expect(profileHasSignupTrial({
      subscriptionStatus: 'premium',
      premiumExpiresAt: null,
      now,
    })).toBe(false);
    expect(profileHasSignupTrial({
      subscriptionStatus: 'premium',
      premiumExpiresAt: past,
      now,
    })).toBe(false);
  });

  it('confirms trial only when premium_type is trial and expiry is still in the future', () => {
    expect(isConfirmedSignupTrial({
      premiumType: 'trial',
      subscriptionEnd: future,
      now,
    })).toBe(true);
    expect(isConfirmedSignupTrial({
      premiumType: 'trial',
      subscriptionEnd: past,
      now,
    })).toBe(false);
    expect(isConfirmedSignupTrial({
      premiumType: 'free',
      subscriptionEnd: future,
      now,
    })).toBe(false);
    expect(isConfirmedSignupTrial({
      premiumType: 'trial',
      subscriptionEnd: null,
      now,
    })).toBe(false);
  });

  it('claims 7-day Premium in the toast only after the grant is confirmed', () => {
    expect(signupResultToast({ trialConfirmed: true }).description).toMatch(/sju dagars gratis Premium/);
    expect(signupResultToast({ trialConfirmed: true, hasReferral: true }).description).toMatch(/sju dagars gratis Premium/);

    const unconfirmed = signupResultToast({ trialConfirmed: false });
    expect(unconfirmed.description).not.toMatch(/Premium/i);
    expect(unconfirmed.description).toMatch(/Logga in/);
    expect(signupResultToast({ trialConfirmed: false, hasReferral: true }).description).not.toMatch(/Premium/i);
  });

  it('wires Login and useAuth so the toast cannot fire before a confirmed grant', () => {
    const login = readFileSync(resolve(process.cwd(), 'src/pages/Login.tsx'), 'utf8');
    const auth = readFileSync(resolve(process.cwd(), 'src/hooks/useAuth.tsx'), 'utf8');
    expect(login).toContain('signupResultToast');
    expect(login).toContain('data?.trialConfirmed');
    expect(login).not.toMatch(/toast\(\{\s*title: 'Konto skapat!',\s*description: referralCode/);
    expect(auth).toContain('syncSubscriptionStatus');
    expect(auth).toContain('profileHasSignupTrial');
    expect(auth).toContain('premium_expires_at');
    expect(auth).toContain('trialConfirmed');
    expect(auth).toContain('check-subscription');
  });
});
