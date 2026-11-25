import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getEggs, getFlockStatistics, getHens, getSummaryStats } from '@/lib/api';
import { summarizeEggPeriod } from '@/lib/farmMetrics';
import { withRequestTimeout } from '@/lib/requestTimeout';
import { QueryClient } from '@tanstack/react-query';
import { invalidateEggQueries } from '@/lib/eggQueryCache';

const db = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getSession: vi.fn(), getQueue: vi.fn(), loadQueue: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: db.rpc, from: db.from, auth: { getSession: db.getSession } } }));
vi.mock('@/lib/offlineQueue', () => ({ getQueue: db.getQueue, loadQueue: db.loadQueue }));

beforeEach(() => {
  vi.clearAllMocks();
  db.getSession.mockResolvedValue({ data: { session: { user: { id: 'farm-owner' } } } });
  db.rpc.mockReturnValue({ abortSignal: () => Promise.resolve({ data: ['farm-owner', 'family'], error: null }) });
  db.getQueue.mockReturnValue([]);
  db.loadQueue.mockResolvedValue(undefined);
});
afterEach(() => vi.useRealTimers());

function table(range: ReturnType<typeof vi.fn>) {
  const query = { in: vi.fn(), select: vi.fn(), order: vi.fn(), abortSignal: vi.fn(), range };
  query.in.mockReturnValue(query);
  query.select.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.abortSignal.mockReturnValue(query);
  return query;
}

describe('reliable shared farm reads', () => {
  it('shares concurrent pagination without dropping rows beyond 1000', async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, id) => ({ id })), error: null })
      .mockResolvedValueOnce({ data: [{ id: 1000 }], error: null });
    const query = table(range);
    db.from.mockReturnValue(query);
    const [first, second] = await Promise.all([getHens(), getHens()]);
    expect(first).toEqual(second);
    expect(query.in.mock.calls).toEqual([['user_id', ['farm-owner', 'family']], ['user_id', ['farm-owner', 'family']]]);
    expect(db.rpc).toHaveBeenCalledTimes(1);
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

  it('reconciles flock totals with the shared egg book and active hen count', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 25, 0, 10));
    const data: Record<string, unknown[]> = {
      flocks: [{ id: 'a', name: 'Min flock' }, { id: 'b', name: 'Ny flock' }],
      hens: [
        { id: 'hen', flock_id: 'b', is_active: true, hen_type: 'hen' },
        { id: 'pullet', flock_id: 'b', is_active: true, hen_type: 'pullet' },
        { id: 'rooster', flock_id: 'b', is_active: true, hen_type: 'rooster' },
      ],
      egg_logs: [
        { date: '2026-11-25', count: 2, hen_id: 'hen', flock_id: 'a' },
        { date: '2026-11-19', count: 3, hen_id: 'hen' },
        { date: '2026-11-18', count: 6, flock_id: 'b' },
        { date: '2026-11-25', count: 4 },
      ],
      transactions: [],
    };
    db.from.mockImplementation((name: string) => table(vi.fn().mockResolvedValue({ data: data[name], error: null })));
    const [summary, stats] = await Promise.all([getSummaryStats(), getFlockStatistics()]);
    expect(stats.flocks[0]).toMatchObject({ id: 'b', active_hens: 2, total_eggs: 9, week_eggs: 3, week_change: -50 });
    expect(stats.flocks[1]).toMatchObject({ id: 'a', active_hens: 0, total_eggs: 2 });
    expect(stats.unassigned_eggs).toBe(4);
    expect(summary).toMatchObject({ active_hens: 2, total_eggs: 15, recorded_days: 3 });
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

describe('egg statistics periods', () => {
  const rows = [
    { date: '2026-03-23', count: 5 },
    { date: '2026-03-24', count: 1 },
    { date: '2026-03-30', count: 2 },
    { date: '2026-03-30', count: 3 },
    { date: '2026-03-31', count: 100 },
  ];

  it('uses inclusive local dates through a daylight saving change and ignores future entries', () => {
    expect(summarizeEggPeriod(rows, '2026-03-30', 7)).toMatchObject({
      currentTotal: 6, previousTotal: 5, bestDay: ['2026-03-30', 5], avgPerDay: 6 / 7,
    });
  });

  it('averages all time from the first registration, including zero-egg days', () => {
    expect(summarizeEggPeriod([{ date: '2026-03-21', count: 0 }, ...rows], '2026-03-30', null))
      .toMatchObject({ currentTotal: 11, avgPerDay: 1.1 });
    expect(summarizeEggPeriod([], '2026-03-30', null).avgPerDay).toBe(0);
  });
});
