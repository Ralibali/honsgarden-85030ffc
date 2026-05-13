import { describe, it, expect } from "vitest";
import { toCsv, toSwedishCsv, CSV_BOM } from "../csvExport";

describe("toCsv (matchar MyDataSection)", () => {
  it("börjar med UTF-8 BOM", () => {
    const csv = toCsv([{ a: 1 }]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.startsWith(CSV_BOM)).toBe(true);
  });

  it("använder semikolon som separator, inte komma", () => {
    const csv = toCsv([{ namn: "Höna", ras: "Skånsk" }]);
    const dataLine = csv.split("\n").slice(1)[0];
    expect(dataLine).toContain(";");
    expect(dataLine).not.toMatch(/Höna,Skånsk/);
  });

  it("bevarar svenska tecken (åäö) i namn", () => {
    const csv = toCsv([{ namn: "Höna Åke" }, { namn: "Räven" }, { namn: "Sköldpaddan" }]);
    expect(csv).toContain("Höna Åke");
    expect(csv).toContain("Räven");
    expect(csv).toContain("Sköldpaddan");
  });

  it("null/undefined blir tomma fält, inte 'null'/'undefined'", () => {
    const csv = toCsv([{ a: null, b: undefined, c: "x" }]);
    const [, line] = csv.split("\n");
    expect(line).toBe(";;x");
    expect(csv).not.toContain("null");
    expect(csv).not.toContain("undefined");
  });

  it("citerar fält med semikolon i texten", () => {
    const csv = toCsv([{ note: "Frisk; lägger bra" }]);
    expect(csv).toContain('"Frisk; lägger bra"');
  });

  it("escapar dubbla citationstecken", () => {
    const csv = toCsv([{ note: 'Han sa "hej"' }]);
    expect(csv).toContain('"Han sa ""hej"""');
  });
});

describe("toSwedishCsv (rapporter)", () => {
  it("använder svenska headers från headerMap", () => {
    const csv = toSwedishCsv(
      [{ name: "Agda", breed: "Skånsk", birth_date: "2024-03-01" }],
      { name: "Namn", breed: "Ras", birth_date: "Födelsedatum" }
    );
    const headerLine = csv.replace(CSV_BOM, "").split("\n")[0];
    expect(headerLine).toBe("Namn;Ras;Födelsedatum");
  });

  it("formaterar numeriska värden med decimalkomma", () => {
    const csv = toSwedishCsv([{ vikt: 12.5 }], { vikt: "Vikt (kg)" });
    expect(csv).toContain("12,5");
    expect(csv).not.toContain("12.5");
  });

  it("Date-objekt blir YYYY-MM-DD", () => {
    const d = new Date("2026-05-13T10:00:00Z");
    const csv = toSwedishCsv([{ d }], { d: "Datum" });
    expect(csv).toContain("2026-05-13");
  });

  it("null blir tomt fält", () => {
    const csv = toSwedishCsv([{ a: null, b: 1 }], { a: "A", b: "B" });
    const dataLine = csv.replace(CSV_BOM, "").split("\n")[1];
    expect(dataLine).toBe(";1");
  });

  it("citerar semikolon i text korrekt", () => {
    const csv = toSwedishCsv([{ note: "Frisk; lägger bra" }], { note: "Anteckning" });
    expect(csv).toContain('"Frisk; lägger bra"');
  });
});
