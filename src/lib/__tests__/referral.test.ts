import { describe, expect, it } from 'vitest';
import { buildReferralShareUrl, isReferralCode, normalizeReferralCode } from '../referral';

describe('isReferralCode (/r/:token dispatch)', () => {
  it('accepts short alphanumeric referral codes', () => {
    expect(isReferralCode('A1B2C3')).toBe(true);
    expect(isReferralCode('abcd')).toBe(true);
    expect(isReferralCode('X9Y8Z7W1V2U3')).toBe(true); // 12 tecken ok
  });

  it('rejects review UUIDs so /r/:uuid keeps rendering PublicReview', () => {
    expect(isReferralCode('550e8400-e29b-41d4-a716-446655440000')).toBe(false); // innehåller '-'
    expect(isReferralCode('550e8400e29b41d4a716446655440000')).toBe(false); // 32 tecken > 12
  });

  it('rejects empty, too short and non-alphanumeric tokens', () => {
    expect(isReferralCode('')).toBe(false);
    expect(isReferralCode('AB1')).toBe(false);
    expect(isReferralCode('AB CD')).toBe(false);
    expect(isReferralCode('ÅÄÖ123')).toBe(false);
  });
});

describe('normalizeReferralCode', () => {
  it('uppercases and strips everything except A-Z0-9', () => {
    expect(normalizeReferralCode('a1b2c3')).toBe('A1B2C3');
    expect(normalizeReferralCode(' a1-b2!!c3 ')).toBe('A1B2C3');
    expect(normalizeReferralCode('')).toBe('');
  });
});

describe('buildReferralShareUrl', () => {
  it('uses the current origin on production domains', () => {
    expect(buildReferralShareUrl('A1B2C3', 'honsgarden.se', 'https://honsgarden.se')).toBe(
      'https://honsgarden.se/r/A1B2C3',
    );
    expect(buildReferralShareUrl('A1B2C3', 'www.honsgarden.se', 'https://www.honsgarden.se')).toBe(
      'https://www.honsgarden.se/r/A1B2C3',
    );
    expect(buildReferralShareUrl('A1B2C3', 'honsgarden.app', 'https://honsgarden.app')).toBe(
      'https://honsgarden.app/r/A1B2C3',
    );
  });

  it('never shares preview or localhost links', () => {
    expect(buildReferralShareUrl('A1B2C3', 'preview--x.lovableproject.com', 'https://preview--x.lovableproject.com')).toBe(
      'https://honsgarden.se/r/A1B2C3',
    );
    expect(buildReferralShareUrl('A1B2C3', 'localhost', 'http://localhost:5173')).toBe(
      'https://honsgarden.se/r/A1B2C3',
    );
    expect(buildReferralShareUrl('A1B2C3', '', '')).toBe('https://honsgarden.se/r/A1B2C3');
  });

  it('returns empty string without a code (card renders nothing)', () => {
    expect(buildReferralShareUrl('', 'honsgarden.se', 'https://honsgarden.se')).toBe('');
  });
});
