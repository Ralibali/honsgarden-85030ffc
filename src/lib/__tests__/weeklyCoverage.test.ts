import { describe, expect, it } from "vitest";
import { eggWeekCoverage } from "../weeklyCoverage";
describe("weekly coverage", () => {
  it("compares a Monday with the preceding Monday only, not the whole previous week", () => {
    const data = eggWeekCoverage(
      [
        { date: "2026-09-07", count: 4 },
        { date: "2026-08-31", count: 3 },
        { date: "2026-09-01", count: 99 },
        { date: "2026-09-08", count: 99 },
      ],
      "2026-09-07",
    );
    expect(data.elapsedDays).toBe(1);
    expect(data.total).toBe(4);
    expect(data.previousTotal).toBe(3);
    expect(data.difference).toBe(1);
  });
  it("distinguishes a recorded zero from a missing day", () => {
    const data = eggWeekCoverage(
      [
        { date: "2026-09-07", count: 0 },
        { date: "2026-08-31", count: 0 },
      ],
      "2026-09-08",
    );
    expect(data.recordedDays).toBe(1);
    expect(data.missingDays).toEqual(["2026-09-08"]);
    expect(data.daily["2026-09-07"]).toBe(0);
    expect(data.daily["2026-09-08"]).toBeNull();
    expect(data.difference).toBeNull();
  });
  it("counts calendar days over daylight saving and ignores invalid dates/counts", () => {
    const data = eggWeekCoverage(
      [
        { date: "2026-03-29", count: 3 },
        { date: "2026-02-30", count: 99 },
        { date: "2026-03-29", count: -1 },
        { date: "2026-03-29", count: 2 },
      ],
      "2026-03-29",
    );
    expect(data.elapsedDays).toBe(7);
    expect(data.total).toBe(5);
    expect(data.recordedDays).toBe(1);
    expect(data.averagePerRecordedDay).toBe(5);
  });
  it("handles year boundaries and fully logged zero periods", () => {
    const days = ["2025-12-29", "2025-12-30", "2025-12-31", "2026-01-01"];
    const previous = ["2025-12-22", "2025-12-23", "2025-12-24", "2025-12-25"];
    const data = eggWeekCoverage(
      [...days, ...previous].map((date) => ({ date, count: 0 })),
      "2026-01-01",
    );
    expect(data.comparable).toBe(true);
    expect(data.difference).toBe(0);
    expect(data.averagePerRecordedDay).toBe(0);
  });
});
