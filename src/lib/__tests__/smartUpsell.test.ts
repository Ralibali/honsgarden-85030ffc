import { describe, it, expect } from 'vitest';
import {
  pickUpsell,
  isUpsellAllowed,
  evaluateUpsell,
  assignVariant,
  COOLDOWN_AFTER_SHOWN_DAYS,
  COOLDOWN_AFTER_DISMISS_DAYS,
} from '../smartUpsell';

const free = { isPremium: false };
const now = new Date('2026-07-17T12:00:00Z');
const daysAgo = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000).toISOString();

describe('pickUpsell – trigger-prioritet', () => {
  it('visar inget för premium-användare', () => {
    expect(pickUpsell({ streak: 30, totalEggs: 500, henCount: 5, isPremium: true })).toBeNull();
  });

  it('lång streak (≥7) ger streak-budskap', () => {
    const m = pickUpsell({ streak: 10, totalEggs: 200, henCount: 5, ...free });
    expect(m?.trigger).toBe('streak_momentum');
    expect(m?.title).toContain('10 dagar');
  });

  it('100+ ägg ger data_gold när streaken är kort', () => {
    const m = pickUpsell({ streak: 1, totalEggs: 132, henCount: 5, ...free });
    expect(m?.trigger).toBe('data_gold');
    expect(m?.title).toContain('132');
  });

  it('streak 3–6 ger habit-budskap', () => {
    const m = pickUpsell({ streak: 4, totalEggs: 20, henCount: 2, ...free });
    expect(m?.trigger).toBe('habit_forming');
  });

  it('30+ ägg med hönor ger kostnad-per-ägg-budskap', () => {
    const m = pickUpsell({ streak: 0, totalEggs: 45, henCount: 3, ...free });
    expect(m?.trigger).toBe('cost_per_egg');
    expect(m?.body).toContain('3 hönor');
  });

  it('ingen trigger för helt ny användare', () => {
    expect(pickUpsell({ streak: 0, totalEggs: 5, henCount: 0, ...free })).toBeNull();
  });
});

describe('isUpsellAllowed – frekvensspärr', () => {
  it('tillåter visning för förstagångsanvändare', () => {
    expect(isUpsellAllowed({ lastShownAt: null, dismissedAt: null }, now)).toBe(true);
  });

  it('blockerar om kortet visats för nyligen', () => {
    const state = { lastShownAt: daysAgo(COOLDOWN_AFTER_SHOWN_DAYS - 1), dismissedAt: null };
    expect(isUpsellAllowed(state, now)).toBe(false);
  });

  it('tillåter igen efter visnings-cooldown', () => {
    const state = { lastShownAt: daysAgo(COOLDOWN_AFTER_SHOWN_DAYS + 1), dismissedAt: null };
    expect(isUpsellAllowed(state, now)).toBe(true);
  });

  it('respekterar längre cooldown efter stängning', () => {
    const state = { lastShownAt: daysAgo(10), dismissedAt: daysAgo(COOLDOWN_AFTER_DISMISS_DAYS - 2) };
    expect(isUpsellAllowed(state, now)).toBe(false);
    const okState = { lastShownAt: daysAgo(10), dismissedAt: daysAgo(COOLDOWN_AFTER_DISMISS_DAYS + 1) };
    expect(isUpsellAllowed(okState, now)).toBe(true);
  });
});

describe('assignVariant – A/B-tilldelning', () => {
  it('är deterministisk per användare + trigger', () => {
    const v1 = assignVariant('user-abc', 'streak_momentum');
    expect(assignVariant('user-abc', 'streak_momentum')).toBe(v1);
  });

  it('kan skilja mellan triggers för samma användare', () => {
    const variants = ['streak_momentum', 'data_gold', 'habit_forming', 'cost_per_egg']
      .map((t) => assignVariant('user-abc', t));
    // alla är giltiga varianter
    variants.forEach((v) => expect(['A', 'B']).toContain(v));
  });

  it('fördelar ungefär jämnt över många användare', () => {
    let a = 0;
    for (let i = 0; i < 200; i++) {
      if (assignVariant(`user-${i}`, 'streak_momentum') === 'A') a++;
    }
    expect(a).toBeGreaterThan(70);
    expect(a).toBeLessThan(130);
  });

  it('ger A utan användar-id (säker standard)', () => {
    expect(assignVariant(undefined, 'data_gold')).toBe('A');
  });

  it('pickUpsell respekterar tilldelad variant och ger olika copy', () => {
    const signals = { streak: 10, totalEggs: 200, henCount: 5, isPremium: false };
    // hitta en användare per variant
    let userA = '', userB = '';
    for (let i = 0; i < 200 && (!userA || !userB); i++) {
      const v = assignVariant(`u${i}`, 'streak_momentum');
      if (v === 'A' && !userA) userA = `u${i}`;
      if (v === 'B' && !userB) userB = `u${i}`;
    }
    const mA = pickUpsell(signals, userA);
    const mB = pickUpsell(signals, userB);
    expect(mA?.variant).toBe('A');
    expect(mB?.variant).toBe('B');
    expect(mA?.body).not.toBe(mB?.body);
  });
});

describe('evaluateUpsell – helheten', () => {
  it('ger budskap när trigger + spärr tillåter', () => {
    const m = evaluateUpsell(
      { streak: 8, totalEggs: 50, henCount: 4, ...free },
      { lastShownAt: null, dismissedAt: null },
      now,
    );
    expect(m?.trigger).toBe('streak_momentum');
  });

  it('ger null när spärren är aktiv trots trigger', () => {
    const m = evaluateUpsell(
      { streak: 8, totalEggs: 50, henCount: 4, ...free },
      { lastShownAt: daysAgo(1), dismissedAt: null },
      now,
    );
    expect(m).toBeNull();
  });
});
