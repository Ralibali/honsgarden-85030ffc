// Offline queue for egg log entries. Persists to IndexedDB via idb-keyval
// (migrates from the legacy localStorage store) and syncs sequentially when
// connectivity returns.

import { get as idbGet, set as idbSet, del as idbDel } from 'idb-keyval';

const IDB_KEY = 'honsgarden_offline_queue_v2';
const LEGACY_LS_KEY = 'honsgarden_offline_queue_v1';
const MAX_QUEUE = 200;

export interface QueuedEggLog {
  client_id: string;
  date: string;
  count: number;
  hen_id?: string;
  flock_id?: string;
  queued_at: string;
}

export type CreateEggRecordFn = (record: {
  date: string;
  count: number;
  hen_id?: string;
  flock_id?: string;
  weather?: Record<string, unknown> | null;
  client_id?: string;
}) => Promise<unknown>;

// In-memory mirror of the persisted queue. Kept in sync with IDB so we can
// answer `getQueueLength()` synchronously from React render paths.
let cache: QueuedEggLog[] = [];
let loaded = false;
let loadPromise: Promise<QueuedEggLog[]> | null = null;

function notifyChanged(): void {
  try {
    window.dispatchEvent(new Event('honsgarden:queue-changed'));
  } catch {
    /* ignore */
  }
}

function migrateFromLocalStorage(): QueuedEggLog[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LEGACY_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    localStorage.removeItem(LEGACY_LS_KEY);
    return parsed as QueuedEggLog[];
  } catch {
    return [];
  }
}

async function persist(): Promise<void> {
  try {
    await idbSet(IDB_KEY, cache);
  } catch (err) {
    console.error('offlineQueue: failed to persist to IDB', err);
  }
}

export async function loadQueue(): Promise<QueuedEggLog[]> {
  if (loaded) return cache;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const stored = (await idbGet<QueuedEggLog[]>(IDB_KEY)) ?? [];
      const legacy = migrateFromLocalStorage();
      cache = [...stored, ...legacy];
      if (legacy.length > 0) await persist();
    } catch (err) {
      console.error('offlineQueue: failed to load from IDB', err);
      cache = migrateFromLocalStorage();
    }
    loaded = true;
    notifyChanged();
    return cache;
  })();
  return loadPromise;
}

/** Synchronous length from the in-memory mirror (0 until loadQueue resolves). */
export function getQueueLength(): number {
  return cache.length;
}

/** Kept for backwards-compatibility with existing sync callers. */
export function getQueue(): QueuedEggLog[] {
  return cache;
}

export async function enqueueEggLog(
  entry: Omit<QueuedEggLog, 'client_id' | 'queued_at'> & { client_id?: string },
): Promise<QueuedEggLog> {
  await loadQueue();
  if (cache.length >= MAX_QUEUE) {
    throw new Error(
      `Offline-kön är full (${MAX_QUEUE} poster). Anslut till nätet så synkas dina loggningar.`,
    );
  }
  const item: QueuedEggLog = {
    client_id:
      entry.client_id ??
      (typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2)),
    date: entry.date,
    count: entry.count,
    hen_id: entry.hen_id,
    flock_id: entry.flock_id,
    queued_at: new Date().toISOString(),
  };
  cache = [...cache, item];
  await persist();
  notifyChanged();
  return item;
}

export async function removeFromQueue(clientId: string): Promise<void> {
  cache = cache.filter((q) => q.client_id !== clientId);
  await persist();
  notifyChanged();
}

export async function clearQueue(): Promise<void> {
  cache = [];
  try {
    await idbDel(IDB_KEY);
  } catch {
    /* ignore */
  }
  notifyChanged();
}

function isNetworkError(err: unknown): boolean {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = (err as Error)?.message?.toLowerCase?.() ?? '';
  return (
    msg.includes('failed to fetch') ||
    msg.includes('network') ||
    msg.includes('fetcherror') ||
    msg.includes('load failed') ||
    (msg.includes('typeerror') && msg.includes('fetch'))
  );
}

let syncInFlight: Promise<{ synced: number; remaining: number }> | null = null;

async function runSyncInternal(
  createEggRecord: CreateEggRecordFn,
): Promise<{ synced: number; remaining: number }> {
  await loadQueue();
  let synced = 0;
  for (const item of [...cache]) {
    try {
      await createEggRecord({
        date: item.date,
        count: item.count,
        hen_id: item.hen_id,
        flock_id: item.flock_id,
        weather: null,
        client_id: item.client_id,
      });
      await removeFromQueue(item.client_id);
      synced++;
    } catch (err) {
      if (isNetworkError(err)) break;
      console.error('offlineQueue: dropping invalid entry', item.client_id, err);
      await removeFromQueue(item.client_id);
    }
  }
  return { synced, remaining: cache.length };
}

export function syncQueue(
  createEggRecord: CreateEggRecordFn,
): Promise<{ synced: number; remaining: number }> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runSyncInternal(createEggRecord).finally(() => {
    syncInFlight = null;
    notifyChanged();
  });
  return syncInFlight;
}

// Kick off IDB load as early as possible so the in-memory cache reflects
// persisted entries by the time components render.
if (typeof window !== 'undefined') {
  void loadQueue();
}
