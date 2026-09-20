import { AFFILIATE_PRODUCTS, type AffiliateProduct } from '@/data/affiliateProducts';
import { isLayingHen, ageInWeeks, isPullet } from '@/lib/henHelpers';
import type { FarmWeather } from '@/hooks/useFarmWeather';
import { seasonalCommerceSignals } from '@/lib/commerceStrategy';

export interface FarmContext {
  hens: any[];
  eggs: any[];
  weather: FarmWeather | null;
}

export interface ScoredProduct {
  product: AffiliateProduct;
  score: number;
  /** Mänsklig motivering, t.ex. "Föreslås för att frost förväntas kommande dagar". */
  reason: string;
}

interface Signal {
  /** Vilka kategorier får poäng. */
  categories: AffiliateProduct['category'][];
  /** Poäng som adderas. */
  weight: number;
  /** Motiveringstext (visas för användaren). */
  reason: string;
}

/**
 * Beräkna en lista signaler från gårdsdatat.
 * Varje signal lägger poäng på relevanta produktkategorier
 * och har en mänsklig motivering.
 */
function detectSignals(ctx: FarmContext): Signal[] {
  const { hens, weather } = ctx;
  const signals: Signal[] = [];

  const layingHens = hens.filter(isLayingHen);
  const pulletCount = hens.filter(isPullet).length;
  const totalHens = hens.length;
  const month = new Date().getMonth() + 1; // 1-12

  // ── 1. Inga höns alls → startpaket / hus
  if (totalHens === 0) {
    signals.push({
      categories: ['startset', 'hus'],
      weight: 100,
      reason: 'du ännu inte har registrerat några höns',
    });
    return signals; // Inget annat är meningsfullt utan höns.
  }

  // ── 2. Väder: frost förväntas → värme + frostfri vatten
  if (weather?.hasFrostSoon) {
    signals.push({
      categories: ['vaerme', 'vatten'],
      weight: 60,
      reason: 'frost förväntas i ditt område kommande dagar',
    });
  }

  // ── 3. Väder: värmebölja → vatten + skugga (vi har ingen "skugga" än)
  if (weather?.hasHeatwaveSoon) {
    signals.push({
      categories: ['vatten'],
      weight: 50,
      reason: 'varm väderprognos väntas – färskvatten blir extra viktigt',
    });
  }

  // ── 4. Säsong: researchkalendern används som boost, aldrig som hårt filter.
  for (const seasonal of seasonalCommerceSignals(month)) {
    signals.push({
      categories: seasonal.categories as AffiliateProduct['category'][],
      weight: seasonal.weight,
      reason: seasonal.label,
    });
  }

  // Produktionsfall används inte längre som köpsignal. Rapportens medicinska mur
  // innebär att avvikelser i hälsa/produktion ska hanteras som rådgivning/triage,
  // inte monetiseras automatiskt med tillskott eller andra produktförslag.

  // ── 5. Hönsålder: snittåldern över 2 år → kanske dags för unghöns/kläckägg
  const ages = layingHens
    .map((h) => ageInWeeks(h.birth_date))
    .filter((w): w is number => w != null);
  if (ages.length >= 2) {
    const avgYears = ages.reduce((s, w) => s + w, 0) / ages.length / 52;
    if (avgYears >= 2.5) {
      signals.push({
        categories: ['klackning'],
        weight: 35,
        reason: `dina värphöns är i snitt ${avgYears.toFixed(1)} år`,
      });
    }
  }

  // ── 6. Många unghöns på G → snart fler munnar att mätta
  if (pulletCount >= 3) {
    signals.push({
      categories: ['foder', 'vatten'],
      weight: 20,
      reason: `du har ${pulletCount} unghöns som snart börjar värpa`,
    });
  }

  // ── 7. Liten basröstning så vi alltid har något att visa
  signals.push({
    categories: ['vatten', 'foder', 'tillskott'],
    weight: 5,
    reason: 'det är en av de mest använda produkterna bland hönsägare',
  });

  return signals;
}

/**
 * Returnera produkter sorterade efter sammanlagd poäng.
 * Varje produkt har en motivering från den signal som bidrog mest.
 */
export function scoreProducts(ctx: FarmContext, products: AffiliateProduct[] = AFFILIATE_PRODUCTS): ScoredProduct[] {
  const signals = detectSignals(ctx);
  const catalog = products.filter((p) => p.inStock !== false);

  const byProduct = new Map<string, { product: AffiliateProduct; score: number; topReason: string; topWeight: number }>();

  for (const sig of signals) {
    const pool = catalog.filter((p) => sig.categories.includes(p.category));
    if (pool.length === 0) continue;
    // Fördela signalens vikt över matchande produkter så ingen kategori
    // får oproportionerligt stor vikt bara för att vi har många produkter där.
    const perProduct = sig.weight / Math.max(pool.length, 1);
    for (const product of pool) {
      const cur = byProduct.get(product.id);
      if (!cur) {
        byProduct.set(product.id, {
          product,
          score: perProduct,
          topReason: sig.reason,
          topWeight: sig.weight,
        });
      } else {
        cur.score += perProduct;
        if (sig.weight > cur.topWeight) {
          cur.topReason = sig.reason;
          cur.topWeight = sig.weight;
        }
      }
    }
  }

  return Array.from(byProduct.values())
    .sort((a, b) => b.score - a.score)
    .map((c) => ({
      product: c.product,
      score: c.score,
      reason: `Rekommenderas eftersom ${c.topReason}.`,
    }));
}

/** Plocka dagens tips ur topp-N (default 5). Roterar deterministiskt per dag. */
export function pickDailyFromTopN(scored: ScoredProduct[], n = 5): ScoredProduct | null {
  const top = scored.slice(0, n);
  if (top.length === 0) return null;
  const dayIdx = Math.floor(Date.now() / 86_400_000);
  return top[dayIdx % top.length];
}
