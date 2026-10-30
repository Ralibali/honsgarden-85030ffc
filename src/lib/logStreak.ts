/**
 * Loggvanor: streak och veckoring räknas på LOGGADE dagar, inte på dagar
 * med ägg.
 *
 * När dagarna blir korta pausar många hönor värpningen helt. Om streaken
 * krävde minst ett ägg om dagen skulle den dö varje vinter utan att
 * användaren gjort något fel. En registrering med 0 ägg ("Inga ägg idag")
 * är lika mycket omsorg om flocken – och gör dessutom statistiken säkrare,
 * eftersom en saknad dag aldrig behöver gissas till noll.
 */
import { addDaysIso, isIsoDay, mondayOfWeekIso } from '@/lib/isoDay';

export interface LogRow {
  date?: string | null;
  count?: number | null;
}

/** Hur långt bakåt en streak räknas. */
const MAX_STREAK_DAYS = 3650;

/** Alla kalenderdagar som har minst en registrering (även 0 ägg). */
export function loggedDaySet(rows: LogRow[], todayIso?: string): Set<string> {
  const days = new Set<string>();
  for (const row of rows) {
    if (!isIsoDay(row?.date)) continue;
    if (todayIso && row.date > todayIso) continue;
    const count = Number(row.count ?? 0);
    if (!Number.isFinite(count) || count < 0) continue;
    days.add(row.date);
  }
  return days;
}

export interface LogStreak {
  /** Dagar i rad med registrering. Idag räknas när den är loggad, annars hålls streaken öppen till midnatt. */
  current: number;
  loggedToday: boolean;
  /** Ägg idag (0 om dagen är loggad som äggfri eller inte loggad alls). */
  eggsToday: number;
}

export function computeLogStreak(rows: LogRow[], todayIso: string): LogStreak {
  if (!isIsoDay(todayIso)) return { current: 0, loggedToday: false, eggsToday: 0 };
  const days = loggedDaySet(rows, todayIso);
  const loggedToday = days.has(todayIso);
  let current = 0;
  for (let ago = loggedToday ? 0 : 1; ago < MAX_STREAK_DAYS; ago += 1) {
    const day = addDaysIso(todayIso, -ago);
    if (!day || !days.has(day)) break;
    current += 1;
  }
  const eggsToday = rows.reduce((sum, row) => (row?.date === todayIso ? sum + Math.max(0, Number(row.count) || 0) : sum), 0);
  return { current, loggedToday, eggsToday };
}

export interface WeekDay {
  date: string;
  /** "mån", "tis" … */
  label: string;
  logged: boolean;
  isToday: boolean;
  isFuture: boolean;
}

export interface WeekProgress {
  weekStart: string;
  days: WeekDay[];
  loggedCount: number;
  /** Dagar som fortfarande kan loggas den här veckan (idag inräknat om den saknas). */
  remainingPossible: number;
  perfect: boolean;
  /** Avslutade perfekta veckor i rad före den här, plus den här om den redan är perfekt. */
  perfectWeeksInRow: number;
}

const WEEKDAY_LABELS = ['mån', 'tis', 'ons', 'tors', 'fre', 'lör', 'sön'];
/** Hur många veckor bakåt "perfekta veckor i rad" letar. */
const MAX_WEEKS_BACK = 104;

function isPerfectWeek(days: Set<string>, monday: string): boolean {
  for (let i = 0; i < 7; i += 1) {
    const day = addDaysIso(monday, i);
    if (!day || !days.has(day)) return false;
  }
  return true;
}

/** Veckoringen: sju dagar måndag–söndag i den vecka `todayIso` ligger i. */
export function computeWeekProgress(rows: LogRow[], todayIso: string): WeekProgress | null {
  const monday = mondayOfWeekIso(todayIso);
  if (!monday) return null;
  const logged = loggedDaySet(rows, todayIso);
  const days: WeekDay[] = WEEKDAY_LABELS.map((label, i) => {
    const date = addDaysIso(monday, i)!;
    return { date, label, logged: logged.has(date), isToday: date === todayIso, isFuture: date > todayIso };
  });
  const loggedCount = days.filter((d) => d.logged).length;
  const remainingPossible = days.filter((d) => !d.logged && (d.isFuture || d.isToday)).length;
  const perfect = loggedCount === 7;

  let previousPerfect = 0;
  for (let w = 1; w <= MAX_WEEKS_BACK; w += 1) {
    const prevMonday = addDaysIso(monday, -7 * w);
    if (!prevMonday || !isPerfectWeek(logged, prevMonday)) break;
    previousPerfect += 1;
  }
  return {
    weekStart: monday,
    days,
    loggedCount,
    remainingPossible,
    perfect,
    perfectWeeksInRow: previousPerfect + (perfect ? 1 : 0),
  };
}
