/**
 * Foderprognos: hur länge räcker fodret, och vad kostar äggen i foder?
 *
 * Allt räknas på användarens egna inköp, utan schablonvärden per höna.
 * Förbrukningstakten härleds ur inköpsrytmen: fodret i alla inköp utom det
 * senaste har gått åt mellan första och senaste inköpsdagen. Det gör att
 * uppskattningen följer just den här flockens aptit, och den blir säkrare
 * för varje inköp som loggas.
 */
import { addDaysIso, daysBetweenIso, isIsoDay } from '@/lib/isoDay';

export interface FeedPurchase {
  date: string;
  amount_kg?: number | null;
  cost?: number | null;
  feed_category?: string | null;
  feed_type?: string | null;
  brand?: string | null;
}

export interface FeedEggRow {
  date: string;
  count?: number | null;
}

/** Tillskott som kostar pengar men inte är huvudfoder (räknas inte i förbrukningstakten). */
export const SUPPLEMENT_FEED_CATEGORIES: ReadonlySet<string> = new Set(['treats', 'grit', 'oyster_shell']);

/**
 * Fodertypen är valfri, så tillskott känns också igen på namnet
 * ("Skalgrus", "Ostronskal", "Mjölmask" …).
 */
const SUPPLEMENT_NAME = /(skal|grit|grus|ostron|mussl|kalcium|mjölmask|larv|godis|snack|vitamin|mineral)/i;

/** Okategoriserade inköp under den här andelen av ett typiskt inköp räknas som tillskott. */
const SMALL_TOP_UP_SHARE = 0.3;

