/**
 * Fri retention-loop (Swarm H).
 *
 * Deterministisk tillståndsmaskin över användarens logg-recency.
 * Används av dashboarden för varsamma påminnelser — aldrig skuldkänslor,
 * och vinterläget förklarar att pausad värpning är normalt ("ingenting
 * är fel"-utbildningen i stället för oro).
 */

import type { SeasonalMode } from '@/lib/seasonalMode';

export type LogRecencyState =
  | 'logged_today'   // loggat idag — allt bra
  | 'active'         // loggat igår — ingen åtgärd
  | 'gentle_reminder'// 2–3 dagar sedan — varsam puff
  | 'at_risk'        // 4–13 dagar — streak/vanor i fara
  | 'dormant'        // ≥14 dagar eller aldrig loggat — återaktivering
  ;

export interface LogRecency {
  state: LogRecencyState;
  /** Hela dygn sedan senaste logg. null om aldrig loggat. */
  daysSince: number | null;
  /** Svensk nudge-copy anpassad efter säsong. */
  title: string;
  body: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Hela dygn mellan två ISO-datum (yyyy-mm-dd). null om ogiltigt. */
export function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${fromIso}T12:00:00Z`);
  const to = Date.parse(`${toIso}T12:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to)) return null;
  return Math.round((to - from) / DAY_MS);
}

/**
 * Beräknar recency-tillstånd från senaste loggdatumet.
 * `todayIso` skickas in (inte new Date()) så funktionen är ren/testbar.
 */
export function getLogRecency(
  lastLogDate: string | null | undefined,
  todayIso: string,
  mode: SeasonalMode = 'summer',
): LogRecency {
  const days = lastLogDate ? daysBetweenIso(lastLogDate, todayIso) : null;

  const winter = mode === 'winter';
  const winterNote = winter
    ? ' Kom ihåg: många hönor värper mindre på vintern, så en lugn äggkurva är helt normalt.'
    : '';

  if (days === null || days >= 14) {
    return {
      state: 'dormant',
      daysSince: days,
      title: 'Välkommen tillbaka till hönsgården',
      body: `Det har blivit ${days === null ? 'ett tag' : `${days} dagar`} sedan du loggade. Ett tryck på äggknappen räcker för att komma igång igen.${winterNote}`,
    };
  }
  if (days >= 4) {
    return {
      state: 'at_risk',
      daysSince: days,
      title: 'Håll streaken vid liv',
      body: `Senaste loggen var för ${days} dagar sedan. Logga dagens ägg så håller statistiken och streaken ihop.${winterNote}`,
    };
  }
  if (days >= 2) {
    return {
      state: 'gentle_reminder',
      daysSince: days,
      title: 'Dags att samla dagens ägg?',
      body: `Det var ${days} dagar sedan du loggade. En snabb logg håller koll på värpningen.${winterNote}`,
    };
  }
  if (days === 1) {
    return {
      state: 'active',
      daysSince: days,
      title: '',
      body: '',
    };
  }
  return {
    state: 'logged_today',
    daysSince: Math.max(0, days),
    title: '',
    body: '',
  };
}

/** Senaste loggdatum (yyyy-mm-dd) ur en lista egg_logs-rader, eller null. */
export function lastLogDateFromEggs(eggs: { date?: string | null; count?: number | null }[]): string | null {
  let latest: string | null = null;
  for (const egg of eggs) {
    if (!egg?.date || !(egg.count ?? 0)) continue;
    if (!latest || egg.date > latest) latest = egg.date;
  }
  return latest;
}
