import { describe, it, expect } from "vitest";
import {
  validateReportPeriod,
  parseAndValidate,
  daysInPeriod,
  ReportPeriodInput,
} from "../reportPeriod";

const FARM = "00000000-0000-0000-0000-000000000001";
const NOW = new Date("2026-05-13T12:00:00Z");

const base = {
  farm_id: FARM,
  report_type: "manad" as const,
  period_start: "2026-04-01",
  period_end: "2026-04-30",
};

describe("validateReportPeriod", () => {
  it("end > start: OK", () => {
    expect(validateReportPeriod(base, NOW).ok).toBe(true);
  });

  it("end < start: fel", () => {
    const r = validateReportPeriod(
      { ...base, period_start: "2026-04-30", period_end: "2026-04-01" },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/efter startdatum/);
  });

  it("end = start: OK (en-dags-rapport)", () => {
    const r = validateReportPeriod(
      { ...base, period_start: "2026-04-15", period_end: "2026-04-15" },
      NOW
    );
    expect(r.ok).toBe(true);
  });

  it("start i framtiden: fel", () => {
    const r = validateReportPeriod(
      { ...base, period_start: "2027-01-01", period_end: "2027-01-31" },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/framtiden/);
  });

  it("end mer än 5 år bakåt: fel", () => {
    const r = validateReportPeriod(
      {
        ...base,
        report_type: "ar",
        period_start: "2020-01-01",
        period_end: "2020-12-31",
      },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/5 år/);
  });

  it("manad > 31 dagar: fel", () => {
    const r = validateReportPeriod(
      { ...base, period_start: "2026-03-01", period_end: "2026-04-15" },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/manad/);
  });

  it("kvartal > 95 dagar: fel", () => {
    const r = validateReportPeriod(
      {
        ...base,
        report_type: "kvartal",
        period_start: "2026-01-01",
        period_end: "2026-04-30", // 120 dagar
      },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/kvartal/);
  });

  it("ar > 366 dagar: fel", () => {
    const r = validateReportPeriod(
      {
        ...base,
        report_type: "ar",
        period_start: "2024-01-01",
        period_end: "2025-06-01",
      },
      NOW
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/ar/);
  });

  it("avel utan period-begränsning utöver de generella", () => {
    const r = validateReportPeriod(
      {
        ...base,
        report_type: "avel",
        period_start: "2024-01-01",
        period_end: "2026-04-30",
      },
      NOW
    );
    expect(r.ok).toBe(true);
  });

  it("kvartal exakt 95 dagar: OK (gränsen)", () => {
    expect(daysInPeriod("2026-01-01", "2026-04-05")).toBe(95);
    const r = validateReportPeriod(
      {
        ...base,
        report_type: "kvartal",
        period_start: "2026-01-01",
        period_end: "2026-04-05",
      },
      NOW
    );
    expect(r.ok).toBe(true);
  });
});

describe("parseAndValidate (zod + affärsregler)", () => {
  it("ogiltig datumsträng: fel med tydligt meddelande", () => {
    const r = parseAndValidate({ ...base, period_start: "inte-ett-datum" }, NOW);
    expect(r.ok).toBe(false);
    if (r.ok === false) expect(r.error).toMatch(/datum/i);
  });

  it("ogiltigt UUID för farm_id: fel", () => {
    const r = parseAndValidate({ ...base, farm_id: "abc" }, NOW);
    expect(r.ok).toBe(false);
  });

  it("okänd report_type: fel", () => {
    const r = parseAndValidate({ ...base, report_type: "vecka" }, NOW);
    expect(r.ok).toBe(false);
  });

  it("giltig payload: ok", () => {
    const r = parseAndValidate(base, NOW);
    expect(r.ok).toBe(true);
  });
});

describe("ReportPeriodInput schema", () => {
  it("validerar minimal payload", () => {
    expect(ReportPeriodInput.safeParse(base).success).toBe(true);
  });
});
