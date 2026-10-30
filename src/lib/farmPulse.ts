/**
 * Gårdens läge – Idag-vyns prioriterade lista över det som behöver
 * uppmärksamhet just nu: försenade påminnelser, foder som snart tar slut,
 * kläckningsdagar och ovanliga förändringar i värpningen.
 *
 * Motorn är ren och deterministisk (inga nätverksanrop, `todayIso` skickas
 * in) så att varje regel kan testas. Den bygger bara på användarens egna
 * data, säger aldrig något den inte har underlag för, och ställer inga
 * diagnoser – den pekar vidare.
 */
import { addDaysIso, daysBetweenIso, daysInMonthIso, isIsoDay } from '@/lib/isoDay';
import type { FeedForecast } from '@/lib/feedForecast';
import { isOpenReminder } from '@/lib/reminderRules';
import type { SeasonalMode } from '@/lib/seasonalMode';
import { CHICKEN_INCUBATION_DAYS, computeHatchPlan, formatSvDate } from '@/lib/tools/hatchCalculator';

export type PulseTone = 'urgent' | 'heads-up' | 'calm' | 'celebrate';
export type PulseKind = 'reminder' | 'reminders' | 'feed' | 'hatching' | 'production' | 'season';

export interface PulseItem {
  id: string;
  kind: PulseKind;
  tone: PulseTone;
  title: string;
  detail: string;
  href?: string;
  ctaLabel?: string;
  /** Sätts för enskilda påminnelser som kan bockas av direkt från Idag. */
  reminderId?: string;
  priority: number;
}

export interface PulseReminder {
  id: string;
  title: string;
  due_date: string;
  status: string;
}

export interface PulseHatching {
  id: string;
  start_date: string;
  expected_hatch_date?: string | null;
  status: string;
  egg_count?: number | null;
}

export interface PulseEgg {
  date: string;
  count?: number | null;
}

export interface FarmPulseInput {
  todayIso: string;
  season: SeasonalMode;
  reminders?: PulseReminder[];
  feed?: FeedForecast | null;
  hatchings?: PulseHatching[];
  eggs?: PulseEgg[];
}

export const MAX_PULSE_ITEMS = 4;
/** Hur många påminnelser som visas en och en innan resten slås ihop. */
const MAX_SINGLE_REMINDERS = 2;

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

/** "tors 12 nov" – utan avslutande punkt så att datumet kan stå mitt i en mening. */
export function shortSvDate(iso: string): string {
  return formatSvDate(iso).replace(/\.$/, '');
}

// ----------------------------- påminnelser -----------------------------

function reminderItems(reminders: PulseReminder[], todayIso: string): PulseItem[] {
  const open = reminders
    .filter((r) => isOpenReminder(r.status) && isIsoDay(r.due_date))
    .map((r) => ({ r, days: daysBetweenIso(todayIso, r.due_date) ?? 0 }))
    .filter(({ days }) => days <= 1)
    .sort((a, b) => a.days - b.days || a.r.title.localeCompare(b.r.title, 'sv'));

  const items: PulseItem[] = open.slice(0, MAX_SINGLE_REMINDERS).map(({ r, days }) => {
    if (days < 0) {
      const late = Math.abs(days);
      return {
        id: `reminder-${r.id}`, kind: 'reminder', tone: 'urgent', reminderId: r.id,
        title: r.title,
        detail: `Försenad ${late} ${plural(late, 'dag', 'dagar')}`,
        priority: 90 + Math.min(late, 9),
      };
    }
    if (days === 0) {
      return { id: `reminder-${r.id}`, kind: 'reminder', tone: 'heads-up', reminderId: r.id, title: r.title, detail: 'Idag', priority: 80 };
    }
    return { id: `reminder-${r.id}`, kind: 'reminder', tone: 'calm', reminderId: r.id, title: r.title, detail: 'Imorgon', priority: 35 };
  });

  const rest = open.slice(MAX_SINGLE_REMINDERS);
  if (rest.length > 0) {
    const overdue = rest.filter(({ days }) => days < 0).length;
    items.push({
      id: 'reminders-more', kind: 'reminders', tone: overdue > 0 ? 'urgent' : 'heads-up',
      title: `${rest.length} ${plural(rest.length, 'påminnelse', 'påminnelser')} till`,
      detail: overdue > 0 ? `${overdue} av dem är ${plural(overdue, 'försenad', 'försenade')}` : 'Idag eller imorgon',
      href: '/app/reminders', ctaLabel: 'Visa alla', priority: overdue > 0 ? 78 : 50,
    });
  }
  return items;
}

