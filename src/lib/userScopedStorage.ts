/**
 * Per-user-scoped localStorage helper.
 *
 * Keys are prefixed with the user's id so that two users sharing the same
 * browser get independent settings. On first read for a given user we also
 * migrate any legacy value stored under the bare (global) key so existing
 * users don't lose their state.
 *
 * Usage:
 *   const k = scopedKey(userId, 'dashboard-feed-nudge-dismissed');
 *   localStorage.getItem(k)
 *
 * Or use the convenience accessors below.
 */

const PREFIX = 'u:';
const ANON = 'anon';

function uid(userId: string | null | undefined): string {
  return userId && userId.length > 0 ? userId : ANON;
}

/**
 * Returns the per-user-scoped storage key for a given logical key.
 */
export function scopedKey(userId: string | null | undefined, key: string): string {
  return `${PREFIX}${uid(userId)}:${key}`;
}

/**
 * Read a per-user value. If no value exists for this user, fall back to a
 * legacy global key (used pre-scoping) and migrate it to the user-scoped key.
 * Pass migrateLegacy=false to skip migration (useful for keys that should
 * never be inherited).
 */
export function readScoped(
  userId: string | null | undefined,
  key: string,
  migrateLegacy = true,
): string | null {
  try {
    const sk = scopedKey(userId, key);
    const v = localStorage.getItem(sk);
    if (v !== null) return v;
    if (!migrateLegacy) return null;
    const legacy = localStorage.getItem(key);
    if (legacy !== null) {
      localStorage.setItem(sk, legacy);
      return legacy;
    }
    return null;
  } catch {
    return null;
  }
}

export function writeScoped(
  userId: string | null | undefined,
  key: string,
  value: string,
): void {
  try {
    localStorage.setItem(scopedKey(userId, key), value);
  } catch {
    /* private browsing / quota */
  }
}

export function removeScoped(
  userId: string | null | undefined,
  key: string,
): void {
  try {
    localStorage.removeItem(scopedKey(userId, key));
  } catch {
    /* ignore */
  }
}

/**
 * Remove every scoped key belonging to a specific user. Used at logout to
 * keep the device clean without affecting other users' state.
 */
export function clearAllForUser(userId: string | null | undefined): void {
  try {
    const prefix = `${PREFIX}${uid(userId)}:`;
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}
