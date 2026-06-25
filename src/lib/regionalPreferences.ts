export type MeasurementSystem = 'metric' | 'imperial';
export type TemperatureUnit = 'celsius' | 'fahrenheit';

export type RegionalPreferences = {
  countryCode: string;
  languageCode: string;
  locale: string;
  timeZone: string;
  currencyCode: string;
  measurementSystem: MeasurementSystem;
  temperatureUnit: TemperatureUnit;
};

export type CountryOption = {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  languageCode: string;
  locale: string;
  defaultTimeZone: string;
  currencyCode: string;
  measurementSystem: MeasurementSystem;
  temperatureUnit: TemperatureUnit;
  postalCodePlaceholder: string;
  postalCodeInputMode?: 'text' | 'numeric';
};

/**
 * Initial launch markets. Adding a country here makes it available in the
 * registration selector without spreading regional assumptions through the UI.
 */
export const COUNTRY_OPTIONS: CountryOption[] = [
  {
    code: 'SE',
    name: 'Sweden',
    nativeName: 'Sverige',
    flag: '🇸🇪',
    languageCode: 'sv',
    locale: 'sv-SE',
    defaultTimeZone: 'Europe/Stockholm',
    currencyCode: 'SEK',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: '582 20',
    postalCodeInputMode: 'numeric',
  },
  {
    code: 'NO',
    name: 'Norway',
    nativeName: 'Norge',
    flag: '🇳🇴',
    languageCode: 'nb',
    locale: 'nb-NO',
    defaultTimeZone: 'Europe/Oslo',
    currencyCode: 'NOK',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: '0150',
    postalCodeInputMode: 'numeric',
  },
  {
    code: 'DK',
    name: 'Denmark',
    nativeName: 'Danmark',
    flag: '🇩🇰',
    languageCode: 'da',
    locale: 'da-DK',
    defaultTimeZone: 'Europe/Copenhagen',
    currencyCode: 'DKK',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: '2100',
    postalCodeInputMode: 'numeric',
  },
  {
    code: 'FI',
    name: 'Finland',
    nativeName: 'Suomi',
    flag: '🇫🇮',
    languageCode: 'fi',
    locale: 'fi-FI',
    defaultTimeZone: 'Europe/Helsinki',
    currencyCode: 'EUR',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: '00100',
    postalCodeInputMode: 'numeric',
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    nativeName: 'United Kingdom',
    flag: '🇬🇧',
    languageCode: 'en',
    locale: 'en-GB',
    defaultTimeZone: 'Europe/London',
    currencyCode: 'GBP',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: 'SW1A 1AA',
  },
  {
    code: 'US',
    name: 'United States',
    nativeName: 'United States',
    flag: '🇺🇸',
    languageCode: 'en',
    locale: 'en-US',
    defaultTimeZone: 'America/New_York',
    currencyCode: 'USD',
    measurementSystem: 'imperial',
    temperatureUnit: 'fahrenheit',
    postalCodePlaceholder: '10001',
    postalCodeInputMode: 'numeric',
  },
  {
    code: 'CA',
    name: 'Canada',
    nativeName: 'Canada',
    flag: '🇨🇦',
    languageCode: 'en',
    locale: 'en-CA',
    defaultTimeZone: 'America/Toronto',
    currencyCode: 'CAD',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: 'K1A 0B1',
  },
  {
    code: 'AU',
    name: 'Australia',
    nativeName: 'Australia',
    flag: '🇦🇺',
    languageCode: 'en',
    locale: 'en-AU',
    defaultTimeZone: 'Australia/Sydney',
    currencyCode: 'AUD',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: '2000',
    postalCodeInputMode: 'numeric',
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    nativeName: 'New Zealand',
    flag: '🇳🇿',
    languageCode: 'en',
    locale: 'en-NZ',
    defaultTimeZone: 'Pacific/Auckland',
    currencyCode: 'NZD',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: '6011',
    postalCodeInputMode: 'numeric',
  },
  {
    code: 'DE',
    name: 'Germany',
    nativeName: 'Deutschland',
    flag: '🇩🇪',
    languageCode: 'de',
    locale: 'de-DE',
    defaultTimeZone: 'Europe/Berlin',
    currencyCode: 'EUR',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: '10115',
    postalCodeInputMode: 'numeric',
  },
  {
    code: 'NL',
    name: 'Netherlands',
    nativeName: 'Nederland',
    flag: '🇳🇱',
    languageCode: 'nl',
    locale: 'nl-NL',
    defaultTimeZone: 'Europe/Amsterdam',
    currencyCode: 'EUR',
    measurementSystem: 'metric',
    temperatureUnit: 'celsius',
    postalCodePlaceholder: '1012 AB',
  },
];

const COUNTRY_BY_CODE = new Map(COUNTRY_OPTIONS.map((country) => [country.code, country]));

export function getCountryOption(countryCode: string): CountryOption {
  return COUNTRY_BY_CODE.get(countryCode.toUpperCase()) ?? COUNTRY_OPTIONS[0];
}

export function getBrowserTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * The country provides sensible defaults. The browser time zone wins because
 * countries such as the US, Canada and Australia span several time zones.
 */
export function buildRegionalPreferences(countryCode: string): RegionalPreferences {
  const country = getCountryOption(countryCode);
  return {
    countryCode: country.code,
    languageCode: country.languageCode,
    locale: country.locale,
    timeZone: getBrowserTimeZone() ?? country.defaultTimeZone,
    currencyCode: country.currencyCode,
    measurementSystem: country.measurementSystem,
    temperatureUnit: country.temperatureUnit,
  };
}

export function detectCountryCode(): string {
  try {
    const locale = navigator.languages?.[0] || navigator.language;
    const region = new Intl.Locale(locale).region;
    if (region && COUNTRY_BY_CODE.has(region)) return region;
  } catch {
    // Use the Swedish default below.
  }
  return 'SE';
}

export function normalizePostalCode(value: string, countryCode: string): string {
  const normalized = value.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 12);
  if (countryCode === 'SE') return normalized.replace(/\D/g, '').slice(0, 5);
  if (['NO', 'DK', 'AU', 'NZ'].includes(countryCode)) return normalized.replace(/\D/g, '').slice(0, 4);
  if (['FI', 'DE', 'US'].includes(countryCode)) return normalized.replace(/\D/g, '').slice(0, 5);
  return normalized;
}

export function isValidPostalCode(value: string, countryCode: string): boolean {
  if (!value.trim()) return true;
  const compact = value.replace(/\s/g, '').toUpperCase();
  switch (countryCode) {
    case 'SE':
    case 'FI':
    case 'DE':
    case 'US':
      return /^\d{5}$/.test(compact);
    case 'NO':
    case 'DK':
    case 'AU':
    case 'NZ':
      return /^\d{4}$/.test(compact);
    case 'CA':
      return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(compact);
    case 'GB':
      return /^[A-Z0-9]{5,7}$/.test(compact);
    case 'NL':
      return /^\d{4}[A-Z]{2}$/.test(compact);
    default:
      return compact.length >= 3;
  }
}
