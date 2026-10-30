import { describe, expect, it } from 'vitest';
import { computeFeedForecast, type FeedEggRow, type FeedPurchase } from '@/lib/feedForecast';

function dailyEggs(fromIso: string, days: number, perDay: number): FeedEggRow[] {
  const rows: FeedEggRow[] = [];
  const start = Date.parse(`${fromIso}T12:00:00Z`);
  for (let i = 0; i < days; i += 1) {
    rows.push({ date: new Date(start + i * 86_400_000).toISOString().slice(0, 10), count: perDay });
  }
  return rows;
}

describe('computeFeedForecast – förbrukning och dagar kvar', () => {
  it('säger ingenting med bara ett inköp', () => {
    const f = computeFeedForecast([{ date: '2026-10-01', amount_kg: 20, cost: 300 }], [], '2026-10-10');
    expect(f.confidence).toBe('none');
    expect(f.daysLeft).toBeNull();
    expect(f.lastPurchaseDate).toBe('2026-10-01');
  });

  it('härleder takten ur inköpsrytmen och räknar ned från senaste inköpet', () => {
    // 20 kg den 1:a och 20 kg den 21:a → 1 kg/dygn. Idag den 31:a → 10 kg kvar.
    const purchases: FeedPurchase[] = [
      { date: '2026-10-01', amount_kg: 20, cost: 300, feed_category: 'layer' },
      { date: '2026-10-21', amount_kg: 20, cost: 300, feed_category: 'layer' },
    ];
    const f = computeFeedForecast(purchases, [], '2026-10-31');
    expect(f.kgPerDay).toBe(1);
    expect(f.kgLeft).toBe(10);
    expect(f.daysLeft).toBe(10);
    expect(f.runOutDate).toBe('2026-11-10');
    expect(f.confidence).toBe('low');
    expect(f.stale).toBe(false);
  });

  it('räknar inte godis, grit eller ostronskal som huvudfoder', () => {
    const purchases: FeedPurchase[] = [
      { date: '2026-10-01', amount_kg: 20, feed_category: 'layer' },
      { date: '2026-10-05', amount_kg: 5, feed_category: 'treats' },
      { date: '2026-10-08', amount_kg: 10, feed_category: 'oyster_shell' },
      { date: '2026-10-21', amount_kg: 20, feed_category: 'layer' },
    ];
    expect(computeFeedForecast(purchases, [], '2026-10-31').kgPerDay).toBe(1);
  });

  it('känner igen tillskott på namnet när fodertyp saknas', () => {
    // Verklig data: "Skalgrus" utan kategori fick fodret att se slut ut.
    const f = computeFeedForecast([
      { date: '2026-10-16', amount_kg: 25, feed_type: 'Hönspellets', feed_category: null },
      { date: '2026-10-29', amount_kg: 2, feed_type: 'Skalgrus', feed_category: null },
    ], [], '2026-10-30');
    expect(f.daysLeft).toBeNull();
    expect(f.confidence).toBe('none');
  });

  it('räknar inte en liten okategoriserad påfyllnad som en ny säck', () => {
    const f = computeFeedForecast([
      { date: '2026-09-01', amount_kg: 20, feed_type: 'Värpfoder' },
      { date: '2026-09-21', amount_kg: 20, feed_type: 'Värpfoder' },
      { date: '2026-09-25', amount_kg: 3, feed_type: 'Extra påse' },
      { date: '2026-10-11', amount_kg: 20, feed_type: 'Värpfoder' },
    ], [], '2026-10-15');
    expect(f.kgPerDay).toBe(1);
    expect(f.daysLeft).toBe(16);
  });

  it('slår ihop inköp samma dag och kräver minst en veckas spann', () => {
    const tooShort = computeFeedForecast([
      { date: '2026-10-01', amount_kg: 20 },
      { date: '2026-10-04', amount_kg: 20 },
    ], [], '2026-10-10');
    expect(tooShort.daysLeft).toBeNull();

    const sameDay = computeFeedForecast([
      { date: '2026-10-01', amount_kg: 10 },
      { date: '2026-10-01', amount_kg: 10 },
      { date: '2026-10-21', amount_kg: 20 },
    ], [], '2026-10-21');
    expect(sameDay.kgPerDay).toBe(1);
    expect(sameDay.daysLeft).toBe(20);
  });

  it('blir säkrare med tre inköp', () => {
    const f = computeFeedForecast([
      { date: '2026-09-01', amount_kg: 15 },
      { date: '2026-09-16', amount_kg: 15 },
      { date: '2026-10-01', amount_kg: 15 },
    ], [], '2026-10-05');
    expect(f.confidence).toBe('ok');
    expect(f.daysLeft).toBe(11);
  });

  it('markerar prognosen som inaktuell när inköpsloggningen uppenbart har slutat', () => {
    const f = computeFeedForecast([
      { date: '2026-01-01', amount_kg: 20 },
      { date: '2026-01-21', amount_kg: 20 },
    ], [], '2026-10-30');
    expect(f.kgLeft).toBe(0);
    expect(f.stale).toBe(true);
  });

  it('ignorerar framtida och ogiltiga datum', () => {
    const f = computeFeedForecast([
      { date: '2026-10-01', amount_kg: 20 },
      { date: '2026-10-21', amount_kg: 20 },
      { date: '2026-12-01', amount_kg: 500 },
      { date: '2026-02-30', amount_kg: 500 },
    ], [], '2026-10-31');
    expect(f.kgPerDay).toBe(1);
  });
});

describe('computeFeedForecast – kostnad per ägg', () => {
  it('använder perioden mellan inköpen när underlaget räcker', () => {
    // 300 kr den 1:a, nästa inköp den 21:a. 20 dagar × 3 ägg = 60 ägg → 5 kr/ägg.
    const purchases: FeedPurchase[] = [
      { date: '2026-10-01', amount_kg: 20, cost: 300 },
      { date: '2026-10-21', amount_kg: 20, cost: 320 },
    ];
    const eggs = dailyEggs('2026-10-01', 30, 3);
    const f = computeFeedForecast(purchases, eggs, '2026-10-30');
    expect(f.costBasis).toBe('between_purchases');
    expect(f.costPeriodEggs).toBe(60);
    expect(f.costPerEgg).toBe(5);
  });

  it('faller tillbaka på hela perioden sedan första inköpet', () => {
    const eggs = dailyEggs('2026-10-01', 10, 3);
    const f = computeFeedForecast([{ date: '2026-10-01', cost: 150 }], eggs, '2026-10-10');
    expect(f.costBasis).toBe('since_first_purchase');
    expect(f.costPerEgg).toBe(5);
  });

  it('räknar inte ägg från före första foderinköpet', () => {
    const eggs = [...dailyEggs('2026-01-01', 200, 3), ...dailyEggs('2026-10-01', 10, 3)];
    const f = computeFeedForecast([{ date: '2026-10-01', cost: 150 }], eggs, '2026-10-10');
    expect(f.costPeriodEggs).toBe(30);
  });

  it('väntar med siffran tills det finns minst 20 ägg', () => {
    const f = computeFeedForecast([{ date: '2026-10-01', cost: 150 }], dailyEggs('2026-10-01', 3, 3), '2026-10-03');
    expect(f.costPerEgg).toBeNull();
  });
});
