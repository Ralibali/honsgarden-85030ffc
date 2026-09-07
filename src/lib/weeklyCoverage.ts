import { todayLocal } from "@/lib/datetime";

const DAY = 86_400_000;
function dayNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time / DAY
    : null;
}
const dayText = (value: number) =>
  new Date(value * DAY).toISOString().slice(0, 10);
export type EggCoverage = ReturnType<typeof eggWeekCoverage>;
/** Compare the same local calendar weekdays; a missing log never becomes a zero. */
export function eggWeekCoverage(
  eggs: { date: string; count: number }[],
  today = todayLocal(),
) {
  const end = dayNumber(today);
  if (end === null) throw new Error("Ogiltigt rapportdatum");
  const elapsedDays = ((new Date(end * DAY).getUTCDay() + 6) % 7) + 1;
  const start = end - elapsedDays + 1;
  const days = Array.from({ length: elapsedDays }, (_, index) =>
    dayText(start + index),
  );
  const previousDays = days.map((_, index) => dayText(start - 7 + index));
  const daily = new Map<string, number>();
  for (const row of eggs) {
    if (
      dayNumber(row.date) === null ||
      !Number.isSafeInteger(row.count) ||
      row.count < 0
    )
      continue;
    daily.set(row.date, (daily.get(row.date) || 0) + row.count);
  }
  const missingDays = days.filter((day) => !daily.has(day));
  const previousMissingDays = previousDays.filter((day) => !daily.has(day));
  const recordedDays = days.length - missingDays.length;
  const previousRecordedDays = previousDays.length - previousMissingDays.length;
  const total = days.reduce((sum, day) => sum + (daily.get(day) || 0), 0);
  const previousTotal = previousDays.reduce(
    (sum, day) => sum + (daily.get(day) || 0),
    0,
  );
  const comparable =
    missingDays.length === 0 && previousMissingDays.length === 0;
  const best =
    days
      .filter((day) => daily.has(day))
      .sort((a, b) => daily.get(b)! - daily.get(a)!)[0] || null;
  return {
    start: days[0],
    end: today,
    previousStart: previousDays[0],
    previousEnd: previousDays.at(-1)!,
    elapsedDays,
    days,
    missingDays,
    previousMissingDays,
    recordedDays,
    previousRecordedDays,
    total,
    previousTotal,
    comparable,
    difference: comparable ? total - previousTotal : null,
    averagePerRecordedDay: recordedDays ? total / recordedDays : null,
    bestDay: best,
    daily: Object.fromEntries(days.map((day) => [day, daily.get(day) ?? null])),
  };
}
export function coverageSummary(data: EggCoverage) {
  return `${data.recordedDays} av ${data.elapsedDays} dagar registrerade denna vecka. ${data.previousRecordedDays} av ${data.elapsedDays} samma veckodagar registrerade föregående vecka.`;
}
export function coverageInsights(data: EggCoverage): string[] {
  const lines = [`${data.total} ägg registrerade ${data.start}–${data.end}.`];
  if (data.comparable)
    lines.push(
      `${data.difference! > 0 ? "+" : ""}${data.difference} registrerade ägg jämfört med samma veckodagar föregående vecka.`,
    );
  else
    lines.push(
      "Trend visas när båda perioderna har registreringar för varje dag. Saknade dagar räknas inte som noll ägg.",
    );
  if (data.averagePerRecordedDay !== null)
    lines.push(
      `Snitt ${data.averagePerRecordedDay.toFixed(1)} ägg per registrerad dag (${data.recordedDays} dagar).`,
    );
  lines.push(coverageSummary(data));
  return lines;
}
