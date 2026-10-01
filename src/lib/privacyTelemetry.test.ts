import { beforeEach, describe, expect, it } from 'vitest';
import { hasTelemetryConsent, telemetryPath, telemetryMetadata, telemetryReferrer } from './privacyTelemetry';

beforeEach(() => localStorage.clear());
describe('privacy telemetry', () => {
  it('requires the current explicit analytics decision and ignores the legacy choice', () => {
    localStorage.setItem('cookie-consent', 'accepted');
    expect(hasTelemetryConsent()).toBe(false);
    localStorage.setItem('honsgarden_ga4_consent_v2', JSON.stringify({ version: 2, analytics: true, updatedAt: new Date().toISOString() }));
    expect(hasTelemetryConsent()).toBe(true);
    localStorage.setItem('honsgarden_ga4_consent_v2', JSON.stringify({ version: 2, analytics: false, updatedAt: new Date().toISOString() }));
    expect(hasTelemetryConsent()).toBe(false);
  });
  it('excludes private routes, query strings, fragments and unique identifiers', () => {
    expect(telemetryPath('/admin/example?email=person@example.se')).toBeNull();
    expect(telemetryPath('/blogg/artikel?email=person@example.se#token')).toBe('/blogg/artikel');
    expect(telemetryPath('/bana/12345678-abcd-4abc-abcd-123456789012')).toBe('/bana/:id');
    expect(telemetryPath('mailto:person@example.se')).toBeNull();
  });
  it('keeps only non-personal event dimensions', () => {
    expect(telemetryMetadata({ source: 'landing', email: 'person@example.se', href: '/?token=secret', name: 'Person', note: 'Private free text', amount: 2 })).toEqual({ source: 'landing', amount: 2 });
  });
  it('uses only the referrer origin', () => {
    Object.defineProperty(document, 'referrer', { configurable: true, value: 'https://example.se/private?email=person@example.se#secret' });
    expect(telemetryReferrer()).toBe('https://example.se');
  });
});
