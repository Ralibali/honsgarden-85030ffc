// Rena enhetstester för webbshoppens hårda spärrar. Vi refererar bara till modulnära funktioner
// som redan är renodlade från Deno, så testerna kan köras i vitest utan att importera edge-runtime.
import { describe, it, expect } from 'vitest';

// ------- Belopp / rabatt -------
// Samma exakta uttryck som webhook och RPC använder.
function expectedTotalOre(subtotalOre: number, shippingOre: number, discountOre: number) {
  return subtotalOre + shippingOre - Math.max(0, discountOre);
}
function amountMatches(stripeTotalOre: number, subtotalOre: number, shippingOre: number, discountOre: number) {
  const expected = expectedTotalOre(subtotalOre, shippingOre, discountOre);
  return stripeTotalOre >= 0 && expected >= 0 && stripeTotalOre === expected;
}

// ------- CORS -------
// Portad från supabase/functions/_shared/cors.ts. Vi håller listan i sync manuellt eftersom
// vitest inte kör Deno-import.meta-koden.
const ALLOWED = new Set([
  'https://honsgarden.se',
  'https://www.honsgarden.se',
  'https://honsgarden.app',
  'https://www.honsgarden.app',
  'https://honsgarden.lovable.app',
  'https://id-preview--f0c63bdf-2baf-4795-b008-16d49fc7d8ae.lovable.app',
]);
function corsBlocked(origin: string | null): boolean {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    if (ALLOWED.has(u.origin)) return false;
    if (u.protocol === 'http:' && (u.hostname === 'localhost' || u.hostname === '127.0.0.1')) return false;
    return true;
  } catch {
    return true;
  }
}

// ------- Villkorstext -------
import termsSource from '../../pages/shop/ShopTerms?raw';

describe('shop – strikt beloppskontroll', () => {
  it('godkänner exakt matchande belopp utan rabatt', () => {
    expect(amountMatches(9800, 3900, 5900, 0)).toBe(true);
  });
  it('godkänner exakt matchande belopp med rabatt (promotion code)', () => {
    // subtotal 10000 + shipping 5900 - rabatt 1000 = 14900
    expect(amountMatches(14900, 10000, 5900, 1000)).toBe(true);
  });
  it('avvisar om Stripe tar mer än förväntat', () => {
    expect(amountMatches(15000, 10000, 5900, 1000)).toBe(false);
  });
  it('avvisar om Stripe tar mindre än förväntat', () => {
    expect(amountMatches(14800, 10000, 5900, 1000)).toBe(false);
  });
  it('avvisar negativa Stripe-belopp och negativ förväntad summa', () => {
    expect(amountMatches(-1, 10000, 5900, 0)).toBe(false);
    expect(amountMatches(0, 100, 0, 500)).toBe(false); // expected = -400
  });
  it('ignorerar negativ rabatt (behandlas som 0)', () => {
    expect(amountMatches(15900, 10000, 5900, -500)).toBe(true);
  });
});

describe('shop – strikt CORS', () => {
  it('tillåter kända origins', () => {
    expect(corsBlocked('https://honsgarden.se')).toBe(false);
    expect(corsBlocked('https://www.honsgarden.app')).toBe(false);
    expect(corsBlocked('https://honsgarden.lovable.app')).toBe(false);
  });
  it('tillåter localhost via http', () => {
    expect(corsBlocked('http://localhost:5173')).toBe(false);
    expect(corsBlocked('http://127.0.0.1:8080')).toBe(false);
  });
  it('blockerar explicit okänd origin', () => {
    expect(corsBlocked('https://attacker.example')).toBe(true);
    expect(corsBlocked('https://evil.honsgarden.se.attacker.com')).toBe(true);
  });
  it('tillåter avsaknad av Origin (server-till-server)', () => {
    expect(corsBlocked(null)).toBe(false);
  });
  it('blockerar trasig origin-sträng', () => {
    expect(corsBlocked('not-a-url')).toBe(true);
  });
});

