import { describe, expect, it, vi } from "vitest";
import {
  DIGITAL_PRIVATE_HEADERS,
  digitalRateLimitAllows,
  formatSek,
  getDigitalProduct,
  normalizeEmail,
  vatBreakdown,
} from "../../../supabase/functions/_shared/digitalProduct";

const product = getDigitalProduct("mina-forsta-hons")!;

describe("getDigitalProduct", () => {
  it("hittar den riktiga produkten", () => {
    expect(product.amountOre).toBe(19900);
    expect(product.vatRate).toBe(0.06);
    expect(product.stripeTaxRateId).toMatch(/^txr_/);
    expect(product.samplePath).toBe("samples/mina-forsta-hons-smakprov.pdf");
    expect(product.totalPages).toBe(24);
    expect(product.samplePages).toBe(4);
  });

  it("avvisar prototypnycklar", () => {
    expect(getDigitalProduct("__proto__")).toBeNull();
    expect(getDigitalProduct("constructor")).toBeNull();
    expect(getDigitalProduct("toString")).toBeNull();
    expect(getDigitalProduct("okand")).toBeNull();
    expect(getDigitalProduct(null)).toBeNull();
  });
});

describe("moms och belopp", () => {
  it("räknar ut 6 % inkluderad moms på 199 kr", () => {
    const { netOre, vatOre } = vatBreakdown(19900, 0.06);
    expect(vatOre).toBe(1126);
    expect(netOre).toBe(18774);
    expect(netOre + vatOre).toBe(19900);
  });

  it("visar heltal utan decimaler och ojämna belopp med två", () => {
    expect(formatSek(19900)).toBe("199 kr");
    expect(formatSek(1126).replace(/\u00a0/g, " ")).toBe("11,26 kr");
  });
});

describe("normalizeEmail", () => {
  it("trimmar och gemener", () => {
    expect(normalizeEmail("  Test@Example.SE ")).toBe("test@example.se");
  });
  it("avvisar tomt och för långt", () => {
    expect(normalizeEmail("   ")).toBeNull();
    expect(normalizeEmail(`${"a".repeat(250)}@x.se`)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });
});

describe("digitalRateLimitAllows", () => {
  const admin = (result: { data: unknown; error: { message: string } | null }) => ({
    rpc: vi.fn().mockResolvedValue(result),
  });

  it("tillåter när spärren uttryckligen säger ja", async () => {
    await expect(digitalRateLimitAllows(admin({ data: true, error: null }), {
      scope: "s", value: "v", max: 5, windowMinutes: 10,
    })).resolves.toBe(true);
  });

  it("stänger vid databasfel (fail closed)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(digitalRateLimitAllows(admin({ data: null, error: { message: "boom" } }), {
      scope: "s", value: "v", max: 5, windowMinutes: 10,
    })).resolves.toBe(false);
    spy.mockRestore();
  });

  it("stänger vid överskriden gräns och tom nyckel", async () => {
    await expect(digitalRateLimitAllows(admin({ data: false, error: null }), {
      scope: "s", value: "v", max: 5, windowMinutes: 10,
    })).resolves.toBe(false);
    await expect(digitalRateLimitAllows(admin({ data: true, error: null }), {
      scope: "s", value: "", max: 5, windowMinutes: 10,
    })).resolves.toBe(false);
  });
});

describe("privata headers", () => {
  it("förbjuder cachning och referrer", () => {
    expect(DIGITAL_PRIVATE_HEADERS["Cache-Control"]).toContain("no-store");
    expect(DIGITAL_PRIVATE_HEADERS["Referrer-Policy"]).toBe("no-referrer");
    expect(DIGITAL_PRIVATE_HEADERS["X-Robots-Tag"]).toContain("noindex");
  });
});
