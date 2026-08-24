import { describe, it, expect } from 'vitest';
import {
  salesForYear, availableYears, buildJournalRows, summarizeJournal,
  journalCsvRows, journalPdfRows, JOURNAL_PDF_HEADERS,
} from '../salesJournal';
import type { EggSale } from '../localProductState';

const sale = (over: Partial<EggSale>): EggSale => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  customer: over.customer ?? 'Kund',
  eggs: over.eggs ?? 10,
  amount: over.amount ?? 50,
  paid: over.paid ?? true,
  date: over.date ?? '2026-03-15',
  note: over.note,
});

const SALES: EggSale[] = [
  sale({ id: '1', customer: 'Anna Andersson', eggs: 30, amount: 150, date: '2026-03-20' }),
  sale({ id: '2', customer: 'Bengt Berg', eggs: 20, amount: 100, date: '2026-01-10', paid: false, note: 'Swish senare' }),
  sale({ id: '3', customer: 'Anna Andersson', eggs: 12, amount: 60, date: '2026-01-05' }),
  sale({ id: '4', customer: 'Gamla året', eggs: 6, amount: 30, date: '2025-12-20' }),
];

describe('salesJournal – salesForYear', () => {
  it('filtrerar på år och sorterar kronologiskt', () => {
    const rows = salesForYear(SALES, 2026);
    expect(rows.map((s) => s.id)).toEqual(['3', '2', '1']);
  });
  it('returnerar tomt för år utan data', () => {
    expect(salesForYear(SALES, 2024)).toEqual([]);
  });
});

describe('salesJournal – availableYears', () => {
  it('ger unika år fallande', () => {
    expect(availableYears(SALES)).toEqual([2026, 2025]);
  });
  it('tål trasiga datum', () => {
    expect(availableYears([sale({ date: '' }), sale({ date: '2026-01-01' })])).toEqual([2026]);
  });
});

describe('salesJournal – buildJournalRows', () => {
  it('mappar till journalfält (datum, köpare, antal) kronologiskt', () => {
    const rows = buildJournalRows(SALES);
    expect(rows[0]).toMatchObject({ datum: '2025-12-20', kopare: 'Gamla året', antalAgg: 6 });
    expect(rows[rows.length - 1]).toMatchObject({ datum: '2026-03-20', kopare: 'Anna Andersson', antalAgg: 30 });
  });
  it('saknad anteckning blir tom sträng', () => {
    const rows = buildJournalRows([sale({ note: undefined })]);
    expect(rows[0].anteckning).toBe('');
  });
});

describe('salesJournal – summarizeJournal', () => {
  const rows = buildJournalRows(salesForYear(SALES, 2026));
  const s = summarizeJournal(rows);

  it('summerar totalt antal ägg och belopp', () => {
    expect(s.totalEggs).toBe(62);
    expect(s.totalAmount).toBe(310);
    expect(s.saleCount).toBe(3);
  });

  it('räknar unika köpare case-insensitivt', () => {
    expect(s.uniqueCustomers).toBe(2);
  });

  it('grupperar per månad kronologiskt', () => {
    expect(s.byMonth.map((m) => m.month)).toEqual(['2026-01', '2026-03']);
    expect(s.byMonth[0]).toMatchObject({ eggs: 32, amount: 160, sales: 2 });
  });
});

describe('salesJournal – exportformat', () => {
  const rows = buildJournalRows(salesForYear(SALES, 2026));

  it('CSV-rader har svenska rubriker och journalkolumnerna', () => {
    const csv = journalCsvRows(rows);
    expect(Object.keys(csv[0])).toEqual(['Datum', 'Köpare', 'Antal ägg', 'Belopp (kr)', 'Betald', 'Anteckning']);
    expect(csv[1]['Betald']).toBe('Nej');
    expect(csv[1]['Anteckning']).toBe('Swish senare');
  });

  it('PDF-rader matchar rubrikerna i antal', () => {
    const pdf = journalPdfRows(rows);
    expect(pdf.every((r) => r.length === JOURNAL_PDF_HEADERS.length)).toBe(true);
    expect(pdf[0][0]).toBe('2026-01-05');
  });
});
