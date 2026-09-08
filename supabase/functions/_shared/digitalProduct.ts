// Delad konfiguration och hjälpare för Hönsgårdens digitala engångsköp (PDF).
// Pris, moms och filsökväg bestäms ALLTID här på servern – aldrig av klienten.

export interface DigitalProductConfig {
  slug: string;
  name: string;
  description: string;
  amountOre: number;
  availableForSale?: boolean;
  currency: string;
  vatRate: number;
  taxCode: string;
  /** Beständigt Stripe-pris (live). Krävs för korrekt intäktsrapportering. */
  stripePriceId: string;
  stripeProductId: string;
  /** Beständig, inkluderande momssats i Stripe för korrekt momsredovisning. */
  stripeTaxRateId: string;
  /** Faktureringsländer vi kan momshantera automatiskt. */
  allowedBillingCountries: string[];
  bucket: string;
  objectPath: string;
  /** Fast, formgivet smakprov i samma privata bucket (genereras inte automatiskt). */
  samplePath: string;
  samplePages: number;
  totalPages: number;
  /** Bumpas när filerna byts ut, så cachade svar inte lever vidare. */
  assetVersion: string;
  downloadFilename: string;
  termsVersion: string;
  salesPath: string;
  deliveryPath: string;
}

export const DIGITAL_PRODUCTS: Record<string, DigitalProductConfig> = {
  "fran-honsgard-till-aggbod": {
    "slug": "fran-honsgard-till-aggbod",
    "availableForSale": false,
    "name": "Från hönsgård till äggbod (PDF)",
    "description": "30 sidor ifyllbar svensk handbok om småskalig äggförsäljning. Digitalt engångsköp.",
    "amountOre": 17900,
    "currency": "sek",
    "vatRate": 0.06,
    "taxCode": "txcd_10302000",
    "stripePriceId": "price_1UDH2THzffTezY82kzzetiL2",
    "stripeProductId": "prod_VDiTNpAUB6a4IW",
    "stripeTaxRateId": "txr_1UD2ewHzffTezY82L895McGo",
    "allowedBillingCountries": [
        "SE"
    ],
    "bucket": "digital-products",
    "objectPath": "fran-honsgard-till-aggbod/honsgarden-fran-honsgard-till-aggbod.pdf",
    "samplePath": "samples/fran-honsgard-till-aggbod-smakprov.pdf",
    "samplePages": 4,
    "totalPages": 30,
    "assetVersion": "v1-0",
    "downloadFilename": "Honsgarden-fran-honsgard-till-aggbod.pdf",
    "termsVersion": "2026-09-08",
    "salesPath": "/guider/fran-honsgard-till-aggbod",
    "deliveryPath": "/guider/fran-honsgard-till-aggbod/hamta"
},
  "vinterklar-honsgard": {
    "slug": "vinterklar-honsgard",
    "name": "Vinterklar hönsgård (PDF)",
    "description": "18 sidor ifyllbar och utskrivbar PDF. Digitalt engångsköp.",
    "amountOre": 12900,
    "currency": "sek",
    "vatRate": 0.06,
    "taxCode": "txcd_10302000",
    "stripePriceId": "price_1UDBKFHzffTezY82JGFZ66nE",
    "stripeProductId": "prod_VDcZyFIa8V8jpr",
    "stripeTaxRateId": "txr_1UD2ewHzffTezY82L895McGo",
    "allowedBillingCountries": [
        "SE"
    ],
    "bucket": "digital-products",
    "objectPath": "vinterklar-honsgard/honsgarden-vinterklar-honsgard.pdf",
    "samplePath": "samples/vinterklar-honsgard-smakprov.pdf",
    "samplePages": 3,
    "totalPages": 18,
    "assetVersion": "v1-0",
    "downloadFilename": "Honsgarden-vinterklar-honsgard.pdf",
    "termsVersion": "2026-09-08",
    "salesPath": "/guider/vinterklar-honsgard",
    "deliveryPath": "/guider/vinterklar-honsgard/hamta"
},
  "aggbodens-saljpaket": {
    "slug": "aggbodens-saljpaket",
    "name": "Äggbodens säljpaket (PDF)",
    "description": "21 sidor ifyllbar och utskrivbar PDF. Digitalt engångsköp.",
    "amountOre": 14900,
    "currency": "sek",
    "vatRate": 0.25,
    "taxCode": "",
    "stripePriceId": "price_1UDBKHHzffTezY82TirIcO77",
    "stripeProductId": "prod_VDcZMTxKOc5wbc",
    "stripeTaxRateId": "",
    "allowedBillingCountries": [
        "SE"
    ],
    "bucket": "digital-products",
    "objectPath": "aggbodens-saljpaket/honsgarden-aggbodens-saljpaket.pdf",
    "samplePath": "samples/aggbodens-saljpaket-smakprov.pdf",
    "samplePages": 3,
    "totalPages": 21,
    "assetVersion": "v1-0",
    "downloadFilename": "Honsgarden-aggbodens-saljpaket.pdf",
    "termsVersion": "2026-09-08",
    "salesPath": "/guider/aggbodens-saljpaket",
    "deliveryPath": "/guider/aggbodens-saljpaket/hamta"
},
  "klackdagboken": {
    "slug": "klackdagboken",
    "name": "Kläckdagboken (PDF)",
    "description": "16 sidor ifyllbar och utskrivbar PDF. Digitalt engångsköp.",
    "amountOre": 9900,
    "currency": "sek",
    "vatRate": 0.25,
    "taxCode": "",
    "stripePriceId": "price_1UDBKIHzffTezY82ru55fqmk",
    "stripeProductId": "prod_VDcZLRHqitvrKB",
    "stripeTaxRateId": "",
    "allowedBillingCountries": [
        "SE"
    ],
    "bucket": "digital-products",
    "objectPath": "klackdagboken/honsgarden-klackdagboken.pdf",
    "samplePath": "samples/klackdagboken-smakprov.pdf",
    "samplePages": 3,
    "totalPages": 16,
    "assetVersion": "v1-0",
    "downloadFilename": "Honsgarden-klackdagboken.pdf",
    "termsVersion": "2026-09-08",
    "salesPath": "/guider/klackdagboken",
    "deliveryPath": "/guider/klackdagboken/hamta"
},

  "mina-forsta-hons": {
    slug: "mina-forsta-hons",
    name: "Mina första höns – svenskt startpaket (PDF)",
    description:
      "24-sidig utskrivbar PDF med checklistor och arbetsblad: beslut före hönsköp, inköpslistor, budget, boende och säkerhet, första 48 timmarna, 30-dagarsplan, rutiner, hönsvaktsblad, individkort och ägglogg.",
    amountOre: 19900,
    currency: "sek",
    vatRate: 0.06,
    taxCode: "txcd_10302000",
    stripePriceId: "price_1UCsnmHzffTezY82uWuIhCXK",
    stripeProductId: "prod_VDJQaWY5fbUpKg",
    stripeTaxRateId: "txr_1UD2ewHzffTezY82L895McGo",
    allowedBillingCountries: ["SE"],
    bucket: "digital-products",
    objectPath: "mina-forsta-hons/honsgarden-mina-forsta-hons.pdf",
    samplePath: "samples/mina-forsta-hons-smakprov.pdf",
    samplePages: 4,
    totalPages: 24,
    assetVersion: "v1-2",
    downloadFilename: "Honsgarden-Mina-forsta-hons.pdf",
    termsVersion: "2026-09-07",
    salesPath: "/guider/mina-forsta-hons",
    deliveryPath: "/guider/mina-forsta-hons/hamta",
  },
};

