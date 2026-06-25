import { describe, expect, it } from 'vitest';
import {
  buildRegionalPreferences,
  getCountryOption,
  isValidPostalCode,
  normalizePostalCode,
} from './regionalPreferences';

describe('regionalPreferences', () => {
  it('uses Swedish regional defaults for Sweden', () => {
    const preferences = buildRegionalPreferences('SE');

    expect(preferences).toMatchObject({
      countryCode: 'SE',
      languageCode: 'sv',
      locale: 'sv-SE',
      currencyCode: 'SEK',
      measurementSystem: 'metric',
      temperatureUnit: 'celsius',
    });
    expect(preferences.timeZone).toBeTruthy();
  });

  it('uses imperial measurements and Fahrenheit for the United States', () => {
    const preferences = buildRegionalPreferences('US');

    expect(preferences).toMatchObject({
      countryCode: 'US',
      languageCode: 'en',
      locale: 'en-US',
      currencyCode: 'USD',
      measurementSystem: 'imperial',
      temperatureUnit: 'fahrenheit',
    });
  });

  it('falls back to Sweden for an unsupported country code', () => {
    expect(getCountryOption('XX').code).toBe('SE');
  });

  it('normalizes and validates Swedish postal codes', () => {
    expect(normalizePostalCode('58 220', 'SE')).toBe('58220');
    expect(isValidPostalCode('58220', 'SE')).toBe(true);
    expect(isValidPostalCode('5822', 'SE')).toBe(false);
  });

  it('accepts alphanumeric postal codes in Canada and the UK', () => {
    expect(normalizePostalCode('k1a 0b1', 'CA')).toBe('K1A 0B1');
    expect(isValidPostalCode('K1A 0B1', 'CA')).toBe(true);
    expect(isValidPostalCode('SW1A 1AA', 'GB')).toBe(true);
  });

  it('accepts Dutch postal codes', () => {
    expect(isValidPostalCode('1012 AB', 'NL')).toBe(true);
    expect(isValidPostalCode('1012', 'NL')).toBe(false);
  });
});