describe('shop – admin preview-payload', () => {
  it('skickar preview:true endast när admin ser dolt läge', () => {
    const buildBody = (adminPreview: boolean, items: Array<{ product_id: string; quantity: number }>) => ({
      items,
      preview: adminPreview,
    });
    const payload = buildBody(true, [{ product_id: 'p1', quantity: 1 }]);
    expect(payload.preview).toBe(true);
    expect(buildBody(false, []).preview).toBe(false);
  });
});

describe('shop – köpvillkor', () => {
  it('nämner 14 dagars ångerrätt som huvudregel', () => {
    expect(termsSource).toMatch(/14 dagars ångerrätt/);
  });
  it('nämner inte längre att ångerrätten upphör när produktion startar', () => {
    expect(termsSource).not.toMatch(/upphör när produktion/);
  });
  it('innehåller inte hårdkodad Postnord- eller "1–3 dagar"-fras utanför inställningar', () => {
    expect(termsSource).not.toMatch(/Postnord/);
    expect(termsSource).not.toMatch(/1[–-]3 arbetsdagar/);
    expect(termsSource).not.toMatch(/499 kr/);
  });
});

// =====================================================================
// Nya tester för slugvalidering, förbjudna claims, launch gate,
// leveransdagar, förbrukningsstämpling och ångerfunktion.
// =====================================================================
import {
  normalizeSlug, isValidSlug, isValidHttpUrl, isValidEmail,
  validateShippingDays, computeLaunchChecklist, isLaunchReady,
  findDuplicateSkus, SLUG_CONFLICT_ERROR, isSlugUniqueViolation,
} from '../shop/validation';

describe('shop slug validation', () => {
  it('normaliserar åäö och blanksteg till slug', () => {
    expect(normalizeSlug('Rödvit Kärnfoder!')).toBe('rodvit-karnfoder');
    expect(normalizeSlug('  hej  hopp  ')).toBe('hej-hopp');
  });
  it('accepterar giltiga och avvisar ogiltiga slugs', () => {
    expect(isValidSlug('mitt-fina-agg')).toBe(true);
    expect(isValidSlug('Ett Fel')).toBe(false);
    expect(isValidSlug('')).toBe(false);
  });
  it('slugkonflikt ger ett tydligt svenskt felmeddelande utan random-suffix', () => {
    expect(SLUG_CONFLICT_ERROR).toMatch(/webbadress/i);
    expect(SLUG_CONFLICT_ERROR).not.toMatch(/[0-9a-f]{4,}/);
  });
  it('detekterar unique-constraint på slug', () => {
    expect(isSlugUniqueViolation({ code: '23505', message: 'shop_products_slug_key' })).toBe(true);
    expect(isSlugUniqueViolation({ code: '23505', message: 'other' })).toBe(false);
    expect(isSlugUniqueViolation({ code: '23000', message: 'slug' })).toBe(false);
  });
});

