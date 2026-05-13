/**
 * Mortality calculations for a flock over a given period.
 * Pure functions, no I/O.
 */

export interface MortalityHen {
  id: string;
  death_date?: string | null; // ISO YYYY-MM-DD
  death_cause?: string | null;
}

function inPeriod(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/**
 * Andel hönor som dog inom perioden, som procent av flockstorleken
 * vid periodens start. Levande = de som inte hade death_date före start.
 */
export function mortalityRate(
  hens: MortalityHen[],
  periodStart: string,
  periodEnd: string
): number {
  if (!hens || hens.length === 0) return 0;

  // Flock som existerade vid periodens start = inte döda före start
  const alivePresent = hens.filter(
    (h) => !h.death_date || h.death_date >= periodStart
  );
  if (alivePresent.length === 0) return 0;

  const deathsInPeriod = alivePresent.filter(
    (h) => h.death_date && inPeriod(h.death_date, periodStart, periodEnd)
  ).length;

  return (deathsInPeriod / alivePresent.length) * 100;
}

/** Antal levande hönor vid ett givet datum. */
export function aliveCount(hens: MortalityHen[], asOf: string): number {
  return hens.filter((h) => !h.death_date || h.death_date > asOf).length;
}

export interface DeathsByCause {
  [cause: string]: number;
}

/** Gruppera dödsfall per orsak. Saknad orsak grupperas som "Okänd". */
export function deathsByCause(
  hens: MortalityHen[],
  periodStart: string,
  periodEnd: string
): DeathsByCause {
  const out: DeathsByCause = {};
  for (const h of hens) {
    if (!h.death_date) continue;
    if (!inPeriod(h.death_date, periodStart, periodEnd)) continue;
    const cause = (h.death_cause ?? "").trim() || "Okänd";
    out[cause] = (out[cause] ?? 0) + 1;
  }
  return out;
}
