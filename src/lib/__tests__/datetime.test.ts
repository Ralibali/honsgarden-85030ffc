import { describe, it, expect } from "vitest";
import { todayInTz, localCalendarDate } from "@/lib/datetime";

// Vid 23:30 UTC den 25 juni 2026 ska olika tidszoner se olika kalenderdatum.
const lateUTC = new Date(Date.UTC(2026, 5, 25, 23, 30, 0));   // 23:30 UTC
const earlyUTC = new Date(Date.UTC(2026, 5, 25, 0, 30, 0));   // 00:30 UTC

describe("datetime / localCalendarDate", () => {
  it("Europe/Stockholm hanterar sommartid (DST → +02:00)", () => {
    // 23:30 UTC = 01:30 lokal nästa dag i Stockholm sommartid
    expect(localCalendarDate(lateUTC, "Europe/Stockholm")).toBe("2026-06-26");
  });

  it("Europe/London under sommartid (BST → +01:00)", () => {
    expect(localCalendarDate(lateUTC, "Europe/London")).toBe("2026-06-26");
    expect(localCalendarDate(earlyUTC, "Europe/London")).toBe("2026-06-25");
  });

  it("America/New_York vid midnatt UTC ligger fortfarande på föregående dag", () => {
    expect(localCalendarDate(earlyUTC, "America/New_York")).toBe("2026-06-24");
  });

  it("America/Los_Angeles ligger ännu längre bak", () => {
    expect(localCalendarDate(earlyUTC, "America/Los_Angeles")).toBe("2026-06-24");
  });

  it("Australia/Sydney ligger på morgonen efter UTC-midnatt", () => {
    expect(localCalendarDate(earlyUTC, "Australia/Sydney")).toBe("2026-06-25");
    expect(localCalendarDate(lateUTC, "Australia/Sydney")).toBe("2026-06-26");
  });

  it("Pacific/Auckland ligger ännu längre fram", () => {
    expect(localCalendarDate(earlyUTC, "Pacific/Auckland")).toBe("2026-06-25");
    expect(localCalendarDate(lateUTC, "Pacific/Auckland")).toBe("2026-06-26");
  });

  it("todayInTz returnerar YYYY-MM-DD-format", () => {
    expect(todayInTz("Europe/Stockholm")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("Faller tillbaka till Stockholm vid ogiltig tidszon", () => {
    // Inte tidszon → använd fallback. Resultatet ska vara giltigt datumformat.
    expect(localCalendarDate(lateUTC, "Not/A_Zone")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
