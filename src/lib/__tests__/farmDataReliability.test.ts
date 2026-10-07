import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEggs, getHens, getSummaryStats } from '@/lib/api';
import { withRequestTimeout } from '@/lib/requestTimeout';
import { QueryClient } from '@tanstack/react-query';
import { invalidateEggQueries } from '@/lib/eggQueryCache';

const db = vi.hoisted(() => ({ from: vi.fn(), getSession: vi.fn(), getQueue: vi.fn(), loadQueue: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: db.from, auth: { getSession: db.getSession } } }));
vi.mock('@/lib/offlineQueue', () => ({ getQueue: db.getQueue, loadQueue: db.loadQueue }));

beforeEach(() => {
  vi.clearAllMocks();
  db.getSession.mockResolvedValue({ data: { session: { user: { id: 'farm-owner' } } } });
  db.getQueue.mockReturnValue([]);
  db.loadQueue.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

function table(range: ReturnType<typeof vi.fn>) {
  const query = { select: vi.fn(), order: vi.fn(), abortSignal: vi.fn(), range };
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.abortSignal.mockReturnValue(query);
  return query;
}

describe('reliable shared farm reads', () => {
  it('shares concurrent pagination without dropping rows beyond 1000', async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null })
      .mockResolvedValueOnce({ data: [{ id: 1000 }], error: null });
    db.from.mockReturnValue(table(range));
    const [first, second] = await Promise.all([getHens(), getHens()]);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1001);
    expect(range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });

  it('propagates failures and allows the next attempt instead of caching an empty farm', async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: null, error: { message: 'timeout' } })
      .mockResolvedValueOnce({ data: [{ id: 'hen' }], error: null });
    db.from.mockReturnValue(table(range));
    await expect(getHens()).rejects.toThrow('timeout');
    await expect(getHens()).resolves.toEqual([{ id: 'hen' }]);
  });

  it('does not leave a hung read waiting forever and can retry afterwards', async () => {
    vi.useFakeTimers();
    const range = vi.fn().mockImplementationOnce(() => new Promise(() => {}))
      .mockResolvedValue({ data: [], error: null });
    db.from.mockReturnValue(table(range));
    const failure = expect(getHens()).rejects.toThrow('tog för lång tid');
    await vi.advanceTimersByTimeAsync(20_001);
    await failure;
    await expect(getHens()).resolves.toEqual([]);
  });

  it('keeps October eggs and pending logs in the summary and excludes roosters and inactive hens', async () => {
    const rows: Record<string, unknown[]> = {
      egg_logs: [{ id: 'october', date: '2026-10-07', count: 6, client_id: 'synced' }],
      hens: [
        { is_active: true, hen_type: 'hen' }, { is_active: true, hen_type: 'pullet' },
        { is_active: true, hen_type: 'rooster' }, { is_active: false, hen_type: 'hen' },
      ],
      transactions: [],
    };
    db.from.mockImplementation((name: string) => table(vi.fn().mockResolvedValue({ data: rows[name], error: null })));
    db.getQueue.mockReturnValue([
      { client_id: 'synced', date: '2026-10-07', count: 6 },
      { client_id: 'pending', date: '2026-10-07', count: 2 },
    ]);
    const [eggs, summary] = await Promise.all([getEggs(), getSummaryStats()]);
    expect(eggs.reduce((sum, egg) => sum + egg.count, 0)).toBe(8);
    expect(summary.total_eggs).toBe(8);
    expect(summary.active_hens).toBe(2);
    expect(db.getQueue).toHaveBeenCalledWith('farm-owner');
  });

  it('marks egg history and derived statistics stale after quick logging or offline sync', async () => {
    const client = new QueryClient();
    for (const key of ['eggs', 'stats-summary', 'stats-insights', 'hens-with-eggs', 'flock-statistics']) {
      client.setQueryData([key], { total: 0 });
    }
    client.setQueryData(['unrelated'], 'keep');
    await invalidateEggQueries(client);
    expect(client.getQueryState(['stats-summary'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['eggs'])?.isInvalidated).toBe(true);
    expect(client.getQueryState(['unrelated'])?.isInvalidated).toBe(false);
    client.clear();
  });
});

describe('bounded requests', () => {
  it('aborts the transport when the deadline passes', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    const failure = expect(withRequestTimeout((value) => {
      signal = value;
      return new Promise(() => {});
    }, 50)).rejects.toThrow('tog för lång tid');
    await vi.advanceTimersByTimeAsync(51);
    await failure;
    expect(signal?.aborted).toBe(true);
  });

  it('cleans up the deadline on success', async () => {
    vi.useFakeTimers();
    await expect(withRequestTimeout(async () => 6)).resolves.toBe(6);
    expect(vi.getTimerCount()).toBe(0);
  });
});
