/**
 * Veckojämförelse: de 7 senaste dagarna mot de 7 dessförinnan.
 * Ren funktion – enhetstestas utan DOM.
 */

export interface WeekComparison {
  thisWeek: number;
  lastWeek: number;
  /** null om förra veckan saknade data (då är jämförelsen meningslös) */
  deltaPct: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function compareWeeks(
  eggs: { date: string; count: number }[],
  now: Date = new Date(),
): WeekComparison {
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let thisWeek = 0;
  let lastWeek = 0;

  for (const e of eggs) {
    if (!e.date) continue;
    const t = new Date(`${e.date}T00:00:00`).getTime();
    if (Number.isNaN(t)) continue;
    const ageDays = Math.round((startToday - t) / DAY_MS);
    if (ageDays >= 0 && ageDays < 7) thisWeek += e.count || 0;
    else if (ageDays >= 7 && ageDays < 14) lastWeek += e.count || 0;
  }

  const deltaPct = lastWeek > 0 ? ((thisWeek - lastWeek) / lastWeek) * 100 : null;
  return { thisWeek, lastWeek, deltaPct };
}
