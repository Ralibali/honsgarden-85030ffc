// Rena valideringshjälpare – testbara utan React/Supabase.

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Normalisera en fri text till slug-format: gemener, bindestreck, ASCII. */
export function normalizeSlug(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function isValidSlug(slug: string): boolean {
  return slug.length > 0 && slug.length <= 80 && SLUG_RE.test(slug);
}

/** Enkel URL-validering: kräver http/https-schema. */
export function isValidHttpUrl(url: string): boolean {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

/** Rimlig e-post: förenklad men effektiv – matchar samma regex som DB-gaten. */
export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email);
}

/** Validera leveransdagar. Tomt tillåtet. Om båda satta måste max >= min och båda vara icke-negativa heltal. */
export function validateShippingDays(min: string | number | null, max: string | number | null):
  { ok: true; min: number | null; max: number | null } | { ok: false; error: string } {
  const parse = (v: string | number | null): number | null | 'invalid' => {
    if (v === null || v === undefined || v === '') return null;
    const s = String(v).trim();
    if (s === '') return null;
    if (typeof v === 'string' && !/^\d+$/.test(s)) return 'invalid';
    const num = typeof v === 'number' ? v : parseInt(s, 10);
    if (!Number.isInteger(num) || num < 0) return 'invalid';
    return num;
  };
  const pMin = parse(min); const pMax = parse(max);
  if (pMin === 'invalid') return { ok: false, error: 'Min leveranstid måste vara ett icke-negativt heltal.' };
  if (pMax === 'invalid') return { ok: false, error: 'Max leveranstid måste vara ett icke-negativt heltal.' };
  if (pMin !== null && pMax !== null && (pMax as number) < (pMin as number)) {
    return { ok: false, error: 'Max leveranstid får inte vara mindre än min.' };
  }
  return { ok: true, min: pMin as number | null, max: pMax as number | null };
}

/** Räkna ihop launch-checklistan lokalt för UI. Server-gaten avgör slutligt. */
export interface LaunchGateInput {
  companyName: string;
  companyOrgNumber: string;
  companyAddress: string;
  supportEmail: string;
  deliveryText: string;
  deliveryMethod: string;
  termsReviewedAt: string | null;
  withdrawalEnabled?: boolean;
}
export function computeLaunchChecklist(s: LaunchGateInput) {
  return {
    company_name: s.companyName.trim() !== '',
    org_number: s.companyOrgNumber.trim() !== '',
    address: s.companyAddress.trim() !== '',
    support_email: isValidEmail(s.supportEmail.trim()),
    delivery_text: s.deliveryText.trim() !== '',
    delivery_method: s.deliveryMethod.trim() !== '',
    terms_reviewed: !!s.termsReviewedAt,
    withdrawal_enabled: s.withdrawalEnabled !== false,
  };
}
export function isLaunchReady(s: LaunchGateInput): boolean {
  return Object.values(computeLaunchChecklist(s)).every(Boolean);
}

/** Kontrollera unika SKU:er i en variantlista (tomma räknas inte). */
export function findDuplicateSkus(variants: Array<{ sku: string | null }>): string[] {
  const seen = new Map<string, number>();
  for (const v of variants) {
    const s = (v.sku ?? '').trim().toLowerCase();
    if (!s) continue;
    seen.set(s, (seen.get(s) ?? 0) + 1);
  }
  return [...seen.entries()].filter(([, n]) => n > 1).map(([s]) => s);
}

/** Standardiserat felmeddelande vid slugkonflikt – används både UI-side och service-side. */
export const SLUG_CONFLICT_ERROR = 'Den webbadressen används redan. Välj en annan URL-slug.';

/** Kontrollera om Postgres-fel motsvarar unique constraint på slug. */
export function isSlugUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: string; message?: string };
  const msg = String(e.message ?? '').toLowerCase();
  return e.code === '23505' && (msg.includes('slug') || msg.includes('shop_products_slug'));
}
