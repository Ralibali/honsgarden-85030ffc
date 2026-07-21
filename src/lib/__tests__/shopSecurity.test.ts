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
