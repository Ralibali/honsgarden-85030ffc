import { get as idbGet, update as idbUpdate } from "idb-keyval";

const KEY = "honsgarden_offline_queue_v2";
const LEGACY_KEY = "honsgarden_offline_queue_v1";
const MAX_QUEUE = 200;
export interface QueuedEggLog {
  client_id: string;
  user_id?: string; // Legacy entries have no provable owner and are never auto-synced.
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
  expected_user_id?: string;
}) => Promise<unknown>;
let cache: QueuedEggLog[] = [];
let loaded = false;
let loadPromise: Promise<QueuedEggLog[]> | null = null;
let mutations: Promise<unknown> = Promise.resolve();
const notify = () => {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("honsgarden:queue-changed"));
};

function exclusive<T>(work: () => Promise<T>): Promise<T> {
  const result = mutations.then(work);
  mutations = result.catch(() => {});
  return result;
}
async function persist(transform: (stored: QueuedEggLog[]) => QueuedEggLog[]) {
  let next: QueuedEggLog[] = [];
  try {
    await idbUpdate<QueuedEggLog[]>(KEY, (current) => {
      next = transform(validEntries(current ?? []));
      return next;
    });
  } catch {
    throw new Error(
      "Kunde inte spara på enheten. Frigör lagringsutrymme och försök igen."
    );
  }
  cache = next;
  notify();
}
function validEntries(raw: unknown): QueuedEggLog[] {
  if (
    !Array.isArray(raw) ||
    raw.some(
      (x) =>
        !x ||
        typeof x.client_id !== "string" ||
        typeof x.date !== "string" ||
        typeof x.queued_at !== "string" ||
        !Number.isInteger(x.count) ||
        x.count < 0 ||
        (x.user_id !== undefined && typeof x.user_id !== "string")
    )
  )
    throw new Error(
      "Kunde inte läsa de lokala äggloggningarna. De finns kvar på enheten."
    );
  return raw;
}
export async function loadQueue(): Promise<QueuedEggLog[]> {
  if (loaded) return [...cache];
  if (!loadPromise)
    loadPromise = (async () => {
      const stored = validEntries((await idbGet(KEY)) ?? []);
      const legacyRaw =
        typeof localStorage === "undefined"
          ? null
          : localStorage.getItem(LEGACY_KEY);
      const legacy = legacyRaw ? validEntries(JSON.parse(legacyRaw)) : [];
      if (legacy.length) {
        await persist((current) => [
          ...new Map(
            [...legacy, ...current].map((item) => [
              `${item.user_id ?? ""}:${item.client_id}`,
              item,
            ])
          ).values(),
        ]);
        localStorage.removeItem(LEGACY_KEY); // Remove the old copy only after durable persistence.
      } else cache = stored;
      loaded = true;
      notify();
      return [...cache];
    })().finally(() => {
      loadPromise = null;
    });
  return loadPromise;
}
export function getQueue(userId?: string): QueuedEggLog[] {
  return cache
    .filter((x) => (userId ? x.user_id === userId : !x.user_id))
    .map((x) => ({ ...x }));
}
export const getQueueLength = (userId?: string) => getQueue(userId).length;
export async function enqueueEggLog(
  entry: Omit<QueuedEggLog, "client_id" | "queued_at"> & { client_id?: string }
): Promise<QueuedEggLog> {
  return exclusive(async () => {
    await loadQueue();
    if (!entry.user_id)
      throw new Error("Logga in innan du sparar ägg på enheten.");
    if (!Number.isInteger(entry.count) || entry.count < 0)
      throw new Error("Ange ett giltigt antal ägg.");
    const item = {
      ...entry,
      client_id: entry.client_id ?? crypto.randomUUID(),
      queued_at: new Date().toISOString(),
    };
    await persist((current) => {
      if (
        current.some(
          (x) => x.client_id === item.client_id && x.user_id === item.user_id
        )
      )
        return current;
      if (current.length >= MAX_QUEUE)
        throw new Error(
          "Offline-kön är full. Anslut till nätet och synka dina loggningar."
        );
      return [...current, item];
    });
    return item;
  });
}
export async function removeFromQueue(
  clientId: string,
  userId: string
): Promise<void> {
  return exclusive(async () => {
    await loadQueue();
    await persist((current) =>
      current.filter((x) => x.client_id !== clientId || x.user_id !== userId)
    );
  });
}
export async function clearQueue(userId: string): Promise<void> {
  return exclusive(async () => {
    await loadQueue();
    await persist((current) => current.filter((x) => x.user_id !== userId));
  });
}
/** Assigns ownerless legacy entries to the signed-in user after their explicit confirmation. */
export async function claimLegacyEntries(userId: string): Promise<number> {
  return exclusive(async () => {
    await loadQueue();
    let claimed = 0;
    await persist((current) =>
      current.map((x) => {
        if (x.user_id) return x;
        claimed++;
        return { ...x, user_id: userId };
      })
    );
    return claimed;
  });
}

function isTransientError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = (
    error instanceof Error ? error.message : String(error ?? "")
  ).toLowerCase();
  return /failed to fetch|network|load failed|fetcherror|timeout|timed out|too many requests|rate limit|internal server error|service unavailable|jwt|token|not authenticated|logga in|\b(429|500|502|503|504)\b/.test(
    message
  );
}

const syncInFlight = new Map<
  string,
  Promise<{ synced: number; remaining: number; dropped: number }>
>();
export function syncQueue(
  createEggRecord: CreateEggRecordFn,
  userId: string
): Promise<{ synced: number; remaining: number; dropped: number }> {
  const active = syncInFlight.get(userId);
  if (active) return active;
  const result = (async () => {
    await loadQueue();
    let synced = 0;
    let dropped = 0;
    for (const item of getQueue(userId)) {
      try {
        await createEggRecord({
          date: item.date,
          count: item.count,
          hen_id: item.hen_id,
          flock_id: item.flock_id,
          weather: null,
          client_id: item.client_id,
          expected_user_id: userId,
        });
        await removeFromQueue(item.client_id, userId);
        synced++;
      } catch (error) {
        // Transient failures (offline, auth, server) keep the entry; client_id makes retries idempotent.
        if (isTransientError(error)) break;
        // Permanently invalid entries (deleted hen, validation) are discarded so
        // the rest of the queue can keep syncing.
        console.error("offlineQueue: dropping invalid entry", item.client_id, error);
        await removeFromQueue(item.client_id, userId);
        dropped++;
      }
    }
    return { synced, remaining: getQueueLength(userId), dropped };
  })().finally(() => {
    syncInFlight.delete(userId);
    notify();
  });
  syncInFlight.set(userId, result);
  return result;
}
