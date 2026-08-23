import { describe, expect, it } from 'vitest';
import {
  hasActiveLocalPremium,
  shouldClearLocalPremium,
} from '../../../supabase/functions/_shared/localPremium';

const now = new Date('2026-08-23T17:10:00.000Z');

describe('check-subscription local trial rules', () => {
  it('recognizes a Postgres-style signup trial expiry', () => {
    expect(hasActiveLocalPremium('2026-08-30 17:04:08.2697+00', now)).toBe(true);
  });

  it('does not wipe an active local trial when Stripe has no subscription', () => {
    expect(shouldClearLocalPremium('premium', '2026-08-30 17:04:08.2697+00', now)).toBe(false);
  });
});
