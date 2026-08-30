/**
 * Äggindex (Swarm P+Q).
 *
 * Datagrindar för ett framtida svenskt äggprisindex. Principen är
 * "aldrig fabricera aggregat": utan tillräckligt datunderlag finns
 * inget index, och även ett beräkningsbart index är inte automatiskt
 * publicerbart — PUBLIC_ELIGIBLE betyder "får visas", inte "ska visas".
 * Den mänskliga publiceringsbeslutet återstår alltid.
 */

export type AggIndexState =
  | 'INSUFFICIENT_DATA' // för lite data — index existerar inte
  | 'INTERNAL_BETA'     // kan beräknas för intern analys
  | 'PUBLIC_ELIGIBLE';  // uppfyller minimikrav för eventuell publicering

export const AGG_INDEX_THRESHOLDS = {
  internalBeta: { minSellers: 20, minRegions: 5, minSamples: 40 },
  publicEligible: { minSellers: 50, minRegions: 10, minSamples: 100 },
} as const;

export function getAggIndexState(distinctSellers: number, distinctRegions: number, samples: number): AggIndexState {
  const pub = AGG_INDEX_THRESHOLDS.publicEligible;
  if (distinctSellers >= pub.minSellers && distinctRegions >= pub.minRegions && samples >= pub.minSamples) {
    return 'PUBLIC_ELIGIBLE';
  }
  const beta = AGG_INDEX_THRESHOLDS.internalBeta;
  if (distinctSellers >= beta.minSellers && distinctRegions >= beta.minRegions && samples >= beta.minSamples) {
    return 'INTERNAL_BETA';
  }
  return 'INSUFFICIENT_DATA';
}

/** Får ett index beräknas alls (internt)? */
export function mayComputeIndex(distinctSellers: number, distinctRegions: number, samples: number): boolean {
  return getAggIndexState(distinctSellers, distinctRegions, samples) !== 'INSUFFICIENT_DATA';
}

/** Uppfyller datat minimikraven för eventuell publicering? (Beslutet är fortfarande mänskligt.) */
export function mayPublishIndex(distinctSellers: number, distinctRegions: number, samples: number): boolean {
  return getAggIndexState(distinctSellers, distinctRegions, samples) === 'PUBLIC_ELIGIBLE';
}

export interface AggIndexResult {
  /** Antal prisobservationer. */
  n: number;
  medianSek: number;
  p25Sek: number;
  p75Sek: number;
}

function percentile(sorted: number[], p: number): number {
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

/**
 * Beräknar median och kvartiler av observerade priser (SEK).
 * Returnerar null vid tomt underlag — ett index utan data fabriceras aldrig.
 */
export function computeAggIndex(prices: number[]): AggIndexResult | null {
  const clean = prices.filter((p) => Number.isFinite(p) && p > 0).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  return {
    n: clean.length,
    medianSek: percentile(clean, 0.5),
    p25Sek: percentile(clean, 0.25),
    p75Sek: percentile(clean, 0.75),
  };
}
