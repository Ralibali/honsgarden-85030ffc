// Delad konfiguration och hjälpare för Hönsgårdens digitala engångsköp (PDF).
// Pris, moms och filsökväg bestäms ALLTID här på servern – aldrig av klienten.

export interface DigitalProductConfig {
  slug: string;
  name: string;
  description: string;
  amountOre: number;
  currency: string;
  vatRate: number;
  taxCode: string;
  bucket: string;
  objectPath: string;
  downloadFilename: string;
  termsVersion: string;
  salesPath: string;
  deliveryPath: string;
}

export const DIGITAL_PRODUCTS: Record<string, DigitalProductConfig> = {
  "mina-forsta-hons": {
    slug: "mina-forsta-hons",
    name: "Mina första höns – svenskt startpaket (PDF)",
    description:
      "24-sidig ifyllbar och utskrivbar PDF: beslut före hönsköp, inköpslistor, budget, boende och säkerhet, första 48 timmarna, 30-dagarsplan, rutiner, hönsvaktsblad, individkort och ägglogg.",
    amountOre: 19900,
    currency: "sek",
    vatRate: 0.06,
    taxCode: "txcd_10302000",
    bucket: "digital-products",
    objectPath: "mina-forsta-hons/honsgarden-mina-forsta-hons.pdf",
    downloadFilename: "Honsgarden-Mina-forsta-hons.pdf",
    termsVersion: "2026-09-07",
    salesPath: "/guider/mina-forsta-hons",
    deliveryPath: "/guider/mina-forsta-hons/hamta",
  },
};

export function getDigitalProduct(slug: unknown): DigitalProductConfig | null {
  if (typeof slug !== "string") return null;
  return DIGITAL_PRODUCTS[slug] ?? null;
}

/** Stark opak token: 32 bytes → 64 hex-tecken. Endast hash lagras. */
export function createAccessToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashAccessToken(token: string): Promise<string> {
  const data = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isPlausibleToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{64}$/.test(token);
}

export function maskEmail(email: string | null | undefined): string | null {
  if (!email || !email.includes("@")) return null;
  const [local, domain] = email.split("@");
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export function formatSek(ore: number): string {
  return `${(ore / 100).toLocaleString("sv-SE", { minimumFractionDigits: 0 })} kr`;
}

/** Moms inkluderad i priset (6 % för elektronisk publikation i Sverige). */
export function vatBreakdown(amountOre: number, vatRate: number) {
  const net = Math.round(amountOre / (1 + vatRate));
  return { netOre: net, vatOre: amountOre - net };
}

export const SELLER = {
  name: "aurora media AB",
  orgNumber: "559272-0220",
  address: "Stjärnorp skolan 1, 585 78 Vreta Kloster",
  supportEmail: "info@auroramedia.se",
};
