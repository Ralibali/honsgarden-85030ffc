/**
 * Prestandabudget (Swarm V) — ren utvärderare, skriptvariant.
 *
 * Budgetprincipen är "ratchet": gränserna sitter strax över uppmätt
 * nuläge så att regressioner fångas, utan att påstå att nuläget är
 * optimalt. Skärpning är ett separat, mänskligt beslut.
 * HÅLLS I SYNK med perfBudget.ts (typad spegel som testerna kör mot).
 */

export const PERF_BUDGETS = {
  /** Entry-JS (gzip, KB). Nuläge ~170. */
  entryJsGzipKb: 200,
  /** Vendor-JS (gzip, KB). Nuläge ~114. */
  vendorJsGzipKb: 130,
  /** UI-chunk (gzip, KB). Nuläge ~71. */
  uiChunkGzipKb: 85,
  /** CSS totalt (gzip, KB). Nuläge ~50. */
  cssGzipKb: 60,
  /** Största enskilda chunk, rå (KB) — fångar att lazy-gränser brister. */
  largestChunkRawKb: 700,
  /** Initial laddning: entry + vendor + ui + css (gzip, KB). Nuläge ~405. */
  initialLoadGzipKb: 420,
};

/**
 * metrics: { entryJsGzipKb, vendorJsGzipKb, uiChunkGzipKb, cssGzipKb,
 *            largestChunkRawKb, initialLoadGzipKb }
 * Returnerar { ok, violations: [{id, budget, actual}], budgets }.
 */
export function evaluatePerfBudget(metrics) {
  const violations = [];
  for (const [id, budget] of Object.entries(PERF_BUDGETS)) {
    const actual = metrics[id];
    if (typeof actual !== 'number' || !Number.isFinite(actual)) {
      violations.push({ id, budget, actual: null, reason: 'missing_metric' });
      continue;
    }
    if (actual > budget) violations.push({ id, budget, actual, reason: 'over_budget' });
  }
  return { ok: violations.length === 0, violations, budgets: PERF_BUDGETS };
}
