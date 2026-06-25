import { describe, it, expect } from "vitest";
import { COUNTRIES, getCountryDefaults } from "@/lib/countries";

describe("countries / regional defaults", () => {
  it("svenska konton: sv, SEK, metric, °C", () => {
    const se = COUNTRIES.SE;
    expect(se.language).toBe("sv");
    expect(se.currency).toBe("SEK");
    expect(se.measurement).toBe("metric");
    expect(se.temperature).toBe("C");
  });

  it("amerikanska konton: en, USD, imperial, °F", () => {
    const us = COUNTRIES.US;
    expect(us.language).toBe("en");
    expect(us.currency).toBe("USD");
    expect(us.measurement).toBe("imperial");
    expect(us.temperature).toBe("F");
  });

  it("brittiska konton: en, GBP, metric, °C", () => {
    const gb = COUNTRIES.GB;
    expect(gb.language).toBe("en");
    expect(gb.currency).toBe("GBP");
    expect(gb.measurement).toBe("metric");
    expect(gb.temperature).toBe("C");
  });

  it("australiska konton: en, AUD, metric, °C", () => {
    const au = COUNTRIES.AU;
    expect(au.language).toBe("en");
    expect(au.currency).toBe("AUD");
    expect(au.measurement).toBe("metric");
    expect(au.temperature).toBe("C");
  });

  it("okänd kod faller tillbaka till Sverige", () => {
    expect(getCountryDefaults("ZZ").code).toBe("SE");
    expect(getCountryDefaults(null).code).toBe("SE");
  });

  it("USA/Kanada/Australien tidszon är endast en fallback (inte enda zonen)", () => {
    // Defensiv: vi exponerar endast EN default, men UI ska tillåta byte.
    expect(COUNTRIES.US.timezone).toBeTruthy();
    expect(COUNTRIES.CA.timezone).toBeTruthy();
    expect(COUNTRIES.AU.timezone).toBeTruthy();
  });
});
