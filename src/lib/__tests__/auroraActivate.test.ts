// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import {
  computeAuroraActivateState,
  isAuroraDismissed,
  setAuroraDismissed,
  claimAuroraViewed,
  claimAuroraStepCompleted,
  claimAuroraCompleted,
} from '../auroraActivate';

const empty = { flocksCount: 0, hensCount: 0, eggsCount: 0, feedRecordsCount: 0 };

beforeEach(() => window.localStorage.clear());

describe('Aurora Activate: onboardingstatus från verklig data', () => {
  it('visar fem kvarvarande steg på tomt konto', () => {
    expect(computeAuroraActivateState(empty)).toMatchObject({
      doneCount: 0, totalSteps: 5, progress: 0, allDone: false, nextStepKey: 'flock',
    });
  });

  it('räknar första flock, höna och ägg utan att räkna ett besök som klart', () => {
    const s = computeAuroraActivateState({ flocksCount: 1, hensCount: 1, eggsCount: 1, feedRecordsCount: 0 });
    expect(s.doneCount).toBe(3);
    expect(s.progress).toBe(60);
    expect(s.nextStepKey).toBe('feed');
    expect(s.steps.find((step) => step.key === 'insights')?.done).toBe(false);
  });

  it('skiljer tidiga registreringar från tillräcklig data för insikter', () => {
    expect(computeAuroraActivateState({ ...empty, eggsCount: 6 }).steps.at(-1)?.done).toBe(false);
    expect(computeAuroraActivateState({ ...empty, eggsCount: 7 }).steps.at(-1)?.done).toBe(true);
  });

  it('hanterar helt slutförd introduktion', () => {
    const s = computeAuroraActivateState({ flocksCount: 1, hensCount: 2, eggsCount: 7, feedRecordsCount: 1 });
    expect(s).toMatchObject({ doneCount: 5, progress: 100, allDone: true, nextStepKey: null });
  });
});

describe('Aurora Activate: personlig dismiss och deduplicering', () => {
  it('kan döljas och återöppnas per inloggad användare', () => {
    setAuroraDismissed('user-a', true);
    expect(isAuroraDismissed('user-a')).toBe(true);
    expect(isAuroraDismissed('user-b')).toBe(false);
    setAuroraDismissed('user-a', false);
    expect(isAuroraDismissed('user-a')).toBe(false);
  });

  it('spårar guiden en gång per användare', () => {
    expect(claimAuroraViewed('user-a')).toBe(true);
    expect(claimAuroraViewed('user-a')).toBe(false);
    expect(claimAuroraViewed('user-b')).toBe(true);
  });

  it('spårar varje faktiskt slutfört steg bara en gång', () => {
    expect(claimAuroraStepCompleted('user-a', 'flock')).toBe(true);
    expect(claimAuroraStepCompleted('user-a', 'flock')).toBe(false);
    expect(claimAuroraStepCompleted('user-a', 'egg')).toBe(true);
  });

  it('spårar slutförandet en gång och ignorerar gästanvändare', () => {
    expect(claimAuroraCompleted(null)).toBe(false);
    expect(claimAuroraCompleted('user-a')).toBe(true);
    expect(claimAuroraCompleted('user-a')).toBe(false);
  });
});
