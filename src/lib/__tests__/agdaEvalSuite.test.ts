import { describe, it, expect } from 'vitest';
import { runAgdaEval, runResponseGuardEval, AGDA_EVAL_CASES } from '../agdaEvalSuite';
import { findQuickAnswer, AGDA_QUICK_ANSWERS, normalizeQuestion } from '../agdaQuickAnswers';

describe('Agda eval-svit (svensk fjäderfä-gyllenuppsättning)', () => {
  it('har en rimlig minsta täckning', () => {
    expect(AGDA_EVAL_CASES.length).toBeGreaterThanOrEqual(20);
  });

  it('alla cases passerar — 100 % krävs', () => {
    const summary = runAgdaEval();
    const failures = summary.results.filter((r) => !r.ok);
    expect(
      failures,
      failures.map((f) => `${f.id}: ${f.detail}`).join('\n'),
    ).toEqual([]);
    expect(summary.passed).toBe(summary.total);
  });

  it('post-svars-kontrollen passerar alla simulerade svar', () => {
    const summary = runResponseGuardEval();
    const failures = summary.results.filter((r) => !r.ok);
    expect(failures.map((f) => f.id)).toEqual([]);
    expect(summary.passed).toBe(summary.total);
  });
});

describe('agdaQuickAnswers', () => {
  it('normaliserar svenska tecken och skiljetecken', () => {
    expect(normalizeQuestion('  Hönshus! Är det LAGLIGT?? ')).toBe('honshus ar det lagligt');
  });

  it('har unika id:n och icke-tomma svar', () => {
    const ids = AGDA_QUICK_ANSWERS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of AGDA_QUICK_ANSWERS) {
      expect(a.answer.length).toBeGreaterThan(50);
      expect(a.phrases.length).toBeGreaterThan(0);
    }
  });

  it('svarar aldrig på för korta eller irrelevanta frågor', () => {
    expect(findQuickAnswer('hej')).toBeNull();
    expect(findQuickAnswer('vad är meningen med livet?')).toBeNull();
  });

  it('innehåller aldrig medicinska doseringsråd (de är Agdas förbjudna zon)', () => {
    for (const a of AGDA_QUICK_ANSWERS) {
      expect(a.answer).not.toMatch(/\d+\s*(mg|ml)\b/i);
    }
  });
});
