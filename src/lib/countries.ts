// Aktiverade länder i v1. Endast dessa kan väljas vid registrering.
// Land sätter STANDARDVÄRDEN för regionala val – användaren kan ändra varje
// inställning separat under Inställningar.

export type CountryCode =
  | "SE" | "NO" | "DK" | "FI" | "GB" | "US"
  | "CA" | "AU" | "NZ" | "DE" | "NL";

export interface CountryDefaults {
  code: CountryCode;
  name_sv: string;
  name_en: string;
  flag: string;
  language: "sv" | "en"; // aktivt språk vi faktiskt har översatt
  locale: string;        // BCP-47, används för Intl.*
  timezone: string;      // fallback om webbläsaren saknar IANA-zon
  currency: string;      // ISO 4217
  measurement: "metric" | "imperial";
  temperature: "C" | "F";
}

// OBS: USA/Kanada/Australien får ALDRIG låsas till en enda tidszon i UI.
// Webbläsarens Intl-tidszon används i första hand; värdet nedan är endast fallback.
export const COUNTRIES: Record<CountryCode, CountryDefaults> = {
  SE: { code: "SE", name_sv: "Sverige",         name_en: "Sweden",         flag: "🇸🇪", language: "sv", locale: "sv-SE", timezone: "Europe/Stockholm", currency: "SEK", measurement: "metric",   temperature: "C" },
  NO: { code: "NO", name_sv: "Norge",           name_en: "Norway",         flag: "🇳🇴", language: "en", locale: "en-GB", timezone: "Europe/Oslo",      currency: "NOK", measurement: "metric",   temperature: "C" },
  DK: { code: "DK", name_sv: "Danmark",         name_en: "Denmark",        flag: "🇩🇰", language: "en", locale: "en-GB", timezone: "Europe/Copenhagen",currency: "DKK", measurement: "metric",   temperature: "C" },
  FI: { code: "FI", name_sv: "Finland",         name_en: "Finland",        flag: "🇫🇮", language: "en", locale: "en-GB", timezone: "Europe/Helsinki",  currency: "EUR", measurement: "metric",   temperature: "C" },
  GB: { code: "GB", name_sv: "Storbritannien",  name_en: "United Kingdom", flag: "🇬🇧", language: "en", locale: "en-GB", timezone: "Europe/London",    currency: "GBP", measurement: "metric",   temperature: "C" },
  US: { code: "US", name_sv: "USA",             name_en: "United States",  flag: "🇺🇸", language: "en", locale: "en-US", timezone: "America/New_York", currency: "USD", measurement: "imperial", temperature: "F" },
  CA: { code: "CA", name_sv: "Kanada",          name_en: "Canada",         flag: "🇨🇦", language: "en", locale: "en-CA", timezone: "America/Toronto",  currency: "CAD", measurement: "metric",   temperature: "C" },
  AU: { code: "AU", name_sv: "Australien",      name_en: "Australia",      flag: "🇦🇺", language: "en", locale: "en-AU", timezone: "Australia/Sydney", currency: "AUD", measurement: "metric",   temperature: "C" },
  NZ: { code: "NZ", name_sv: "Nya Zeeland",     name_en: "New Zealand",    flag: "🇳🇿", language: "en", locale: "en-NZ", timezone: "Pacific/Auckland", currency: "NZD", measurement: "metric",   temperature: "C" },
  DE: { code: "DE", name_sv: "Tyskland",        name_en: "Germany",        flag: "🇩🇪", language: "en", locale: "en-GB", timezone: "Europe/Berlin",    currency: "EUR", measurement: "metric",   temperature: "C" },
  NL: { code: "NL", name_sv: "Nederländerna",   name_en: "Netherlands",    flag: "🇳🇱", language: "en", locale: "en-GB", timezone: "Europe/Amsterdam", currency: "EUR", measurement: "metric",   temperature: "C" },
};

export const COUNTRY_LIST: CountryDefaults[] = Object.values(COUNTRIES);

export function getCountryDefaults(code: string | null | undefined): CountryDefaults {
  const c = (code ?? "SE").toUpperCase() as CountryCode;
  return COUNTRIES[c] ?? COUNTRIES.SE;
}

/** Försök gissa land från webbläsarens språk; faller tillbaka till SE. */
export function guessCountryFromBrowser(): CountryCode {
  if (typeof navigator === "undefined") return "SE";
  const langs = [navigator.language, ...(navigator.languages ?? [])];
  for (const l of langs) {
    const region = l.split("-")[1]?.toUpperCase();
    if (region && region in COUNTRIES) return region as CountryCode;
  }
  return "SE";
}

/** Webbläsarens IANA-tidszon, annars landets default. */
export function detectTimezone(fallback: string = "Europe/Stockholm"): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && tz.includes("/")) return tz;
  } catch { /* ignore */ }
  return fallback;
}
