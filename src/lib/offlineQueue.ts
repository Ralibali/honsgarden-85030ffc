// Offline queue for egg log entries. Persists to localStorage and syncs sequentially.
import { logClientError } from '@/lib/errorLogger';

const QUEUE_KEY = 'honsgarden_offline_queue_v1';
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

function readQueue(): QueuedEggLog[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedEggLog[]): void {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('offlineQueue: failed to persist', err);
  }
}

export function getQueue(): QueuedEggLog[] {
  return readQueue();
}

export function enqueueEggLog(entry: Omit<QueuedEggLog, 'client_id' | 'queued_at'> & { client_id?: string }): QueuedEggLog {
  const queue = readQueue();
  if (queue.length >= MAX_QUEUE) {
    throw new Error(`Offline-kön är full (${MAX_QUEUE} poster). Anslut till nätet så synkas dina loggningar.`);
  }
  const item: QueuedEggLog = {
    client_id: entry.client_id ?? (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)),
    date: entry.date,
    count: entry.count,
    hen_id: entry.hen_id,
    flock_id: entry.flock_id,
    queued_at: new Date().toISOString(),
  };
  queue.push(item);
  writeQueue(queue);
  return item;
}

export function removeFromQueue(clientId: string): void {
  const next = readQueue().filter((q) => q.client_id !== clientId);
  writeQueue(next);
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
    msg.includes('typeerror') && msg.includes('fetch')
  );
}

let syncInFlight: Promise<{ synced: number; remaining: number }> | null = null;

export function syncQueue(createEggRecord: CreateEggRecordFn): Promise<{ synced: number; remaining: number }> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = (async () => {
    let synced = 0;
    const queue = readQueue();
    for (const item of [...queue]) {
      try {
        await createEggRecord({
          date: item.date,
          count: item.count,
          hen_id: item.hen_id,
          flock_id: item.flock_id,
          weather: null,
          client_id: item.client_id,
        });
        removeFromQueue(item.client_id);
        synced++;
      } catch (err) {
        if (isNetworkError(err)) {
          // Stop here, keep remaining entries for next attempt
          break;
        }
        // Non-network error: log and drop so it doesn't block forever
        try {
          logClientError(err as Error, { context: 'offlineQueue.sync', clientId: item.client_id });
        } catch {
          /* ignore */
        }
        removeFromQueue(item.client_id);
      }
    }
    return { synced, remaining: readQueue().length };
  })();
  try {
    return await syncInFlight;
  } finally {
    syncInFlight = null;
  }
}