export function getDigitalProduct(slug: unknown): DigitalProductConfig | null {
  if (typeof slug !== "string") return null;
  // Egen-nyckelkontroll skyddar mot prototypnycklar som "__proto__" och "constructor".
  if (!Object.prototype.hasOwnProperty.call(DIGITAL_PRODUCTS, slug)) return null;
  return DIGITAL_PRODUCTS[slug];
}

/** Missing configuration must never start a customer charge. */
export function isDigitalProductReady(product: DigitalProductConfig): boolean {
  return product.availableForSale !== false && /^price_[A-Za-z0-9]+$/.test(product.stripePriceId)
    && /^prod_[A-Za-z0-9]+$/.test(product.stripeProductId)
    && (product.stripeTaxRateId === "" || /^txr_[A-Za-z0-9]+$/.test(product.stripeTaxRateId))
    && [0.06, 0.25].includes(product.vatRate)
    && product.allowedBillingCountries.length === 1 && product.allowedBillingCountries[0] === "SE";
}

/** Svar med kundunika uppgifter ska aldrig cachas eller läcka referrer. */
export const DIGITAL_PRIVATE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Robots-Tag": "noindex, nofollow",
};

/**
 * Hastighetsspärr som stänger vid fel (fail closed). Ett databasfel får aldrig
 * öppna en obegränsad väg mot Stripe eller mot utskick.
 * Returnerar true endast när spärren uttryckligen tillåter försöket.
 */
export async function digitalRateLimitAllows(
  admin: { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> },
  options: { scope: string; value: string; max: number; windowMinutes: number },
): Promise<boolean> {
  if (!options.value) return false;
  const { data, error } = await admin.rpc("digital_rate_limit", {
    p_scope: options.scope,
    p_key_hash: await hashKey(options.value),
    p_max: options.max,
    p_window_minutes: options.windowMinutes,
  });
  if (error) {
    console.error("[digital] rate limit unavailable, failing closed", options.scope, error.message);
    return false;
  }
  return data === true;
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

/** Samma normalisering överallt, så orderuppslag alltid är exakta. */
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length > 0 && email.length <= 254 ? email : null;
}

/** Heltalskronor utan decimaler, ojämna belopp (t.ex. moms) med exakt två. */
export function formatSek(ore: number): string {
  const kronor = ore / 100;
  const decimals = Number.isInteger(kronor) ? 0 : 2;
  return `${kronor.toLocaleString("sv-SE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })} kr`;
}

/** Moms inkluderad i priset, enligt produktens momssats. */
export function vatBreakdown(amountOre: number, vatRate: number) {
  const net = Math.round(amountOre / (1 + vatRate));
  return { netOre: net, vatOre: amountOre - net };
}

/** Hashar en nyckel (e-post, IP) innan den används i hastighetsspärr eller logg. */
export async function hashKey(value: string): Promise<string> {
  const data = new TextEncoder().encode(`honsgarden:${value.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Klientens IP från proxyheader, tom sträng när den inte finns. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim();
}

/** true när nyckeln är en skarp Stripe-nyckel. Loggar aldrig nyckeln. */
export function isLiveStripeKey(key: string): boolean {
  return key.startsWith("sk_live_") || key.startsWith("rk_live_");
}

export const SELLER = {
  name: "aurora media AB",
  orgNumber: "559272-0220",
  address: "Stjärnorp skolan 1, 585 78 Vreta Kloster",
  supportEmail: "info@auroramedia.se",
};