// -------------------------------- foder --------------------------------

function feedItem(feed: FeedForecast | null | undefined): PulseItem | null {
  if (!feed || feed.confidence === 'none' || feed.stale || feed.daysLeft === null) return null;
  if (feed.daysLeft > 7) return null;
  const when = feed.runOutDate ? ` – köp nytt senast omkring ${shortSvDate(feed.runOutDate)}` : '';
  if (feed.daysLeft <= 0) {
    return {
      id: 'feed', kind: 'feed', tone: 'urgent',
      title: 'Fodret kan vara slut nu',
      detail: 'Uppskattat från dina inköp. Har du köpt nytt? Lägg in det så räknar prognosen om.',
      href: '/app/feed', ctaLabel: 'Lägg in inköp', priority: 86,
    };
  }
  return {
    id: 'feed', kind: 'feed', tone: feed.daysLeft <= 3 ? 'urgent' : 'heads-up',
    title: `Fodret räcker ca ${feed.daysLeft} ${plural(feed.daysLeft, 'dag', 'dagar')} till`,
    detail: `Uppskattat från din inköpsrytm${when}.`,
    href: '/app/feed', ctaLabel: 'Foder', priority: feed.daysLeft <= 3 ? 84 : 60,
  };
}

// ------------------------------ kläckning ------------------------------

function hatchingItems(hatchings: PulseHatching[], todayIso: string): PulseItem[] {
  const items: PulseItem[] = [];
  for (const h of hatchings) {
    if (h.status !== 'incubating' || !isIsoDay(h.start_date)) continue;
    let incubationDays = CHICKEN_INCUBATION_DAYS;
    if (h.expected_hatch_date && isIsoDay(h.expected_hatch_date)) {
      const span = daysBetweenIso(h.start_date, h.expected_hatch_date);
      if (span !== null && span >= 10 && span <= 40) incubationDays = span;
    }
    const plan = computeHatchPlan(h.start_date, incubationDays);
    const day = daysBetweenIso(h.start_date, todayIso);
    if (!plan || day === null || day < 0) continue;
    const href = '/app/avel?tab=hatching';
    const eggs = h.egg_count ? `${h.egg_count} ägg · ` : '';
    const untilHatch = incubationDays - day;

    if (untilHatch < 0 && untilHatch >= -7) {
      items.push({
        id: `hatch-${h.id}`, kind: 'hatching', tone: 'urgent',
        title: 'Hur gick kläckningen?',
        detail: `${eggs}beräknad kläckdag var ${shortSvDate(plan.hatchDate)}. Registrera resultatet så räknas kläckningsgraden.`,
        href, ctaLabel: 'Registrera', priority: 82,
      });
    } else if (untilHatch === 0) {
      items.push({
        id: `hatch-${h.id}`, kind: 'hatching', tone: 'celebrate',
        title: 'Beräknad kläckdag idag 🐣',
        detail: `${eggs}öppna inte maskinen i onödan. Registrera resultatet när kycklingarna är torra.`,
        href, ctaLabel: 'Kläckning', priority: 88,
      });
    } else if (untilHatch > 0 && untilHatch <= 3) {
      items.push({
        id: `hatch-${h.id}`, kind: 'hatching', tone: 'heads-up',
        title: `Kläckning om ${untilHatch} ${plural(untilHatch, 'dag', 'dagar')}`,
        detail: `${eggs}dag ${day} av ${incubationDays}. Kontrollera din anvisning för slutet av ruvningen.`,
        href, ctaLabel: 'Kläckning', priority: 70,
      });
    } else if (untilHatch > 3) {
      const next = plan.milestones.find((m) => m.day >= day && m.day > 0);
      const nextText = next ? (next.day === day ? ` Idag: ${next.label.toLowerCase()}.` : ` Nästa: ${next.label.toLowerCase()} ${shortSvDate(next.date)}.`) : '';
      items.push({
        id: `hatch-${h.id}`, kind: 'hatching', tone: next?.day === day ? 'heads-up' : 'calm',
        title: `Ruvning dag ${day} av ${incubationDays}`,
        detail: `${eggs}kläckning omkring ${shortSvDate(plan.hatchDate)}.${nextText}`,
        href, ctaLabel: 'Kläckning', priority: next?.day === day ? 65 : 30,
      });
    }
  }
  return items;
}

