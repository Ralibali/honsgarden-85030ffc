// Gemensamma datum/tid-hjälpare. Alla användarflöden ska gå via dessa
// så att händelser hamnar på rätt LOKAL kalenderdag i användarens tidszon.
//
// VIKTIGT: ersätter `new Date().toISOString().split('T')[0]` som är UTC-baserad
// och därför kan registrera ägg/hälsa på fel dag runt midnatt.

const FALLBACK_TZ = "Europe/Stockholm";

function safeTz(tz?: string | null): string {
  if (!tz) return FALLBACK_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return FALLBACK_TZ;
  }
}

/** YYYY-MM-DD för dagens lokala datum i given tidszon. */
export function todayInTz(tz?: string | null): string {
  return localCalendarDate(new Date(), tz);
}

/** YYYY-MM-DD för ett valt datum, i given tidszon. */
export function localCalendarDate(date: Date | string | number, tz?: string | null): string {
  const d = date instanceof Date ? date : new Date(date);
  const z = safeTz(tz);
  // sv-SE ger ISO-liknande "YYYY-MM-DD"
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: z,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find(p => p.type === "year")?.value ?? "1970";
  const m = parts.find(p => p.type === "month")?.value ?? "01";
  const day = parts.find(p => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

export function formatDate(
  date: Date | string | number,
  locale: string = "sv-SE",
  tz?: string | null,
  opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "long", day: "numeric" },
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, { timeZone: safeTz(tz), ...opts }).format(d);
}

export function formatTime(
  date: Date | string | number,
  locale: string = "sv-SE",
  tz?: string | null,
  opts: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" },
): string {
  const d = date instanceof Date ? date : new Date(date);
  return new Intl.DateTimeFormat(locale, { timeZone: safeTz(tz), ...opts }).format(d);
}
