/**
 * Kläckningskalkylator — ren, deterministisk datumberäkning för ruvning.
 *
 * Inga nätverksanrop, inget konto, ingen state. Samma logik används av den
 * publika sidan /verktyg/klackningskalkylator och kan återanvändas av
 * appens kläckningsflöde.
 *
 * Startdagen är dag 0; dag 21 ligger 21 kalenderdagar efter start.
 * Milstolparna är planeringspåminnelser för hönsägg. Utrustningens och
 * metodens anvisningar styr handhavandet; datum är ingen kläckgaranti.
 */

export const CHICKEN_INCUBATION_DAYS = 21;

export interface HatchMilestone {
  /** Förflutna kalenderdagar sedan start (start = dag 0). */
  day: number;
  /** ISO-datum (yyyy-mm-dd). */
  date: string;
  label: string;
  description: string;
  /** 'action' = något du ska göra, 'event' = något som väntas hända. */
  kind: 'action' | 'event';
}

export interface HatchPlan {
  /** ISO-datum (yyyy-mm-dd) då äggen lades/ruvningen startade. */
  startDate: string;
  incubationDays: number;
  /** Beräknad kläckdag (ISO). */
  hatchDate: string;
  milestones: HatchMilestone[];
}

/** ISO-datumsträng (yyyy-mm-dd) eller null om ogiltig. */
export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parsar yyyy-mm-dd till UTC-mitt-på-dagen (undviker DST-förskjutning
 * när vi sedan adderar hela dygn — svensk sommartid flyttar klockan).
 * Returnerar null för ogiltiga datum som 2026-02-30.
 */
export function parseIsoDate(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * DAY_MS);
}

/** Svensk visningsform: "mån 23 mar 2026"-stil via sv-SE. */
export function formatSvDate(iso: string): string {
  const parsed = parseIsoDate(iso);
  if (!parsed) return iso;
  return parsed.toLocaleDateString('sv-SE', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Bygger en komplett ruvningsplan från startdatum.
 * Returnerar null om startdatumet är ogiltigt.
 */
export function computeHatchPlan(
  startIso: string,
  incubationDays: number = CHICKEN_INCUBATION_DAYS,
): HatchPlan | null {
  const start = parseIsoDate(startIso);
  if (!start || !Number.isInteger(incubationDays) || incubationDays < 1 || incubationDays > 365) return null;

  // Other durations get arithmetic only, without scaled care instructions.
  const candle1 = Math.round(incubationDays / 3); // dag 7 vid 21
  const candle2 = Math.round((incubationDays * 2) / 3); // dag 14 vid 21
  const lockdown = incubationDays - 3; // dag 18 vid 21
  const hatch = incubationDays; // dag 21
  const late = incubationDays + 2; // dag 23 vid 21

  const at = (day: number) => toIsoDate(addDays(start, day));

  return {
    startDate: toIsoDate(start),
    incubationDays,
    hatchDate: at(hatch),
    milestones: [
      {
        day: 0,
        date: at(0),
        label: 'Ruvningen startar',
        description: 'Notera startdatum och klockslag. Här räknas starten som dag 0; ett dygn senare är dag 1.',
        kind: 'event',
      },
      {
        day: candle1,
        date: at(candle1),
        label: 'Första lysningen',
        description: 'Planerad observation. Följ din metodanvisning och sök kunnig hjälp vid osäkerhet. Ett oklart resultat betyder inte automatiskt att ägget ska kasseras.',
        kind: 'action',
      },
      {
        day: candle2,
        date: at(candle2),
        label: 'Andra lysningen (valfri)',
        description: 'Följ upp enligt din plan. Anteckna observationer och vad som fortfarande är osäkert; dra ingen säker slutsats från en otydlig lysning.',
        kind: 'action',
      },
      {
        day: lockdown,
        date: at(lockdown),
        label: 'Förbered inför kläckningen',
        description: 'Kontrollera rätt anvisning för när vändning ska avslutas och hur inställningarna ska ändras. Anpassa till din maskin eller ruvande höna.',
        kind: 'action',
      },
      {
        day: hatch,
        date: at(hatch),
        label: 'Beräknad kläckdag',
        description: 'De flesta kycklingar pippar och kläcks omkring den här dagen. Öppna inte maskinen i onödan.',
        kind: 'event',
      },
      {
        day: late,
        date: at(late),
        label: 'Följ upp omgången',
        description: 'Det här är en uppföljningsdag, ingen sista kläckdag eller instruktion att kasta ägg. Sök kunnig hjälp om förloppet är oklart.',
        kind: 'event',
      },
    ].filter(m => incubationDays === CHICKEN_INCUBATION_DAYS || m.day === 0 || m.day === hatch) as HatchMilestone[],
  };
}

/** Hela dygn kvar till kläckdagen från ett referensdatum (0 = idag). */
export function daysUntilHatch(plan: HatchPlan, todayIso: string): number | null {
  const hatch = parseIsoDate(plan.hatchDate);
  const today = parseIsoDate(todayIso);
  if (!hatch || !today) return null;
  return Math.round((hatch.getTime() - today.getTime()) / DAY_MS);
}