// ------------------------------ värpning -------------------------------

interface WindowStats { loggedDays: number; eggs: number }

function windowStats(byDay: Map<string, number>, todayIso: string, fromDaysAgo: number, toDaysAgo: number): WindowStats {
  let loggedDays = 0;
  let eggs = 0;
  for (let ago = fromDaysAgo; ago <= toDaysAgo; ago += 1) {
    const day = addDaysIso(todayIso, -ago);
    if (day && byDay.has(day)) {
      loggedDays += 1;
      eggs += byDay.get(day) || 0;
    }
  }
  return { loggedDays, eggs };
}

export function eggsByDay(eggs: PulseEgg[], todayIso: string): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const row of eggs) {
    if (!isIsoDay(row.date) || row.date > todayIso) continue;
    const count = Number(row.count ?? 0);
    if (!Number.isFinite(count) || count < 0) continue;
    byDay.set(row.date, (byDay.get(row.date) || 0) + count);
  }
  return byDay;
}

/**
 * Jämför ägg per loggad dag senaste veckan (exklusive idag, som ofta är
 * halvloggad) med de tre veckorna innan. Dagar utan logg räknas aldrig som noll.
 */
export function productionChange(eggs: PulseEgg[], todayIso: string): { changePct: number; recentPerDay: number; baselinePerDay: number } | null {
  const byDay = eggsByDay(eggs, todayIso);
  const recent = windowStats(byDay, todayIso, 1, 7);
  const baseline = windowStats(byDay, todayIso, 8, 28);
  if (recent.loggedDays < 4 || baseline.loggedDays < 12) return null;
  const recentPerDay = recent.eggs / recent.loggedDays;
  const baselinePerDay = baseline.eggs / baseline.loggedDays;
  if (baselinePerDay < 1) return null;
  return {
    changePct: Math.round(((recentPerDay - baselinePerDay) / baselinePerDay) * 100),
    recentPerDay: Math.round(recentPerDay * 10) / 10,
    baselinePerDay: Math.round(baselinePerDay * 10) / 10,
  };
}

