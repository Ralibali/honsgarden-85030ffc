/**
 * Prestandabudget (Swarm V) — typad spegel.
 *
 * HÅLLS I SYNK med perfBudget.mjs (skriptvarianten som
 * scripts/perf-budget.mjs importerar) — ändras den ena ändras den andra.
 *
 * Budgetprincipen är "ratchet": gränserna sitter strax över uppmätt
 * nuläge så att regressioner fångas, utan att påstå att nuläget är
 * optimalt. Skärpning är ett separat, mänskligt beslut.
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
} as const;

export type PerfMetricId = keyof typeof PERF_BUDGETS;

export interface PerfMetrics {
  entryJsGzipKb?: number;
  vendorJsGzipKb?: number;
  uiChunkGzipKb?: number;
  cssGzipKb?: number;
  largestChunkRawKb?: number;
  initialLoadGzipKb?: number;
}

export interface PerfViolation {
  id: string;
  budget: number;
  actual: number | null;
  reason: 'over_budget' | 'missing_metric';
}

export interface PerfBudgetReport {
  ok: boolean;
  violations: PerfViolation[];
  budgets: typeof PERF_BUDGETS;
}

export function evaluatePerfBudget(metrics: PerfMetrics): PerfBudgetReport {
  const violations: PerfViolation[] = [];
  for (const [id, budget] of Object.entries(PERF_BUDGETS)) {
    const actual = metrics[id as PerfMetricId];
    if (typeof actual !== 'number' || !Number.isFinite(actual)) {
      violations.push({ id, budget, actual: null, reason: 'missing_metric' });
      continue;
    }
    if (actual > budget) violations.push({ id, budget, actual, reason: 'over_budget' });
  }
  return { ok: violations.length === 0, violations, budgets: PERF_BUDGETS };
}
