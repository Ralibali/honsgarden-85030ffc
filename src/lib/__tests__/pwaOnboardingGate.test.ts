import { describe, it, expect, beforeEach } from 'vitest';
import {
  isOnboardingChecklistDismissed,
  onboardingChecklistDismissKey,
  shouldAutoShowPwaInstallPrompt,
} from '@/lib/pwaOnboardingGate';

describe('shouldAutoShowPwaInstallPrompt', () => {
  it('väntar tills hönsdatan är laddad', () => {
    expect(
      shouldAutoShowPwaInstallPrompt({
        hensReady: false,
        hensCount: 0,
      }),
    ).toBe(false);
  });

  it('visas inte innan första hönan är tillagd', () => {
    expect(
      shouldAutoShowPwaInstallPrompt({
        hensReady: true,
        hensCount: 0,
        eggsCount: 0,
        checklistDismissed: false,
      }),
    ).toBe(false);
  });

  it('visas inte medan onboarding-checklistan fortfarande är aktiv (inga ägg)', () => {
    expect(
      shouldAutoShowPwaInstallPrompt({
        hensReady: true,
        hensCount: 1,
        eggsCount: 0,
        checklistDismissed: false,
      }),
    ).toBe(false);
  });

  it('får visas efter första meningsfulla aktiveringen', () => {
    expect(
      shouldAutoShowPwaInstallPrompt({
        hensReady: true,
        hensCount: 1,
        eggsCount: 2,
        checklistDismissed: false,
      }),
    ).toBe(true);
  });

  it('får visas om checklistan stängts och minst en höna finns', () => {
    expect(
      shouldAutoShowPwaInstallPrompt({
        hensReady: true,
        hensCount: 2,
        eggsCount: 0,
        checklistDismissed: true,
      }),
    ).toBe(true);
  });
});

describe('isOnboardingChecklistDismissed', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('läser samma nyckel som OnboardingChecklistCard', () => {
    expect(isOnboardingChecklistDismissed('user-1')).toBe(false);
    localStorage.setItem(onboardingChecklistDismissKey('user-1'), '1');
    expect(isOnboardingChecklistDismissed('user-1')).toBe(true);
  });
});
