import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  hasActiveLocalPremium,
  shouldClearLocalPremium,
  shouldGrantSignupTrial,
  signupTrialEndFromCreatedAt,
} from '../../../supabase/functions/_shared/localPremium';

const now = new Date('2026-08-23T17:10:00.000Z');
const createdAt = '2026-08-23T16:00:00.000Z';

describe('check-subscription local trial rules', () => {
  it('recognizes a Postgres-style signup trial expiry', () => {
    expect(hasActiveLocalPremium('2026-08-30 17:04:08.2697+00', now)).toBe(true);
  });

  it('does not wipe an active local trial when Stripe has no subscription', () => {
    expect(shouldClearLocalPremium('premium', '2026-08-30 17:04:08.2697+00', now)).toBe(false);
  });
});

describe('check-subscription signup trial grant', () => {
  it('grants created_at + 7 days for a never-paid new account with no expiry', () => {
    const result = shouldGrantSignupTrial({
      userCreatedAt: createdAt,
      premiumExpiresAt: null,
      now,
    });
    expect(result).toEqual({
      grant: true,
      expiresAt: signupTrialEndFromCreatedAt(createdAt),
    });
    expect(new Date((result as { expiresAt: string }).expiresAt).getTime()).toBe(
      new Date(createdAt).getTime() + 7 * 24 * 60 * 60 * 1000,
    );
  });

  it('does not re-grant after a used, Stripe, Apple, or lifetime entitlement', () => {
    expect(shouldGrantSignupTrial({
      userCreatedAt: createdAt,
      premiumExpiresAt: '2026-08-20T12:00:00.000Z',
      now,
    }).grant).toBe(false);
    expect(shouldGrantSignupTrial({
      userCreatedAt: createdAt,
      stripeCustomerId: 'cus_123',
      now,
    }).grant).toBe(false);
    expect(shouldGrantSignupTrial({
      userCreatedAt: createdAt,
      applePaid: true,
      now,
    }).grant).toBe(false);
    expect(shouldGrantSignupTrial({
      userCreatedAt: createdAt,
      isLifetime: true,
      now,
    }).grant).toBe(false);
    expect(shouldGrantSignupTrial({
      userCreatedAt: '2026-08-01T16:00:00.000Z',
      premiumExpiresAt: null,
      now,
    }).grant).toBe(false);
  });

  it('is wired into check-subscription so a missing trigger grant is repaired', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'supabase/functions/check-subscription/index.ts'),
      'utf8',
    );
    expect(source).toContain('shouldGrantSignupTrial');
    expect(source).toContain('signup trial grant failed');
    expect(source).toContain('premium_type: "trial"');
  });
});
