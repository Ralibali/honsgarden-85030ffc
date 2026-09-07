import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDiaryLogs } from '@/lib/api';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), rpc: vi.fn(), range: vi.fn(), eq: vi.fn(), owners: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: mocks.getSession }, rpc: mocks.rpc,
  from: mocks.from,
} }));
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'self' } } }, error: null });
  mocks.rpc.mockResolvedValue({ data: ['self', 'family'], error: null });
  const builder = { select: () => builder, eq: mocks.eq, in: mocks.owners, order: () => builder, range: mocks.range };
  mocks.eq.mockReturnValue(builder); mocks.owners.mockReturnValue(builder); mocks.from.mockReturnValue(builder);
  mocks.range.mockResolvedValue({ data: [], error: null });
});
describe('getDiaryLogs', () => {
  it('restricts admin and ordinary requests to the authenticated shared farm', async () => {
    await getDiaryLogs();
    expect(mocks.rpc).toHaveBeenCalledWith('get_farm_user_ids', { _uid: 'self' });
    expect(mocks.eq).toHaveBeenCalledWith('type', 'diary');
    expect(mocks.owners).toHaveBeenCalledWith('user_id', ['self', 'family']);
  });
  it('retrieves older pages past the server row limit', async () => {
    mocks.range.mockResolvedValueOnce({ data: Array.from({ length: 500 }, (_, id) => ({ id })), error: null })
      .mockResolvedValueOnce({ data: [{ id: 'older' }], error: null });
    const entries = await getDiaryLogs();
    expect(entries).toHaveLength(501);
    expect(entries[500].id).toBe('older');
    expect(mocks.range).toHaveBeenNthCalledWith(1, 0, 499);
    expect(mocks.range).toHaveBeenNthCalledWith(2, 500, 999);
  });
  it('fails closed when farm membership cannot be loaded', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'membership unavailable' } });
    await expect(getDiaryLogs()).rejects.toThrow('membership unavailable');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('does not present a partial history as complete when a later page fails', async () => {
    mocks.range.mockResolvedValueOnce({ data: Array(500).fill({ id: 'entry' }), error: null })
      .mockResolvedValueOnce({ data: null, error: { message: 'offline' } });
    await expect(getDiaryLogs()).rejects.toThrow('offline');
  });
});
