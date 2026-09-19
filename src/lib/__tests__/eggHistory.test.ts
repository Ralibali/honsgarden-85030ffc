import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { getEggs, updateEggRecord } from '@/lib/api';

const db = vi.hoisted(() => ({ from: vi.fn(), getSession: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: db.from, auth: { getSession: db.getSession } } }));
vi.mock('@/lib/offlineQueue', () => ({ getQueue: () => [], loadQueue: vi.fn() }));

const original = { id: 'saved-egg', date: '2026-08-01', count: 8 };
let query: Record<string, ReturnType<typeof vi.fn>>;
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
  db.getSession.mockResolvedValue({ data: { session: { user: { id: 'editor' } } } });
  query = Object.fromEntries(['update', 'eq', 'select', 'order', 'range', 'maybeSingle'].map((name) => [name, vi.fn()]));
  Object.values(query).forEach((fn) => fn.mockReturnValue(query));
  db.from.mockReturnValue(query);
});
afterEach(() => vi.restoreAllMocks());

describe('historical egg persistence', () => {
  it('updates the original row with concurrency guards and preserves unrelated fields', async () => {
    const saved = { ...original, count: 4, hen_id: 'hen', flock_id: 'flock', notes: 'Keep me', user_id: 'owner' };
    query.maybeSingle.mockResolvedValue({ data: saved, error: null });
    expect(await updateEggRecord(original, { date: original.date, count: 4 })).toEqual(saved);
    expect(query.update).toHaveBeenCalledWith({ date: original.date, count: 4 });
    expect(query.eq.mock.calls).toEqual([['id', original.id], ['date', original.date], ['count', 8]]);
  });

  it('clears stale weather when moving the registration to another date', async () => {
    query.maybeSingle.mockResolvedValue({ data: { ...original, date: '2026-07-31', count: 0 }, error: null });
    await updateEggRecord(original, { date: '2026-07-31', count: 0 });
    expect(query.update).toHaveBeenCalledWith({ date: '2026-07-31', count: 0, weather: null });
  });

  it('does not report success when RLS or a concurrent edit prevents the update', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateEggRecord(original, { date: original.date, count: 2 })).rejects.toThrow('kan inte redigeras');
  });

  it('reports database errors', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(updateEggRecord(original, { date: original.date, count: 2 })).rejects.toThrow('permission denied');
  });

  it.each([
    { date: '', count: 2 }, { date: '2026-02-30', count: 2 },
    { date: '2999-01-01', count: 2 }, { date: original.date, count: -1 },
    { date: original.date, count: 1.5 }, { date: original.date, count: NaN },
  ])('rejects invalid correction %j before sending a write', async (changes) => {
    await expect(updateEggRecord(original, changes)).rejects.toThrow();
    expect(db.from).not.toHaveBeenCalled();
  });

  it.each(['pending-local', 'temp-local'])('does not send queued row %s to the database', async (id) => {
    await expect(updateEggRecord({ ...original, id }, original)).rejects.toThrow('synkas');
    expect(db.from).not.toHaveBeenCalled();
  });

  it('keeps offline corrections from pretending to be saved', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await expect(updateEggRecord(original, original)).rejects.toThrow('internet');
    expect(db.from).not.toHaveBeenCalled();
  });

  it('requires a signed-in session', async () => {
    db.getSession.mockResolvedValue({ data: { session: null } });
    await expect(updateEggRecord(original, original)).rejects.toThrow('Not authenticated');
    expect(db.from).not.toHaveBeenCalled();
  });

  it('fetches history beyond the first 1000 records', async () => {
    const page = Array.from({ length: 1000 }, (_, i) => ({ ...original, id: String(i) }));
    const oldest = { ...original, id: 'oldest', date: '2025-01-01' };
    query.range.mockResolvedValueOnce({ data: page, error: null }).mockResolvedValueOnce({ data: [oldest], error: null });
    const rows = await getEggs();
    expect(rows).toHaveLength(1001);
    expect(rows.at(-1)).toEqual(oldest);
    expect(query.range.mock.calls).toEqual([[0, 999], [1000, 1999]]);
  });
});
