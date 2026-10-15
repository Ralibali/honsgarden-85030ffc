import { describe, it, expect, beforeEach } from 'vitest';
import { parseAdsConsent, trackCompleteRegistration, ADS_CONSENT_KEY } from './metaPixel';

describe('Meta ads consent', () => {
  beforeEach(() => { localStorage.clear(); delete (window as any).fbq; });

  it('sends no registration event without advertising consent', () => {
    trackCompleteRegistration();
    expect(window.fbq).toBeUndefined();
  });

  it('sends no registration event after a refusal', () => {
    localStorage.setItem(ADS_CONSENT_KEY, JSON.stringify({ version: 1, ads: false, updatedAt: new Date().toISOString(), notice: 'x' }));
    trackCompleteRegistration();
    expect(window.fbq).toBeUndefined();
  });

  it('treats a choice older than 365 days as unanswered', () => {
    const old = new Date(Date.now() - 366 * 864e5).toISOString();
    expect(parseAdsConsent(JSON.stringify({ version: 1, ads: true, updatedAt: old, notice: 'x' }))).toBeNull();
  });
});
