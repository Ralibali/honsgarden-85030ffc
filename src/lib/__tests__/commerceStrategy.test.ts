import { describe, expect, it } from 'vitest';
import {
  START_COST_REFERENCE,
  calculateStartCost,
  estimateBagDurationDays,
  estimateFeedUse,
  seasonalCommerceSignals,
} from '@/lib/commerceStrategy';

describe('commerceStrategy', () => {
  it('uses the research season windows without making them hard filters', () => {
    const march = seasonalCommerceSignals(3);
    expect(march.some((signal) => signal.categories.includes('klackning'))).toBe(true);
    expect(march.some((signal) => signal.categories.includes('hus'))).toBe(true);

    const october = seasonalCommerceSignals(10);
    expect(october.some((signal) => signal.categories.includes('vaerme'))).toBe(true);
    expect(october.some((signal) => signal.categories.includes('vatten'))).toBe(true);
  });

  it('estimates feed from 100-150 g per hen/day', () => {
    expect(estimateFeedUse(5, 30, false)).toEqual({
      minKg: 15,
      maxKg: 22.5,
      days: 30,
      henCount: 5,
    });
  });

  it('adds the research winter planning uplift', () => {
    const estimate = estimateFeedUse(5, 30, true);
    expect(estimate.minKg).toBe(16.5);
    expect(estimate.maxKg).toBe(27);
  });

  it('estimates a 20 kg bag duration for five hens', () => {
    expect(estimateBagDurationDays(5, 20)).toEqual({
      minDays: 26,
      maxDays: 40,
    });
  });

  it('calculates a transparent start cost and compares with the research range', () => {
    const result = calculateStartCost({
      hens: 4,
      henPriceSek: 200,
      housingSek: 2650,
      fencingSek: 700,
      equipmentSek: 540,
      firstFeedAndBeddingSek: 200,
      otherSek: 0,
    });

    expect(result.animalCost).toBe(800);
    expect(result.total).toBe(4890);
    expect(result.insideResearchRange).toBe(true);
    expect(START_COST_REFERENCE.startMaxSek).toBe(16400);
  });
});