export function isSupplementPurchase(p: FeedPurchase): boolean {
  const category = (p.feed_category || '').trim();
  if (category) return SUPPLEMENT_FEED_CATEGORIES.has(category);
  return SUPPLEMENT_NAME.test(`${p.feed_type ?? ''} ${p.brand ?? ''}`);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Kortaste spann mellan första och senaste inköp innan en takt räknas ut. */
export const MIN_SPAN_DAYS = 7;
/** Minsta antal ägg som kostnad per ägg får bygga på. */
export const MIN_EGGS_FOR_COST = 20;

export type FeedForecastConfidence = 'none' | 'low' | 'ok';

export interface FeedForecast {
  confidence: FeedForecastConfidence;
  /** Förbrukning av huvudfoder per dygn (kg). */
  kgPerDay: number | null;
  /** Uppskattat kvar idag (kg). */
  kgLeft: number | null;
  /** Hela dagar kvar med nuvarande takt. */
  daysLeft: number | null;
  /** Ungefärligt datum då fodret tar slut. */
  runOutDate: string | null;
  lastPurchaseDate: string | null;
  /**
   * Sant när det gått långt längre än vanligt sedan senaste inköpet. Då har
   * användaren troligen slutat logga inköp, och "slut"-varningar skulle vara fel.
   */
  stale: boolean;
  /** Foderkostnad per ägg (kr) – null tills underlaget räcker. */
  costPerEgg: number | null;
  /** Vilken period kostnaden per ägg bygger på. */
  costBasis: 'between_purchases' | 'since_first_purchase' | null;
  costPeriodEggs: number;
  costPeriodSek: number;
}

const EMPTY: FeedForecast = {
  confidence: 'none',
  kgPerDay: null,
  kgLeft: null,
  daysLeft: null,
  runOutDate: null,
  lastPurchaseDate: null,
  stale: false,
  costPerEgg: null,
  costBasis: null,
  costPeriodEggs: 0,
  costPeriodSek: 0,
};

function positive(value: number | null | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function eggsBetween(eggs: FeedEggRow[], fromIso: string, toIsoExclusive: string | null, todayIso: string): number {
  let total = 0;
  for (const row of eggs) {
    if (!isIsoDay(row.date)) continue;
    if (row.date < fromIso || row.date > todayIso) continue;
    if (toIsoExclusive && row.date >= toIsoExclusive) continue;
    total += positive(row.count);
  }
  return total;
}

export function computeFeedForecast(
  purchases: FeedPurchase[],
  eggs: FeedEggRow[],
  todayIso: string,
): FeedForecast {
  if (!isIsoDay(todayIso)) return { ...EMPTY };

  const valid = purchases.filter((p) => isIsoDay(p.date) && p.date <= todayIso);
  if (valid.length === 0) return { ...EMPTY };

  // ---- Förbrukningstakt (endast huvudfoder med vikt) ----
  const candidates = valid.filter((p) => positive(p.amount_kg) > 0 && !isSupplementPurchase(p));
  const typicalKg = candidates.length >= 2 ? median(candidates.map((p) => positive(p.amount_kg))) : 0;
  const kgByDate = new Map<string, number>();
  for (const p of candidates) {
    const kg = positive(p.amount_kg);
    // En liten okategoriserad påfyllnad är oftast ett tillskott, inte en ny säck.
    if (!(p.feed_category || '').trim() && typicalKg > 0 && kg < typicalKg * SMALL_TOP_UP_SHARE) continue;
    kgByDate.set(p.date, (kgByDate.get(p.date) || 0) + kg);
  }
  const dates = [...kgByDate.keys()].sort();
  const result: FeedForecast = { ...EMPTY, lastPurchaseDate: dates.length ? dates[dates.length - 1] : null };

  if (dates.length >= 2) {
    const first = dates[0];
    const last = dates[dates.length - 1];
    const span = daysBetweenIso(first, last) ?? 0;
    if (span >= MIN_SPAN_DAYS) {
      const consumed = dates.slice(0, -1).reduce((sum, d) => sum + (kgByDate.get(d) || 0), 0);
      const totalKg = consumed + (kgByDate.get(last) || 0);
      const kgPerDay = consumed / span;
      if (kgPerDay > 0) {
        const sinceFirst = daysBetweenIso(first, todayIso) ?? 0;
        const kgLeft = Math.max(0, totalKg - kgPerDay * sinceFirst);
        const daysLeft = Math.floor(kgLeft / kgPerDay);
        const averageInterval = span / (dates.length - 1);
        const sinceLast = daysBetweenIso(last, todayIso) ?? 0;
        result.kgPerDay = Math.round(kgPerDay * 1000) / 1000;
        result.kgLeft = Math.round(kgLeft * 10) / 10;
        result.daysLeft = daysLeft;
        result.runOutDate = addDaysIso(todayIso, daysLeft);
        result.stale = kgLeft === 0 && sinceLast > Math.max(averageInterval * 2, averageInterval + 21);
        result.confidence = dates.length >= 3 ? 'ok' : 'low';
      }
    }
  }

  // ---- Kostnad per ägg ----
  const costDates = valid.filter((p) => positive(p.cost) > 0).map((p) => p.date).sort();
  if (costDates.length > 0) {
    const firstCost = costDates[0];
    const lastCost = costDates[costDates.length - 1];
    const span = daysBetweenIso(firstCost, lastCost) ?? 0;
    if (costDates.length >= 2 && span >= 14) {
      // Det som köptes före senaste inköpsdagen har ätits upp under perioden.
      const sek = valid
        .filter((p) => p.date < lastCost)
        .reduce((sum, p) => sum + positive(p.cost), 0);
      const eggsInPeriod = eggsBetween(eggs, firstCost, lastCost, todayIso);
      if (eggsInPeriod >= MIN_EGGS_FOR_COST && sek > 0) {
        result.costPerEgg = Math.round((sek / eggsInPeriod) * 100) / 100;
        result.costBasis = 'between_purchases';
        result.costPeriodEggs = eggsInPeriod;
        result.costPeriodSek = Math.round(sek * 100) / 100;
        return result;
      }
    }
    const sek = valid.reduce((sum, p) => sum + positive(p.cost), 0);
    const eggsSince = eggsBetween(eggs, firstCost, null, todayIso);
    if (eggsSince >= MIN_EGGS_FOR_COST && sek > 0) {
      result.costPerEgg = Math.round((sek / eggsSince) * 100) / 100;
      result.costBasis = 'since_first_purchase';
      result.costPeriodEggs = eggsSince;
      result.costPeriodSek = Math.round(sek * 100) / 100;
    }
  }

  return result;
}
