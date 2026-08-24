/**
 * Försäljningsjournal – ren logik för att bygga äggförsäljningsjournalen.
 *
 * Salmonellakontrollen (SJVFS 2007:19, 14 §) kräver att anläggningar med
 * värphöns för yrkesmässig äggproduktion löpande för journal över alla
 * äggförsäljningar med datum, antal och köpare. Den här modulen omvandlar
 * användarens registrerade försäljningar till just det formatet – kronologiskt,
 * summerbart och exporterbart.
 */

import type { EggSale } from './localProductState';

export interface JournalRow {
  /** ISO-datum (YYYY-MM-DD) */
  datum: string;
  kopare: string;
  antalAgg: number;
  beloppKr: number;
  betald: boolean;
  anteckning: string;
}

export interface JournalSummary {
  totalEggs: number;
  totalAmount: number;
  saleCount: number;
  uniqueCustomers: number;
  /** Summering per månad, kronologiskt: { month: '2026-03', eggs, amount, sales } */
  byMonth: { month: string; eggs: number; amount: number; sales: number }[];
}

/** Försäljningar för ett givet kalenderår, kronologiskt sorterade */
export function salesForYear(sales: EggSale[], year: number): EggSale[] {
  const prefix = `${year}-`;
  return sales
    .filter((s) => typeof s.date === 'string' && s.date.startsWith(prefix))
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Alla år som finns i datat, fallande (senaste först) */
export function availableYears(sales: EggSale[]): number[] {
  const years = new Set<number>();
  for (const s of sales) {
    const y = Number(String(s.date || '').slice(0, 4));
    if (Number.isFinite(y) && y > 2000) years.add(y);
  }
  return Array.from(years).sort((a, b) => b - a);
}

/** Omvandla försäljningar till journalrader (kronologiskt) */
export function buildJournalRows(sales: EggSale[]): JournalRow[] {
  return sales
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .map((s) => ({
      datum: s.date,
      kopare: s.customer,
      antalAgg: s.eggs,
      beloppKr: s.amount,
      betald: s.paid,
      anteckning: s.note || '',
    }));
}

export function summarizeJournal(rows: JournalRow[]): JournalSummary {
  const byMonthMap = new Map<string, { eggs: number; amount: number; sales: number }>();
  let totalEggs = 0;
  let totalAmount = 0;
  const customers = new Set<string>();

  for (const r of rows) {
    totalEggs += r.antalAgg;
    totalAmount += r.beloppKr;
    customers.add(r.kopare.trim().toLowerCase());
    const month = r.datum.slice(0, 7);
    const entry = byMonthMap.get(month) || { eggs: 0, amount: 0, sales: 0 };
    entry.eggs += r.antalAgg;
    entry.amount += r.beloppKr;
    entry.sales += 1;
    byMonthMap.set(month, entry);
  }

  const byMonth = Array.from(byMonthMap.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => (a.month < b.month ? -1 : 1));

  return {
    totalEggs,
    totalAmount,
    saleCount: rows.length,
    uniqueCustomers: customers.size,
    byMonth,
  };
}

/** Rader anpassade för exportUtils.downloadCSV (semikolon-separerad svensk CSV) */
export function journalCsvRows(rows: JournalRow[]): Record<string, unknown>[] {
  return rows.map((r) => ({
    Datum: r.datum,
    'Köpare': r.kopare,
    'Antal ägg': r.antalAgg,
    'Belopp (kr)': r.beloppKr,
    Betald: r.betald ? 'Ja' : 'Nej',
    Anteckning: r.anteckning,
  }));
}

export const JOURNAL_PDF_HEADERS = ['Datum', 'Köpare', 'Antal ägg', 'Belopp (kr)', 'Betald', 'Anteckning'];

/** Rader anpassade för exportUtils.downloadPDF */
export function journalPdfRows(rows: JournalRow[]): string[][] {
  return rows.map((r) => [
    r.datum,
    r.kopare,
    String(r.antalAgg),
    `${r.beloppKr} kr`,
    r.betald ? 'Ja' : 'Nej',
    r.anteckning,
  ]);
}
