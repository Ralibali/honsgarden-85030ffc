import { describe, it, expect } from "vitest";
import { validatePostalCode } from "@/lib/postalCode";

describe("postalCode / validatePostalCode", () => {
  it("tomt värde är alltid OK (postnummer är valfritt)", () => {
    expect(validatePostalCode("", "SE").ok).toBe(true);
    expect(validatePostalCode(null, "US").ok).toBe(true);
  });

  it("accepterar svenska format med och utan mellanslag", () => {
    expect(validatePostalCode("58220", "SE").ok).toBe(true);
    expect(validatePostalCode("582 20", "SE").ok).toBe(true);
  });

  it("brittiska postnummer", () => {
    expect(validatePostalCode("SW1A 1AA", "GB").ok).toBe(true);
    expect(validatePostalCode("EC1A1BB", "GB").ok).toBe(true);
    expect(validatePostalCode("12345", "GB").ok).toBe(false);
  });

  it("amerikanska ZIP-koder (inkl ZIP+4)", () => {
    expect(validatePostalCode("10001", "US").ok).toBe(true);
    expect(validatePostalCode("10001-1234", "US").ok).toBe(true);
    expect(validatePostalCode("ABCDE", "US").ok).toBe(false);
  });

  it("kanadensiska postnummer", () => {
    expect(validatePostalCode("K1A 0B1", "CA").ok).toBe(true);
    expect(validatePostalCode("K1A0B1", "CA").ok).toBe(true);
  });

  it("nederländska postnummer", () => {
    expect(validatePostalCode("1012 AB", "NL").ok).toBe(true);
    expect(validatePostalCode("1012AB", "NL").ok).toBe(true);
  });

  it("tyska postnummer", () => {
    expect(validatePostalCode("10115", "DE").ok).toBe(true);
  });

  it("okänt land accepterar allt (icke-blockerande default)", () => {
    expect(validatePostalCode("anything", "ZZ").ok).toBe(true);
  });
});
