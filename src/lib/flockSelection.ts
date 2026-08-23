import { readScoped, writeScoped } from '@/lib/userScopedStorage';

export const DEFAULT_FLOCK_NAME = 'Min flock';
export const ACTIVE_FLOCK_STORAGE_KEY = 'active-flock-id';

export type FlockRef = {
  id: string;
  name: string;
};

/**
 * Pick which flock a newly created hen should join.
 *
 * Priority: explicit form value → remembered/onboarding flock → an existing
 * named flock → any existing flock. Returns null only when there are no
 * flocks yet (caller may then create the default "Min flock").
 */
export function resolveFlockIdForHenCreate({
  explicitFlockId,
  preferredFlockId,
  flocks,
}: {
  explicitFlockId?: string | null;
  preferredFlockId?: string | null;
  flocks: FlockRef[];
}): string | null {
  if (explicitFlockId && flocks.some((flock) => flock.id === explicitFlockId)) {
    return explicitFlockId;
  }
  if (preferredFlockId && flocks.some((flock) => flock.id === preferredFlockId)) {
    return preferredFlockId;
  }
  if (flocks.length === 0) return null;

  const named = flocks.filter((flock) => flock.name !== DEFAULT_FLOCK_NAME);
  const pool = named.length > 0 ? named : flocks;
  return pool[0]?.id ?? null;
}

export function readActiveFlockId(userId: string | null | undefined): string | null {
  return readScoped(userId, ACTIVE_FLOCK_STORAGE_KEY, false);
}

export function writeActiveFlockId(userId: string | null | undefined, flockId: string): void {
  writeScoped(userId, ACTIVE_FLOCK_STORAGE_KEY, flockId);
}