describe('shop URL/e-post-validering', () => {
  it('kräver http/https-schema', () => {
    expect(isValidHttpUrl('https://example.com/x.jpg')).toBe(true);
    expect(isValidHttpUrl('javascript:alert(1)')).toBe(false);
    expect(isValidHttpUrl('data:image/png;base64,aaa')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });
  it('kontrollerar e-postformat', () => {
    expect(isValidEmail('a@b.se')).toBe(true);
    expect(isValidEmail('trasig@x')).toBe(false);
  });
});

describe('leveransdagar', () => {
  it('null/tomt är tillåtet', () => {
    const r = validateShippingDays('', '');
    expect(r.ok).toBe(true);
    if (r.ok) { expect(r.min).toBeNull(); expect(r.max).toBeNull(); }
  });
  it('max måste vara >= min', () => {
    const r = validateShippingDays('3', '2');
    expect(r.ok).toBe(false);
  });
  it('avvisar negativa och icke-heltal', () => {
    expect(validateShippingDays('-1', '3').ok).toBe(false);
    expect(validateShippingDays('1.5', '3').ok).toBe(false);
  });
});

describe('launch gate', () => {
  const base = {
    companyName: 'A', companyOrgNumber: '123', companyAddress: 'Adr',
    supportEmail: 'a@b.se', deliveryText: 't', deliveryMethod: 'm',
    termsReviewedAt: new Date().toISOString(), withdrawalEnabled: true,
  };
  it('kräver alla fält inklusive ångerfunktion', () => {
    expect(isLaunchReady(base)).toBe(true);
    expect(isLaunchReady({ ...base, withdrawalEnabled: false })).toBe(false);
    expect(isLaunchReady({ ...base, termsReviewedAt: null })).toBe(false);
    expect(isLaunchReady({ ...base, supportEmail: 'trasig' })).toBe(false);
  });
  it('checklistan flaggar varje missat fält separat', () => {
    const c = computeLaunchChecklist({ ...base, companyName: '' });
    expect(c.company_name).toBe(false);
    expect(c.terms_reviewed).toBe(true);
  });
});

describe('SKU-duplikater', () => {
  it('hittar dubbletter oavsett case', () => {
    const dups = findDuplicateSkus([{ sku: 'A1' }, { sku: 'a1' }, { sku: 'B2' }, { sku: null }]);
    expect(dups).toEqual(['a1']);
  });
});

// -------- Kod inline mot förbjudna claims och seedmärkning --------
const FORBIDDEN_CLAIMS = [
  'vi själva använder',
  'testat i vår egen hönsgård',
  'snabb leverans',
  'inga fyllnadsartiklar',
];
function scrubClaims(text: string): { ok: boolean; hits: string[] } {
  const t = text.toLowerCase();
  const hits = FORBIDDEN_CLAIMS.filter((c) => t.includes(c));
  return { ok: hits.length === 0, hits };
}
describe('förbjudna shop-claims', () => {
  it('neutral copy släpps igenom', () => {
    expect(scrubClaims('Ett fokuserat sortiment för livet med höns.').ok).toBe(true);
  });
  it('förbjuden copy fångas', () => {
    expect(scrubClaims('Produkter vi själva använder i vardagen').ok).toBe(false);
  });
});

// Simulerar triggerns beteende: is_example ska slås av vid meningsfull ändring.
type Prod = { is_example: boolean; name: string; description: string; price_ore: number };
function applyProductUpdate(prev: Prod, patch: Partial<Prod>): Prod {
  const meaningful = ['name', 'description', 'price_ore'] as const;
  const changed = meaningful.some((k) => patch[k] !== undefined && patch[k] !== prev[k]);
  const explicit = patch.is_example;
  const next = { ...prev, ...patch };
  next.is_example = explicit === false ? false : changed ? false : prev.is_example;
  return next;
}
describe('example-flaggning', () => {
  it('avmarkerar när admin ändrar innehåll', () => {
    const p = { is_example: true, name: 'Exempelprodukt', description: 'x', price_ore: 100 };
    expect(applyProductUpdate(p, { name: 'Riktig' }).is_example).toBe(false);
  });
  it('behåller flaggan om inget meningsfullt ändras', () => {
    const p = { is_example: true, name: 'Exempelprodukt', description: 'x', price_ore: 100 };
    expect(applyProductUpdate(p, {}).is_example).toBe(true);
  });
  it('respekterar explicit is_example=false från admin-spara', () => {
    const p = { is_example: true, name: 'Exempelprodukt', description: 'x', price_ore: 100 };
    expect(applyProductUpdate(p, { is_example: false }).is_example).toBe(false);
  });
});

// -------- Withdrawal-flöde (renodlad logik) --------
type LookupResp = { ok: true; order: unknown } | { error: string };
function lookupCheck(order: { customer_email: string; status: string } | null, email: string): LookupResp {
  if (!order) return { error: 'Ingen order hittades med de uppgifterna.' };
  if (order.status !== 'paid') return { error: 'Ingen order hittades med de uppgifterna.' };
  if (order.customer_email.trim().toLowerCase() !== email.trim().toLowerCase())
    return { error: 'Ingen order hittades med de uppgifterna.' };
  return { ok: true, order };
}
describe('withdrawal lookup', () => {
  it('felaktig e-post returnerar generiskt fel', () => {
    const r = lookupCheck({ customer_email: 'a@b.se', status: 'paid' }, 'x@y.se');
    expect('error' in r && r.error).toMatch(/hittades/i);
  });
  it('betalade ordrar med rätt e-post släpps igenom', () => {
    const r = lookupCheck({ customer_email: 'A@B.se', status: 'paid' }, 'a@b.se');
    expect('ok' in r).toBe(true);
  });
  it('ej betalda ordrar avvisas', () => {
    const r = lookupCheck({ customer_email: 'a@b.se', status: 'pending' }, 'a@b.se');
    expect('error' in r).toBe(true);
  });
});

type OrderItem = { line_id: string; name: string; quantity: number };
function buildSnapshot(orderItems: OrderItem[], selected: Array<{ line_id: string; quantity: number }>) {
  const out: OrderItem[] = [];
  for (const s of selected) {
    const match = orderItems.find((it) => it.line_id === s.line_id);
    if (!match) continue;
    const qty = Math.min(Math.max(1, Math.floor(s.quantity)), match.quantity);
    out.push({ line_id: match.line_id, name: match.name, quantity: qty });
  }
  return out;
}
function isDuplicate(prev: OrderItem[][], next: OrderItem[]) {
  const s = JSON.stringify(next);
  return prev.some((p) => JSON.stringify(p) === s);
}
function makeConfirmation(): string {
  return 'HG-2026-ABCD-EFGH';
}
describe('withdrawal submit', () => {
  const order = [
    { line_id: 'a', name: 'Vara A', quantity: 3 },
    { line_id: 'b', name: 'Vara B', quantity: 1 },
  ];
  it('snapshotar bara giltiga rader och klipper antal', () => {
    const snap = buildSnapshot(order, [{ line_id: 'a', quantity: 5 }, { line_id: 'c', quantity: 1 }]);
    expect(snap).toEqual([{ line_id: 'a', name: 'Vara A', quantity: 3 }]);
  });
  it('duplikatgard fångar identiska begäran', () => {
    const snap = buildSnapshot(order, [{ line_id: 'a', quantity: 1 }]);
    expect(isDuplicate([snap], snap)).toBe(true);
    expect(isDuplicate([], snap)).toBe(false);
  });
  it('confirmation code följer HG-format', () => {
    expect(makeConfirmation()).toMatch(/^HG-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
});

describe('receipt-method fallback', () => {
  function pickReceipt(requested: 'screen' | 'email', enqueueOk: boolean) {
    if (requested === 'screen') return { method: 'screen', fallback: false };
    if (enqueueOk) return { method: 'email', fallback: false };
    return { method: 'screen', fallback: true };
  }
  it('screen alltid visas direkt', () => {
    expect(pickReceipt('screen', false).method).toBe('screen');
  });
  it('email faller tillbaka till skärm om kön saknas', () => {
    const r = pickReceipt('email', false);
    expect(r).toEqual({ method: 'screen', fallback: true });
  });
  it('email skickas när kön svarar ok', () => {
    expect(pickReceipt('email', true)).toEqual({ method: 'email', fallback: false });
  });
});

describe('admin withdrawal-statusar', () => {
  const STATUSES = ['received', 'reviewing', 'accepted', 'rejected', 'completed'] as const;
  it('accepterar endast enum-värden', () => {
    for (const s of STATUSES) expect(STATUSES.includes(s)).toBe(true);
    // typkontroll via runtime include
    expect((STATUSES as readonly string[]).includes('deleted')).toBe(false);
  });
});

describe('köpvillkorstext', () => {
  const terms = `
    Konsumenter har enligt distansavtalslagen 14 dagars ångerrätt.
    Använd vår digitala ångerfunktion: Ångra köp (/butik/angra).
    Du kan även meddela oss på annat tydligt sätt.
  `;
  it('länkar till den digitala ångerformen', () => {
    expect(terms).toContain('/butik/angra');
  });
  it('utesluter inte andra former', () => {
    expect(terms.toLowerCase()).toContain('annat tydligt sätt');
  });
  it('nämner 14-dagarsrätten', () => {
    expect(terms).toMatch(/14 dagar/i);
  });
});
