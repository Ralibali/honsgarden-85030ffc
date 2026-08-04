// Brand identity per domän
// honsgarden.se   → "Hönsgården" (svenska, INGEN internationalisering – exakt som innan)
// honsgarden.app  → "Honsgarden" (internationell, full i18n)
// lovable.app preview / localhost → internationell (för att kunna testa engelska)
// alla andra      → internationell

export type BrandRegion = "se" | "intl";

export function detectBrandRegion(): BrandRegion {
  if (typeof window === "undefined") return "intl";
  const host = window.location.hostname.toLowerCase();
  if (host === "honsgarden.se" || host.endsWith(".honsgarden.se")) return "se";
  return "intl";
}

/**
 * Är vi på en domän där den internationella upplevelsen (språkval, landval,
 * regionala format etc.) ska vara aktiv?
 * honsgarden.se → false (oförändrad svensk app)
 * allt annat    → true
 */
export function isInternationalDomain(): boolean {
  return detectBrandRegion() === "intl";
}

export function brandName(region: BrandRegion = detectBrandRegion()): string {
  return region === "se" ? "Hönsgården" : "Honsgarden";
}

export function brandTagline(region: BrandRegion = detectBrandRegion()): string {
  return region === "se"
    ? "Din digitala kompanjon för hönsägare"
    : "The smart flock manager for backyard chicken keepers";
}

export function defaultLanguageForRegion(region: BrandRegion = detectBrandRegion()): "sv" | "en" {
  return region === "se" ? "sv" : "en";
}

/**
 * Standardland vid registrering per domän.
 * honsgarden.se → SE (oförändrat)
 * honsgarden.app / preview / localhost → US (initial USA-lansering;
 *   användaren kan välja ett annat land före registrering).
 */
export function defaultCountryForRegion(
  region: BrandRegion = detectBrandRegion(),
): "SE" | "US" {
  return region === "se" ? "SE" : "US";
}
