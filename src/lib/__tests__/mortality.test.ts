import { describe, it, expect } from "vitest";
import { mortalityRate, deathsByCause, aliveCount } from "../mortality";

const period = { start: "2026-01-01", end: "2026-01-31" };

describe("mortalityRate", () => {
  it("10 hens, 2 dead within period -> 20%", () => {
    const hens = Array.from({ length: 10 }, (_, i) => ({
      id: String(i),
      death_date: i < 2 ? "2026-01-15" : null,
    }));
    expect(mortalityRate(hens, period.start, period.end)).toBe(20);
  });

  it("period entirely outside any death -> 0%", () => {
    const hens = [{ id: "1", death_date: "2025-06-01" }];
    expect(mortalityRate(hens, period.start, period.end)).toBe(0);
  });

  it("hens without death_date are alive", () => {
    const hens = [
      { id: "1" },
      { id: "2", death_date: null },
      { id: "3", death_date: "2026-01-10" },
    ];
    expect(mortalityRate(hens, period.start, period.end)).toBeCloseTo(33.33, 1);
  });

  it("hens that died BEFORE period start are not counted in flock", () => {
    const hens = [
      { id: "1", death_date: "2025-12-01" }, // utanför flocken
      { id: "2", death_date: "2026-01-10" },
      { id: "3" },
    ];
    // Flock vid start: 2 (id 2 + id 3). 1 dog -> 50%
    expect(mortalityRate(hens, period.start, period.end)).toBe(50);
  });

  it("empty flock -> 0, not NaN", () => {
    expect(mortalityRate([], period.start, period.end)).toBe(0);
    expect(Number.isFinite(mortalityRate([], period.start, period.end))).toBe(true);
  });

  it("deathsByCause groups correctly", () => {
    const hens = [
      { id: "1", death_date: "2026-01-05", death_cause: "ålderdom" },
      { id: "2", death_date: "2026-01-06", death_cause: "ålderdom" },
      { id: "3", death_date: "2026-01-07", death_cause: "ålderdom" },
      { id: "4", death_date: "2026-01-08", death_cause: "sjukdom" },
      { id: "5", death_date: "2026-01-09", death_cause: "predator" },
    ];
    const grouped = deathsByCause(hens, period.start, period.end);
    expect(grouped).toEqual({ ålderdom: 3, sjukdom: 1, predator: 1 });
  });

  it("aliveCount as of date excludes deaths up to and including that date", () => {
    const hens = [
      { id: "1" },
      { id: "2", death_date: "2026-01-10" },
      { id: "3", death_date: "2026-01-20" },
    ];
    expect(aliveCount(hens, "2026-01-15")).toBe(2);
  });
});
