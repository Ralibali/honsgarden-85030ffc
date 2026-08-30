import { describe, expect, it } from 'vitest';
import { evaluatePerfBudget, PERF_BUDGETS } from '../perfBudget';

const CURRENT: Record<string, number> = {
  entryJsGzipKb: 170,
  vendorJsGzipKb: 114,
  uiChunkGzipKb: 71,
  cssGzipKb: 50,
  largestChunkRawKb: 554,
  initialLoadGzipKb: 405,
};

describe('perf budget evaluator', () => {
  it('passes the measured baseline', () => {
    const report = evaluatePerfBudget(CURRENT);
    expect(report.ok).toBe(true);
    expect(report.violations).toEqual([]);
  });

  it('catches an entry regression', () => {
    const report = evaluatePerfBudget({ ...CURRENT, entryJsGzipKb: PERF_BUDGETS.entryJsGzipKb + 1 });
    expect(report.ok).toBe(false);
    expect(report.violations[0]).toMatchObject({ id: 'entryJsGzipKb', reason: 'over_budget' });
  });

  it('catches initial-load regression even when individual budgets hold', () => {
    // Varje enskild budget håller precis, men summan spricker.
    const atMax = {
      entryJsGzipKb: PERF_BUDGETS.entryJsGzipKb,
      vendorJsGzipKb: PERF_BUDGETS.vendorJsGzipKb,
      uiChunkGzipKb: PERF_BUDGETS.uiChunkGzipKb,
      cssGzipKb: PERF_BUDGETS.cssGzipKb,
      largestChunkRawKb: 100,
      initialLoadGzipKb: PERF_BUDGETS.initialLoadGzipKb + 1,
    };
    const report = evaluatePerfBudget(atMax);
    expect(report.ok).toBe(false);
    expect(report.violations.map((v) => v.id)).toEqual(['initialLoadGzipKb']);
  });

  it('flags missing metrics instead of silently passing', () => {
    const report = evaluatePerfBudget({});
    expect(report.ok).toBe(false);
    expect(report.violations.every((v) => v.reason === 'missing_metric')).toBe(true);
    expect(report.violations).toHaveLength(Object.keys(PERF_BUDGETS).length);
  });

  it('budgets sit above the measured baseline (ratchet, not fantasy)', () => {
    for (const [id, current] of Object.entries(CURRENT)) {
      expect(PERF_BUDGETS[id as keyof typeof PERF_BUDGETS]).toBeGreaterThan(current);
    }
  });
});
