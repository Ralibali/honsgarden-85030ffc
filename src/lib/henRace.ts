/**
 * Veckans värptävling – rankar hönor efter ägg senaste 7 dagarna (inkl. idag).
 * Ren logik utan UI-beroenden så att den är enkel att testa.
 */

export interface HenRaceEgg {
  hen_id: string | null;
  date: string; // yyyy-MM-dd (lokal)
  count: number;
}

export interface HenRaceHen {
  id: string;
  name: string;
}

export interface HenRaceEntry {
  henId: string;
  name: string;
  weekEggs: number;
}

export const RACE_DAYS = 7;

const toKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function rankHensByWeek(
  eggs: HenRaceEgg[],
  hens: HenRaceHen[],
  now: Date = new Date(),
): HenRaceEntry[] {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);
  start.setDate(start.getDate() - (RACE_DAYS - 1));

  const startKey = toKey(start);
  const endKey = toKey(today);

  const totals = new Map<string, number>();
  for (const e of eggs) {
    if (!e.hen_id) continue;
    // ISO-datum jämförs lexikografiskt – säkert utan tidszonsfallgropar
    if (e.date < startKey || e.date > endKey) continue;
    totals.set(e.hen_id, (totals.get(e.hen_id) ?? 0) + (e.count || 0));
  }

  return hens
    .map((h) => ({ henId: h.id, name: h.name, weekEggs: totals.get(h.id) ?? 0 }))
    .filter((entry) => entry.weekEggs > 0)
    .sort((a, b) => b.weekEggs - a.weekEggs || a.name.localeCompare(b.name, 'sv'));
}
