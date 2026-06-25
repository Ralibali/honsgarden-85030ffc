// Regional formatering. Grunddata lagras alltid i SI-enheter i databasen
// (gram, milliliter, meter, °C, mindre valutaenhet). Konvertering sker
// ENDAST vid visning – aldrig vid lagring.

export interface RegionalPrefs {
  locale: string;
  currency: string;
  measurement: "metric" | "imperial";
  temperature: "C" | "F";
}

export function formatCurrency(amountMinor: number, prefs: Pick<RegionalPrefs, "locale" | "currency">): string {
  const major = amountMinor / 100;
  return new Intl.NumberFormat(prefs.locale, {
    style: "currency",
    currency: prefs.currency,
    maximumFractionDigits: 2,
  }).format(major);
}

export function formatTemperature(celsius: number, prefs: Pick<RegionalPrefs, "locale" | "temperature">): string {
  const value = prefs.temperature === "F" ? celsius * 9 / 5 + 32 : celsius;
  return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 1 }).format(value)
    + (prefs.temperature === "F" ? " °F" : " °C");
}

/** vikt lagras i gram. */
export function formatWeight(grams: number, prefs: Pick<RegionalPrefs, "locale" | "measurement">): string {
  if (prefs.measurement === "imperial") {
    const pounds = grams / 453.592;
    if (pounds < 1) {
      const oz = grams / 28.3495;
      return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 1 }).format(oz) + " oz";
    }
    return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 2 }).format(pounds) + " lb";
  }
  if (grams >= 1000) {
    return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 2 }).format(grams / 1000) + " kg";
  }
  return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 0 }).format(grams) + " g";
}

/** volym lagras i milliliter. */
export function formatVolume(ml: number, prefs: Pick<RegionalPrefs, "locale" | "measurement">): string {
  if (prefs.measurement === "imperial") {
    const gallons = ml / 3785.41;
    if (gallons >= 1) {
      return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 2 }).format(gallons) + " gal";
    }
    const flOz = ml / 29.5735;
    return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 1 }).format(flOz) + " fl oz";
  }
  if (ml >= 1000) {
    return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 2 }).format(ml / 1000) + " l";
  }
  return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 0 }).format(ml) + " ml";
}

/** avstånd lagras i meter. */
export function formatDistance(meters: number, prefs: Pick<RegionalPrefs, "locale" | "measurement">): string {
  if (prefs.measurement === "imperial") {
    const miles = meters / 1609.34;
    if (miles >= 0.1) {
      return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 2 }).format(miles) + " mi";
    }
    const feet = meters * 3.28084;
    return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 0 }).format(feet) + " ft";
  }
  if (meters >= 1000) {
    return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 2 }).format(meters / 1000) + " km";
  }
  return new Intl.NumberFormat(prefs.locale, { maximumFractionDigits: 0 }).format(meters) + " m";
}
