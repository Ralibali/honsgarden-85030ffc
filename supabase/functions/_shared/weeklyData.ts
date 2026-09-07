/** Normalize report data without turning unavailable measurements into zero. */
function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : null;
}
const text = (value: unknown, max = 120) =>
  typeof value === "string" ? value.slice(0, max) : "";
export function normalizeWeekData(raw: unknown) {
  const value =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const coverage =
    value.coverage && typeof value.coverage === "object"
      ? (value.coverage as Record<string, unknown>)
      : {};
  const expected = numberOrNull(coverage.expectedDays);
  const recorded = numberOrNull(coverage.recordedDays);
  const previous = numberOrNull(coverage.previousRecordedDays);
  const comparable =
    value.reportingBasis === "same_weekdays" &&
    expected !== null &&
    Number.isInteger(expected) &&
    expected >= 1 &&
    expected <= 7 &&
    recorded === expected &&
    previous === expected;
  return {
    weekLabel: text(value.weekLabel, 50),
    season: text(value.season, 30),
    henCount: numberOrNull(value.henCount),
    weekEggs: numberOrNull(value.weekEggs),
    prevWeekEggs: numberOrNull(value.prevWeekEggs),
    avgPerDay: numberOrNull(value.avgPerDay),
    bestDay: text(value.bestDay, 60),
    streak: numberOrNull(value.streak),
    feedCost: numberOrNull(value.feedCost),
    costPerEgg: numberOrNull(value.costPerEgg),
    completedChores: numberOrNull(value.completedChores),
    missedChores: numberOrNull(value.missedChores),
    activeHatchings: numberOrNull(value.activeHatchings),
    healthNotes: numberOrNull(value.healthNotes),
    comparable,
    expectedDays: expected,
    recordedDays: recorded,
    previousRecordedDays: previous,
  };
}
export function buildUserPrompt(
  data: ReturnType<typeof normalizeWeekData>,
): string {
  const lines = [
    "Rapport över REGISTRERADE uppgifter, inte bevisad total äggproduktion.",
    `Period: ${data.weekLabel || "okänd"}. Säsong: ${data.season || "okänd"}.`,
    `Registrerade dagar: ${data.recordedDays ?? "okänt"}/${data.expectedDays ?? "okänt"}; föregående jämförda period: ${data.previousRecordedDays ?? "okänt"}/${data.expectedDays ?? "okänt"}.`,
    `Registrerade ägg denna period: ${data.weekEggs ?? "uppgift saknas"}.`,
    `Aktiva hönor: ${data.henCount ?? "uppgift saknas"}.`,
    `Snitt per REGISTRERAD dag: ${data.avgPerDay === null ? "uppgift saknas" : data.avgPerDay.toFixed(1)}.`,
  ];
  if (data.comparable && data.weekEggs !== null && data.prevWeekEggs !== null) {
    lines.push(
      `Jämför samma veckodagar föregående vecka: ${data.prevWeekEggs} registrerade ägg. Skillnad: ${data.weekEggs - data.prevWeekEggs}.`,
    );
  } else
    lines.push(
      "Underlaget räcker inte för en trend. Jämför inte periodernas totalsummor och anta inte noll ägg för dagar utan registrering.",
    );
  if (data.streak !== null)
    lines.push(`Registreringar i rad: ${data.streak} dagar.`);
  if (data.completedChores !== null)
    lines.push(
      `Markerade sysslor IDAG: ${data.completedChores}. Detta är inte veckans total.`,
    );
  if (data.costPerEgg !== null)
    lines.push(
      `Kostnad per ägg i registrerad historik: ${data.costPerEgg} kr.`,
    );
  if (data.healthNotes !== null)
    lines.push(`Hälsonoteringar: ${data.healthNotes}.`);
  lines.push(
    "Saknade uppgifter är okända, inte noll. Dra inga slutsatser om foder, hälsa, väder, missade rutiner eller kläckningar utan angivna uppgifter. Förklara inte skillnader som säker orsak och verkan. Skapa rapporten via weekly_report.",
  );
  return lines.join("\n");
}
