// Internationell postnummervalidering. Postnummer är ALLTID valfritt –
// returnerar { ok: true } för tom sträng. Reglerna är hjälpsamma, inte strikta.

import type { CountryCode } from "./countries";

const PATTERNS: Partial<Record<CountryCode, RegExp>> = {
  SE: /^\d{3}\s?\d{2}$/,
  NO: /^\d{4}$/,
  DK: /^\d{4}$/,
  FI: /^\d{5}$/,
  GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/i,
  US: /^\d{5}(-\d{4})?$/,
  CA: /^[A-Z]\d[A-Z]\s?\d[A-Z]\d$/i,
  AU: /^\d{4}$/,
  NZ: /^\d{4}$/,
  DE: /^\d{5}$/,
  NL: /^\d{4}\s?[A-Z]{2}$/i,
};

export interface PostalCheck {
  ok: boolean;
  /** översättningsnyckel för felmeddelandet, om någon */
  errorKey?: string;
}

export function validatePostalCode(
  value: string | null | undefined,
  country: CountryCode | string | null | undefined,
): PostalCheck {
  const v = (value ?? "").trim();
  if (!v) return { ok: true }; // valfritt
  const cc = (country ?? "SE").toUpperCase() as CountryCode;
  const pattern = PATTERNS[cc];
  if (!pattern) return { ok: true }; // inget mönster → acceptera
  return pattern.test(v) ? { ok: true } : { ok: false, errorKey: "errors.postal_code_invalid" };
}
