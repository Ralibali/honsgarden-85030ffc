import { describe, it, expect } from 'vitest';
import { rankHensByWeek, RACE_DAYS, type HenRaceEgg, type HenRaceHen } from '../henRace';

const NOW = new Date('2026-07-18T12:00:00');

const hens: HenRaceHen[] = [
  { id: 'a', name: 'Blanka' },
  { id: 'b', name: 'Astrid' },
  { id: 'c', name: 'Greta' },
];

const day = (offset: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

describe('rankHensByWeek', () => {
  it('rankar hönor efter ägg senaste 7 dagarna', () => {
    const eggs: HenRaceEgg[] = [
      { hen_id: 'a', date: day(0), count: 1 },
      { hen_id: 'a', date: day(2), count: 1 },
      { hen_id: 'b', date: day(1), count: 3 },
      { hen_id: 'c', date: day(3), count: 1 },
    ];
    const race = rankHensByWeek(eggs, hens, NOW);
    expect(race.map((r) => r.henId)).toEqual(['b', 'a', 'c']);
    expect(race[0]).toMatchObject({ name: 'Astrid', weekEggs: 3 });
  });

  it(`ignorerar ägg äldre än ${RACE_DAYS} dagar`, () => {
    const eggs: HenRaceEgg[] = [
      { hen_id: 'a', date: day(RACE_DAYS), count: 10 }, // precis utanför fönstret
      { hen_id: 'b', date: day(RACE_DAYS - 1), count: 2 }, // precis innanför
    ];
    const race = rankHensByWeek(eggs, hens, NOW);
    expect(race).toHaveLength(1);
    expect(race[0].henId).toBe('b');
  });

  it('hoppar över ägg utan höna och hönor utan ägg', () => {
    const eggs: HenRaceEgg[] = [
      { hen_id: null, date: day(0), count: 5 },
      { hen_id: 'a', date: day(0), count: 2 },
    ];
    const race = rankHensByWeek(eggs, hens, NOW);
    expect(race).toHaveLength(1);
    expect(race[0].henId).toBe('a');
  });

  it('bryter lika med svensk namnsortering', () => {
    const eggs: HenRaceEgg[] = [
      { hen_id: 'a', date: day(0), count: 2 }, // Blanka
      { hen_id: 'b', date: day(0), count: 2 }, // Astrid
    ];
    const race = rankHensByWeek(eggs, hens, NOW);
    expect(race.map((r) => r.name)).toEqual(['Astrid', 'Blanka']);
  });

  it('ger tom lista utan ägg eller hönor', () => {
    expect(rankHensByWeek([], hens, NOW)).toEqual([]);
    expect(rankHensByWeek([{ hen_id: 'a', date: day(0), count: 1 }], [], NOW)).toEqual([]);
  });
});
