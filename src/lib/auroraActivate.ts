/**
 * Aurora Activate v1 — isolerad steg/status-logik för förstaveckorsresan.
 *
 * Ren logik, inga React-beroenden: lätt att testa. Används av
 * src/components/dashboard/OnboardingChecklistCard.tsx.
 *
 * Regler:
 * - Status bygger ENBART på faktisk data (flockar, hönor, ägg, foderköp).
 *   Besök av statistik eller insikter räknas aldrig som slutförd prestation.
 * - Dismiss/öppna är per användare (användar-id i nyckeln).
 * - Analytics dedupliceras per användare och steg via localStorage-flaggor.
 */

export type AuroraStepKey = 'flock' | 'hens' | 'egg' | 'feed' | 'insights';

export interface AuroraActivateInput {
  flocksCount: number;
  hensCount: number;
  eggsCount: number;
  feedRecordsCount: number;
}

export interface AuroraStepStatus {
  key: AuroraStepKey;
  done: boolean;
}

export interface AuroraActivateState {
  steps: AuroraStepStatus[];
  doneCount: number;
  totalSteps: number;
  progress: number;
  allDone: boolean;
  nextStepKey: AuroraStepKey | null;
}

/** Beräkna checklistans status från faktisk användardata. */
export function computeAuroraActivateState(input: AuroraActivateInput): AuroraActivateState {
  const steps: AuroraStepStatus[] = [
    { key: 'flock', done: input.flocksCount > 0 },
    { key: 'hens', done: input.hensCount > 0 },
    { key: 'egg', done: input.eggsCount > 0 },
    { key: 'feed', done: input.feedRecordsCount > 0 },
    // "Insikter" kräver en veckas faktiska äggloggar — inget klick räknas.
    { key: 'insights', done: input.eggsCount >= 7 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const totalSteps = steps.length;
  return {
    steps,
    doneCount,
    totalSteps,
    progress: Math.round((doneCount / totalSteps) * 100),
    allDone: doneCount === totalSteps,
    nextStepKey: steps.find((s) => !s.done)?.key ?? null,
  };
}

/* -------- per-användare-dismiss (samma nyckelschema som tidigare) -------- */

const DISMISS_PREFIX = 'honsgarden-onboarding-checklist-dismissed';

export function auroraDismissKey(userId: string): string {
  return `${DISMISS_PREFIX}-${userId}`;
}

export function isAuroraDismissed(userId: string | null | undefined): boolean {
  if (!userId) return false;
  try {
    return localStorage.getItem(auroraDismissKey(userId)) === '1';
  } catch {
    return false;
  }
}

export function setAuroraDismissed(userId: string | null | undefined, dismissed: boolean): void {
  if (!userId) return;
  try {
    if (dismissed) localStorage.setItem(auroraDismissKey(userId), '1');
    else localStorage.removeItem(auroraDismissKey(userId));
  } catch {
    /* privat läge / kvot */
  }
}

/* -------- analytics-dedup per användare och steg -------- */

const VIEWED_PREFIX = 'honsgarden-aurora-viewed';
const STEP_PREFIX = 'honsgarden-aurora-step-done';
const COMPLETED_PREFIX = 'honsgarden-aurora-completed';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, '1');
  } catch {
    /* privat läge / kvot */
  }
}

/** True första gången guiden visas för användaren — markeras som sedd. */
export function claimAuroraViewed(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const key = `${VIEWED_PREFIX}-${userId}`;
  if (readFlag(key)) return false;
  writeFlag(key);
  return true;
}

/** True första gången ett steg observeras som färdigt för användaren. */
export function claimAuroraStepCompleted(userId: string | null | undefined, step: AuroraStepKey): boolean {
  if (!userId) return false;
  const key = `${STEP_PREFIX}-${userId}-${step}`;
  if (readFlag(key)) return false;
  writeFlag(key);
  return true;
}

/** True första gången hela resan observeras klar för användaren. */
export function claimAuroraCompleted(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const key = `${COMPLETED_PREFIX}-${userId}`;
  if (readFlag(key)) return false;
  writeFlag(key);
  return true;
}
