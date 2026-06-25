// Brand identity per domän
// honsgarden.se   → "Hönsgården" (svenska som standard)
// honsgarden.app  → "Honsgarden" (engelska som standard)
// alla andra      → "Honsgarden" (engelska som standard)

export type BrandRegion = "se" | "intl";

export function detectBrandRegion(): BrandRegion {
  if (typeof window === "undefined") return "se";
  const host = window.location.hostname.toLowerCase();
  if (host.endsWith("honsgarden.se")) return "se";
  // Preview / lovable.app / honsgarden.app / custom = internationell
  return host.endsWith("lovable.app") || host === "localhost" || host.endsWith(".local")
    ? "se" // behåll svensk identitet i preview/lokalt så befintliga flöden inte ändras visuellt
    : "intl";
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
