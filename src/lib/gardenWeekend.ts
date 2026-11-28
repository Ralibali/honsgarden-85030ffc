import { addDaysIso, isIsoDay, mondayOfWeekIso } from "./isoDay";

export type GardenEvent = { id: string; day: string; title: string };
export function weekendDays(day: string) {
  const monday = mondayOfWeekIso(day);
  return monday ? [addDaysIso(monday, 5)!, addDaysIso(monday, 6)!] : [];
}

/** Reads the all-day VEVENTs emitted by Odlingsdagboken's calendar export. */
export function readGardenCalendar(raw: string): GardenEvent[] {
  if (raw.length > 4_000_000 || !/^BEGIN:VCALENDAR\s*$/im.test(raw))
    throw new Error("Välj en kalenderfil (.ics) från Odlingsdagboken.");
  const events = new Map<string, GardenEvent>();
  const unfolded = raw.replace(/\r?\n[ \t]/g, "");
  for (const block of unfolded.matchAll(
    /^BEGIN:VEVENT\r?\n([\s\S]*?)^END:VEVENT\s*$/gim
  )) {
    const read = (key: string) =>
      block[1]
        .match(new RegExp("^" + key + "(?:;[^:\\r\\n]*)?:(.*)$", "im"))?.[1]
        .trim();
    const date = read("DTSTART");
    const summary = read("SUMMARY");
    const id = read("UID");
    if (
      !id ||
      !summary ||
      !date ||
      !/^\d{8}$/.test(date) ||
      read("STATUS") === "CANCELLED"
    )
      continue;
    const day = date.slice(0, 4) + "-" + date.slice(4, 6) + "-" + date.slice(6);
    if (!isIsoDay(day)) continue;
    const title = summary
      .replace(/\\([nN,;\\])/g, (_, c: string) =>
        c.toLowerCase() === "n" ? " " : c
      )
      .slice(0, 250);
    events.set(id, { id, day, title });
  }
  return [...events.values()].sort(
    (a, b) => a.day.localeCompare(b.day) || a.title.localeCompare(b.title, "sv")
  );
}
