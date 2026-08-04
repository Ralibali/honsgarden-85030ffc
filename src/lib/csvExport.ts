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

/**
 * Svenska header-mappningar per kategori.
 * UUID-fält (hen_id, inventory_item_id m.fl.) får svenska header-namn
 * men värdet förblir UUID — användare korsrefererar mot Hönor-CSV:n.
 */
export const SWEDISH_HEADER_MAPS: Record<string, Record<string, string>> = {
  hens: {
    id: "ID",
    name: "Namn",
    breed: "Ras",
    birth_date: "Födelsedatum",
    hen_type: "Typ",
    status: "Status",
    notes: "Anteckningar",
    death_date: "Dödsdatum",
    death_cause: "Dödsorsak",
    bloodline: "Blodslinje",
    created_at: "Skapad",
  },
  egg_logs: {
    id: "ID",
    hen_id: "Höna",
    logged_date: "Datum",
    count: "Antal",
    notes: "Anteckningar",
    created_at: "Skapad",
  },
  health_events: {
    id: "ID",
    hen_id: "Höna",
    event_date: "Datum",
    event_type: "Typ",
    title: "Titel",
    description: "Beskrivning",
    treatment: "Behandling",
    resolved: "Löst",
    resolved_at: "Löst datum",
  },
  feed_records: {
    id: "ID",
    date: "Datum",
    feed_type: "Fodertyp",
    amount_kg: "Mängd (kg)",
    cost: "Kostnad (kr)",
    notes: "Anteckningar",
    created_at: "Skapad",
  },
  transactions: {
    id: "ID",
    date: "Datum",
    type: "Typ",
    category: "Kategori",
    amount: "Belopp (kr)",
    description: "Beskrivning",
    created_at: "Skapad",
  },
  breeding_pairs: {
    id: "ID",
    name: "Namn",
    rooster_id: "Tupp",
    hen_ids: "Hönor",
    start_date: "Startdatum",
    end_date: "Slutdatum",
    goal: "Mål",
    notes: "Anteckningar",
  },
  hatch_sessions: {
    id: "ID",
    name: "Namn",
    set_date: "Insättningsdatum",
    expected_hatch_date: "Förväntad kläckning",
    actual_hatch_date: "Verklig kläckning",
    eggs_set: "Ägg insatta",
    eggs_fertile: "Befruktade",
    eggs_hatched: "Kläckta",
    chicks_survived_7d: "Överlevde 7 dagar",
    status: "Status",
    notes: "Anteckningar",
  },
  inventory_items: {
    id: "ID",
    category: "Kategori",
    name: "Namn",
    unit: "Enhet",
    current_quantity: "Saldo",
    low_threshold: "Lågnivå",
    notes: "Anteckningar",
  },
  inventory_transactions: {
    id: "ID",
    inventory_item_id: "Lagervara",
    transaction_type: "Typ",
    quantity: "Antal",
    cost: "Kostnad",
    transaction_date: "Datum",
    notes: "Anteckningar",
  },
};

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
