import { describe, expect, it } from 'vitest';
import { parsePrivacyConsent } from './privacyConsent';
const decision = (updatedAt: string, analytics = true) => JSON.stringify({ version: 2, analytics, updatedAt });
describe('versioned consent validity', () => {
  it('rejects legacy, malformed, future and expired choices', () => {
    for (const raw of ['accepted', '{', JSON.stringify({ analytics: true }), decision(new Date(Date.now() + 60_000).toISOString()), decision(new Date(Date.now() - 366 * 86400000).toISOString())]) expect(parsePrivacyConsent(raw)).toBeNull();
  });
  it('retains a current explicit grant or refusal', () => {
    expect(parsePrivacyConsent(decision(new Date().toISOString()))?.analytics).toBe(true);
    expect(parsePrivacyConsent(decision(new Date().toISOString(), false))?.analytics).toBe(false);
  });
});
