/**
 * Minimal händelsebuss för utmärkelse-firanden.
 * Belöningslogiken (useAchievementRewards) skickar; overlayen lyssnar.
 */

export interface UnlockCelebration {
  id: string;
  emoji: string;
  title: string;
  description: string;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
  /** Antal premiumdagar som krediterades. 0 = taket nått (fira ändå, utan pill). */
  premiumDays: number;
}

type Listener = (celebration: UnlockCelebration) => void;

const listeners = new Set<Listener>();

export function onUnlockCelebration(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitUnlockCelebration(celebration: UnlockCelebration) {
  listeners.forEach((listener) => listener(celebration));
}