function productionItem(eggs: PulseEgg[], todayIso: string, season: SeasonalMode): PulseItem | null {
  const change = productionChange(eggs, todayIso);
  if (!change) return null;
  if (change.changePct <= -35) {
    const pct = Math.abs(change.changePct);
    if (season === 'winter') {
      return {
        id: 'production', kind: 'production', tone: 'calm',
        title: 'Lugnare i redena – helt normalt nu',
        detail: `Ca ${pct} % färre ägg per dag senaste veckan. Korta dagar gör att många hönor värper mindre eller pausar på vintern.`,
        priority: 20,
      };
    }
    if (season === 'autumn') {
      return {
        id: 'production', kind: 'production', tone: 'calm',
        title: 'Värpningen avtar',
        detail: `Ca ${pct} % färre ägg per dag senaste veckan. Ruggning och kortare dagar är vanliga orsaker på hösten.`,
        priority: 20,
      };
    }
    return {
      id: 'production', kind: 'production', tone: 'heads-up',
      title: `Värpningen har gått ner ca ${pct} %`,
      detail: 'Senaste veckan jämfört med veckorna innan. Värme, ruggning, kvalster eller stress är vanliga orsaker – kika gärna till flocken.',
      href: '/app/halsa', ctaLabel: 'Hälsa', priority: 55,
    };
  }
  if (change.changePct >= 25) {
    return {
      id: 'production', kind: 'production', tone: 'celebrate',
      title: 'Flocken värper mer än vanligt',
      detail: `+${change.changePct} % ägg per dag senaste veckan jämfört med veckorna innan.`,
      href: '/app/statistics', ctaLabel: 'Insikter', priority: 15,
    };
  }
  return null;
}

// -------------------------------- säsong -------------------------------

function seasonItem(season: SeasonalMode): PulseItem | null {
  if (season !== 'winter') return null;
  return {
    id: 'season-winter', kind: 'season', tone: 'calm',
    title: 'Vinterläge på gården',
    detail: 'Färre ägg är normalt nu. Håll vattnet isfritt och hönshuset dragfritt men ventilerat.',
    href: '/honskalender', ctaLabel: 'Vinterrutiner', priority: 10,
  };
}

// ------------------------------- samlat --------------------------------

export function buildFarmPulse(input: FarmPulseInput): PulseItem[] {
  if (!isIsoDay(input.todayIso)) return [];
  const items: PulseItem[] = [
    ...reminderItems(input.reminders ?? [], input.todayIso),
    ...hatchingItems(input.hatchings ?? [], input.todayIso),
  ];
  const feed = feedItem(input.feed);
  if (feed) items.push(feed);
  const production = productionItem(input.eggs ?? [], input.todayIso, input.season);
  if (production) items.push(production);
  else {
    const season = seasonItem(input.season);
    if (season) items.push(season);
  }
  return items.sort((a, b) => b.priority - a.priority).slice(0, MAX_PULSE_ITEMS);
}

// ----------------------------- månadens takt ---------------------------

export interface MonthPace {
  monthLabel: string;
  soFar: number;
  loggedDays: number;
  elapsedDays: number;
  /** Prognos för hela månaden, eller null när underlaget är för tunt. */
  projected: number | null;
}

/**
 * Ägg hittills i månaden och en försiktig prognos. Prognosen visas bara när
 * minst fem dagar är loggade och minst 60 % av de passerade dagarna har en
 * logg – annars skulle den som loggar i klump få en uppblåst siffra.
 */
export function computeMonthPace(eggs: PulseEgg[], todayIso: string): MonthPace | null {
  if (!isIsoDay(todayIso)) return null;
  const monthPrefix = todayIso.slice(0, 7);
  const dayOfMonth = Number(todayIso.slice(8, 10));
  const daysInMonth = daysInMonthIso(todayIso) ?? 30;
  const byDay = eggsByDay(eggs, todayIso);
  let soFar = 0;
  let loggedDays = 0;
  for (const [day, count] of byDay) {
    if (!day.startsWith(monthPrefix)) continue;
    soFar += count;
    loggedDays += 1;
  }
  const elapsedDays = dayOfMonth - 1 + (byDay.has(todayIso) ? 1 : 0);
  const coverage = elapsedDays > 0 ? loggedDays / elapsedDays : 0;
  const projected = loggedDays >= 5 && coverage >= 0.6 ? Math.round((soFar / loggedDays) * daysInMonth) : null;
  const monthLabel = new Date(`${todayIso}T12:00:00Z`).toLocaleDateString('sv-SE', { month: 'long', timeZone: 'UTC' });
  return { monthLabel, soFar, loggedDays, elapsedDays, projected };
}
