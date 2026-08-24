/**
 * Hatch rate / fertility calculations for breeding sessions.
 * Pure functions — no side effects, safe to test in isolation.
 *
 * Returns null when the relevant input is missing so the UI can render
 * "–" instead of NaN/Infinity.
 */

export interface HatchSessionInput {
  eggs_set: number | null | undefined;
  eggs_fertile?: number | null;
  eggs_hatched?: number | null;
  chicks_survived_7d?: number | null;
}

const safe = (n: number | null | undefined): number | null =>
  n == null || Number.isNaN(n) ? null : n;

/** Andel kläckta av lagda ägg (0–100). null om okänt. */
export function hatchRate(s: HatchSessionInput): number | null {
  const set = safe(s.eggs_set);
  const hatched = safe(s.eggs_hatched);
  if (!set || set <= 0) return 0; // matchar UI-beteende: 0 vid 0 ägg
  if (hatched == null) return null;
  return (hatched / set) * 100;
}

/** Andel befruktade av lagda (0–100). null om okänt. */
export function fertilityRate(s: HatchSessionInput): number | null {
  const set = safe(s.eggs_set);
  const fertile = safe(s.eggs_fertile);
  if (!set || set <= 0) return 0;
  if (fertile == null) return null;
  return (fertile / set) * 100;
}

/** Andel kläckta av befruktade (0–100). null om saknas. */
export function hatchOfFertileRate(s: HatchSessionInput): number | null {
  const fertile = safe(s.eggs_fertile);
  const hatched = safe(s.eggs_hatched);
  if (fertile == null || fertile <= 0) return null;
  if (hatched == null) return null;
  return (hatched / fertile) * 100;
}

/** Andel av kläckta som överlever 7 dagar (0–100). null om saknas. */
export function survivalRate7d(s: HatchSessionInput): number | null {
  const hatched = safe(s.eggs_hatched);
  const survived = safe(s.chicks_survived_7d);
  if (hatched == null || hatched <= 0) return null;
  if (survived == null) return null;
  return (survived / hatched) * 100;
}

/** Avrundning till heltalsprocent — matchar Breeding.tsx (Math.round). */
export function formatRateInt(rate: number | null): string {
  if (rate == null) return "–";
  return `${Math.round(rate)}%`;
}
