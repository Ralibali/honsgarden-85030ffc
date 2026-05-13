import { describe, it, expect } from "vitest";
import {
  hatchRate,
  fertilityRate,
  hatchOfFertileRate,
  survivalRate7d,
  formatRateInt,
} from "../hatchRate";

describe("hatchRate", () => {
  it("standard: 10 set / 8 fertile / 6 hatched", () => {
    const s = { eggs_set: 10, eggs_fertile: 8, eggs_hatched: 6 };
    expect(hatchRate(s)).toBe(60);
    expect(fertilityRate(s)).toBe(80);
    expect(hatchOfFertileRate(s)).toBe(75);
  });

  it("zero eggs returns 0, never NaN/Infinity", () => {
    const s = { eggs_set: 0, eggs_fertile: 0, eggs_hatched: 0 };
    expect(hatchRate(s)).toBe(0);
    expect(fertilityRate(s)).toBe(0);
    expect(hatchOfFertileRate(s)).toBeNull();
    expect(Number.isFinite(hatchRate(s)!)).toBe(true);
  });

  it("incubating (no fertility/hatched yet) returns null for hatch rate", () => {
    const s = { eggs_set: 12, eggs_fertile: null, eggs_hatched: null };
    expect(hatchRate(s)).toBeNull();
    expect(fertilityRate(s)).toBeNull();
  });

  it("partial: fertility known, hatched still null", () => {
    const s = { eggs_set: 12, eggs_fertile: 10, eggs_hatched: null };
    expect(fertilityRate(s)).toBeCloseTo(83.33, 1);
    expect(hatchRate(s)).toBeNull();
    expect(hatchOfFertileRate(s)).toBeNull();
  });

  it("7d survival: 6 hatched, 5 survived = 83.3%", () => {
    const s = {
      eggs_set: 10,
      eggs_fertile: 8,
      eggs_hatched: 6,
      chicks_survived_7d: 5,
    };
    expect(survivalRate7d(s)!).toBeCloseTo(83.33, 1);
  });

  it("survival null when hatched is 0 or unknown", () => {
    expect(survivalRate7d({ eggs_set: 0, eggs_hatched: 0, chicks_survived_7d: 0 })).toBeNull();
    expect(survivalRate7d({ eggs_set: 10, eggs_hatched: null, chicks_survived_7d: 5 })).toBeNull();
  });

  it("formatRateInt rounds to integer percent (matches Breeding.tsx)", () => {
    // 1/3 = 33.33...%; UI använder Math.round -> "33%"
    expect(formatRateInt(hatchRate({ eggs_set: 3, eggs_hatched: 1 }))).toBe("33%");
    expect(formatRateInt(hatchRate({ eggs_set: 6, eggs_hatched: 5 }))).toBe("83%");
    expect(formatRateInt(null)).toBe("–");
  });
});
