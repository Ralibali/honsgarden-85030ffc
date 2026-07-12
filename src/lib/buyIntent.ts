/**
 * Beräknar en köpintention-score för en bloggartikel.
 * Används för att avgöra om vi ska visa "Rekommenderade produkter" och
 * jämförelsetabell — vi vill inte tränga in i medicinska eller upplevelseartiklar.
 */

export interface BuyIntentInput {
  title: string;
  slug: string;
  category?: string | null;
  tags?: string[] | null;
  excerpt?: string | null;
}

const HEALTH_CATEGORIES = new Set(['halsa', 'hälsa', 'health', 'sjukdom', 'veterinar', 'veterinär']);
const HEALTH_TERMS = /(sjuk|sjukdom|veterin|medicin|behandling|symptom|diagnos|infektion|parasit)/i;

const INTENT_TERMS: Array<[RegExp, number]> = [
  [/\bbästa\b/i, 4],
  [/\bköpguide\b/i, 6],
  [/\bköp(a|guide|s)?\b/i, 3],
  [/\btest(er)?\b/i, 3],
  [/\brecension(er)?\b/i, 3],
  [/\bjämför(else)?\b/i, 4],
  [/\bpris(er|jämförelse)?\b/i, 2],
  [/\bpremium\b/i, 2],
  [/\bbudget\b/i, 2],
  [/\butrustning\b/i, 2],
  [/\btillbehör\b/i, 2],
  [/\btop\s?\d+\b/i, 3],
  [/\bhönshus\b/i, 2],
  [/\bautomat\b/i, 2],
  [/\bfoder\b/i, 1],
  [/\bstängsel\b/i, 2],
  [/\bvärmelampa\b/i, 2],
];

export function computeBuyIntent(input: BuyIntentInput): { score: number; suppress: boolean; reason: string } {
  const category = (input.category ?? '').toLowerCase();
  const tags = (input.tags ?? []).map((t) => t.toLowerCase());
  const bag = `${input.title} ${input.slug.replace(/-/g, ' ')} ${input.excerpt ?? ''} ${tags.join(' ')}`;

  if (HEALTH_CATEGORIES.has(category) || tags.some((t) => HEALTH_CATEGORIES.has(t))) {
    return { score: 0, suppress: true, reason: 'health-category' };
  }
  if (HEALTH_TERMS.test(bag)) {
    return { score: 0, suppress: true, reason: 'health-terms' };
  }

  let score = 0;
  for (const [re, w] of INTENT_TERMS) if (re.test(bag)) score += w;

  return { score, suppress: false, reason: score >= 6 ? 'high-intent' : score >= 3 ? 'medium-intent' : 'low-intent' };
}

export function shouldShowRecommendedProducts(input: BuyIntentInput, matchedProducts: number): boolean {
  const { score, suppress } = computeBuyIntent(input);
  if (suppress) return false;
  return score >= 6 && matchedProducts >= 2;
}
