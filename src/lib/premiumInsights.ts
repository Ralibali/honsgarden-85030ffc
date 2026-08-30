/**
 * Premium-insikter (Swarm K).
 *
 * Deterministiska "insikts-moments" beräknade enbart på användarens
 * egna data — inga aggregeringar över användare, inga fabricerade
 * jämförelser. Saknas underlag returneras tom lista. Aktiveras via
 * befintlig entitlement (hasCapability 'advanced_analytics'); inga nya
 * betalväggar introduceras.
 */

export interface PremiumInsight {
  id: 'best_layer_week' | 'flock_trend' | 'best_week_ever' | 'cost_per_egg';
  title: string;
  body: string;
}

export interface InsightEgg {
  date?: string | null;
  hen_id?: string | null;
  count?: number | null;
}

export interface InsightHen {
  id: string;
  name?: string | null;
}

export interface InsightFeedRecord {
  date?: string | null;
  cost_sek?: number | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Antal ägg senaste 30 dagarna som krävs för kostnad-per-ägg-insikt. */
const COST_PER_EGG_MIN_EGGS_30D = 30;
/** Historik (dagar) som krävs innan "bästa veckan någonsin" får sägas. */
const BEST_WEEK_MIN_HISTORY_DAYS = 28;

/** DST-säker dagar-sedan via UTC-mittpådagen-konventionen. */
function daysBetween(fromIso: string, toIso: string): number | null {
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  if (!fy || !fm || !fd || !ty || !tm || !td) return null;
  return Math.round((Date.UTC(ty, tm - 1, td, 12) - Date.UTC(fy, fm - 1, fd, 12)) / DAY_MS);
}

function sumInWindow(eggs: InsightEgg[], todayIso: string, fromDaysAgo: number, toDaysAgo: number): number {
  let total = 0;
  for (const e of eggs) {
    if (!e.date || !(e.count ?? 0)) continue;
    const d = daysBetween(e.date, todayIso);
    if (d === null) continue;
    if (d >= fromDaysAgo && d <= toDaysAgo) total += e.count ?? 0;
  }
  return total;
}

function perHenInWindow(eggs: InsightEgg[], todayIso: string, days: number): Map<string, number> {
  const perHen = new Map<string, number>();
  for (const e of eggs) {
    if (!e.date || !e.hen_id || !(e.count ?? 0)) continue;
    const d = daysBetween(e.date, todayIso);
    if (d === null || d < 0 || d >= days) continue;
    perHen.set(e.hen_id, (perHen.get(e.hen_id) ?? 0) + (e.count ?? 0));
  }
  return perHen;
}

/**
 * Bygger insikts-moments. Returnerar alltid en (möjligen tom) lista —
 * aldrig platshållare utan dataunderlag.
 */
export function buildPremiumInsights(
  eggs: InsightEgg[],
  hens: InsightHen[],
  feedRecords: InsightFeedRecord[],
  todayIso: string,
): PremiumInsight[] {
  const insights: PremiumInsight[] = [];
  if (eggs.length === 0) return insights;

  // --- Veckans bästa värpare (kräver ≥2 hönor med ägg denna vecka) ---
  const weekPerHen = perHenInWindow(eggs, todayIso, 7);
  if (weekPerHen.size >= 2) {
    let topHenId: string | null = null;
    let topCount = 0;
    for (const [henId, count] of weekPerHen) {
      if (count > topCount) {
        topCount = count;
        topHenId = henId;
      }
    }
    const henName = hens.find((h) => h.id === topHenId)?.name;
    if (topHenId && topCount > 0) {
      insights.push({
        id: 'best_layer_week',
        title: 'Veckans värpdrottning',
        body: `${henName ?? 'En av dina hönor'} toppar veckan med ${topCount} ägg de senaste 7 dagarna.`,
      });
    }
  }

  // --- Flocktrend vecka mot vecka ---
  const thisWeek = sumInWindow(eggs, todayIso, 0, 6);
  const lastWeek = sumInWindow(eggs, todayIso, 7, 13);
  if (lastWeek > 0 && thisWeek !== lastWeek) {
    const delta = thisWeek - lastWeek;
    insights.push({
      id: 'flock_trend',
      title: delta > 0 ? 'Flocken ökar' : 'Flocken minskar',
      body:
        delta > 0
          ? `${thisWeek} ägg denna vecka – ${delta} fler ägg än förra veckan.`
          : `${thisWeek} ägg denna vecka – ${Math.abs(delta)} färre ägg än förra veckan.`,
    });
  }

  // --- Bästa veckan någonsin (rullande 7-dagars, kräver ≥28 dagars historik) ---
  const dated = eggs
    .filter((e) => e.date && (e.count ?? 0) > 0)
    .map((e) => ({ date: e.date as string, count: e.count as number }));
  if (dated.length > 0) {
    const oldest = dated.reduce((min, e) => (e.date < min ? e.date : min), dated[0].date);
    const historyDays = daysBetween(oldest, todayIso);
    if (historyDays !== null && historyDays >= BEST_WEEK_MIN_HISTORY_DAYS) {
      const byDate = new Map<string, number>();
      for (const e of dated) byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.count);
      const trailing7 = (endIso: string): number => {
        let total = 0;
        for (const [date, count] of byDate) {
          const d = daysBetween(date, endIso);
          if (d !== null && d >= 0 && d <= 6) total += count;
        }
        return total;
      };
      const current = trailing7(todayIso);
      // Bästa tidigare rullande 7-dagars: pröva varje historiskt datum som slutdag.
      let bestPrior = 0;
      for (const e of dated) {
        const endDaysAgo = daysBetween(e.date, todayIso);
        if (endDaysAgo === null || endDaysAgo < 7) continue; // slutdag måste ligga före innevarande vecka
        bestPrior = Math.max(bestPrior, trailing7(e.date));
      }
      if (current > 0 && current > bestPrior) {
        insights.push({
          id: 'best_week_ever',
          title: 'Rekordvecka!',
          body: `${current} ägg på 7 dagar – din bästa vecka sedan du började logga.`,
        });
      }
    }
  }

  // --- Kostnad per ägg (kräver foderkostnad + ≥30 ägg senaste 30 dagarna) ---
  const eggs30 = sumInWindow(eggs, todayIso, 0, 29);
  if (eggs30 >= COST_PER_EGG_MIN_EGGS_30D) {
    let feedCost30 = 0;
    for (const f of feedRecords) {
      if (!f.date || !(f.cost_sek ?? 0)) continue;
      const d = daysBetween(f.date, todayIso);
      if (d === null || d < 0 || d > 29) continue;
      feedCost30 += f.cost_sek ?? 0;
    }
    if (feedCost30 > 0) {
      const perEgg = (feedCost30 / eggs30).toFixed(2).replace('.', ',');
      insights.push({
        id: 'cost_per_egg',
        title: 'Din äggkostnad',
        body: `Fodret kostar just nu ${perEgg} kr/ägg (${feedCost30} kr foder, ${eggs30} ägg på 30 dagar).`,
      });
    }
  }

  return insights;
}
