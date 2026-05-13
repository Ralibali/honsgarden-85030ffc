/**
 * CSV-export helpers — pure (no DOM, no Blob), så de kan testas i Node.
 *
 * Implementationen matchar `downloadCsv` i src/components/settings/MyDataSection.tsx:
 * - UTF-8 BOM (\uFEFF) i början
 * - semikolon som separator
 * - Papa.unparse-baserad escape (quoting vid ; eller " eller \n)
 * - headers tas från första radens nycklar
 * - null/undefined -> tom sträng
 *
 * `toSwedishCsv()` är ett opt-in-läge för rapporter där svenska headers
 * + decimalkomma + ISO-datum krävs.
 */
import Papa from "papaparse";

export const CSV_BOM = "\uFEFF";

/** Råexport — matchar nuvarande beteende i MyDataSection. */
export function toCsv(rows: Array<Record<string, unknown>>): string {
  const body = Papa.unparse(rows ?? [], { delimiter: ";", header: true });
  return CSV_BOM + body;
}

function formatValue(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    // Svensk decimalkomma
    return String(v).replace(".", ",");
  }
  if (v instanceof Date) {
    // ISO YYYY-MM-DD
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "string") {
    // Bevara ISO-datum oförändrat
    return v;
  }
  if (typeof v === "boolean") return v ? "ja" : "nej";
  return String(v);
}

/**
 * Svensk lokaliserad CSV: ger användaren mappa till svenska headers,
 * formaterar tal med decimalkomma, datumobjekt till YYYY-MM-DD.
 *
 * @param rows raw data
 * @param headerMap key -> svenskt visningsnamn (i önskad kolumnordning)
 */
export function toSwedishCsv(
  rows: Array<Record<string, unknown>>,
  headerMap: Record<string, string>
): string {
  const keys = Object.keys(headerMap);
  const headers = keys.map((k) => headerMap[k]);
  const dataRows = (rows ?? []).map((row) =>
    keys.reduce<Record<string, string>>((acc, k, i) => {
      acc[headers[i]] = formatValue(row[k]);
      return acc;
    }, {})
  );
  const body = Papa.unparse(dataRows, {
    delimiter: ";",
    header: true,
    columns: headers,
  });
  return CSV_BOM + body;
}
