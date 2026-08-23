export const ONBOARDING_CHECKLIST_DISMISS_PREFIX = 'honsgarden-onboarding-checklist-dismissed';

export function onboardingChecklistDismissKey(userId: string): string {
  return `${ONBOARDING_CHECKLIST_DISMISS_PREFIX}-${userId}`;
}

export function isOnboardingChecklistDismissed(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(onboardingChecklistDismissKey(userId)) === '1';
  } catch {
    return false;
  }
}

/**
 * Auto-shown PWA / "install the app" prompts must wait until the first
 * activation steps are done. Otherwise the modal steals taps from the
 * onboarding CTA on mobile.
 *
 * Hide while: hens query is not ready, first hen is missing, or the
 * dashboard checklist is still the active next step (no eggs yet).
 */
export function shouldAutoShowPwaInstallPrompt({
  hensReady,
  hensCount,
  eggsCount = 0,
  checklistDismissed = false,
}: {
  hensReady: boolean;
  hensCount: number;
  eggsCount?: number;
  checklistDismissed?: boolean;
}): boolean {
  if (!hensReady) return false;
  if (hensCount <= 0) return false;
  if (!checklistDismissed && eggsCount <= 0) return false;
  return true;
}
