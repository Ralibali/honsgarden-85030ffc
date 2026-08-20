// Brand identity per domän
// honsgarden.se   → "Hönsgården" (svenska, INGEN internationalisering – exakt som innan)
// *.vercel.app    → samma SE-varumärke (detta projekts Vercel-preview/alias)
// honsgarden.app  → "Honsgarden" (internationell, full i18n)
// lovable.app preview / localhost → internationell (för att kunna testa engelska)
// alla andra      → internationell

export type BrandRegion = "se" | "intl";

export function detectBrandRegion(hostname?: string): BrandRegion {
  const host = (hostname ?? (typeof window === "undefined" ? "" : window.location.hostname)).toLowerCase();
  if (host === "honsgarden.se" || host.endsWith(".honsgarden.se")) return "se";
  // Stable rule for this SE project's Vercel aliases and PR previews.
  if (host === "vercel.app" || host.endsWith(".vercel.app")) return "se";
  return "intl";
}

/**
 * Är vi på en domän där den internationella upplevelsen (språkval, landval,
 * regionala format etc.) ska vara aktiv?
 * honsgarden.se / Vercel preview → false (oförändrad svensk app)
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
 * honsgarden.se / Vercel preview → SE (oförändrat)
 * honsgarden.app / lovable preview / localhost → US (initial USA-lansering;
 *   användaren kan välja ett annat land före registrering).
 */
export function defaultCountryForRegion(
  region: BrandRegion = detectBrandRegion(),
): "SE" | "US" {
  return region === "se" ? "SE" : "US";
}
