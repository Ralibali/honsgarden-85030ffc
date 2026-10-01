import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createEggRecord } from '../api';

const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), insert: vi.fn(), single: vi.fn(), existing: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getSession: mocks.session }, from: mocks.from } }));
const event = vi.fn();
const row = { date: '2026-10-01', count: 2, client_id: 'stable-retry', analytics_source: 'quick_log_card' as const };
beforeEach(() => {
  vi.clearAllMocks();
  window.analyticsEvent = event;
  mocks.session.mockResolvedValue({ data: { session: { user: { id: 'owner' } } } });
  const builder = { insert: mocks.insert, select: () => builder, eq: () => builder, single: mocks.single, maybeSingle: mocks.existing };
  mocks.from.mockReturnValue(builder);
  mocks.insert.mockReturnValue(builder);
  mocks.single.mockResolvedValue({ data: { id: 'new-row', user_id: 'owner', ...row }, error: null });
});
afterEach(() => { delete window.analyticsEvent; });
describe('successful egg saves', () => {
  it('counts every new insert without customer identifiers or notes', async () => {
    await createEggRecord({ ...row, notes: 'private note' });
    await createEggRecord({ ...row, client_id: 'second-row' });
    expect(event).toHaveBeenCalledTimes(2);
    expect(event).toHaveBeenCalledWith('Egg Log Saved', { props: { source: 'quick_log_card', persistence: 'online' } });
    expect(JSON.stringify(event.mock.calls)).not.toMatch(/owner|new-row|stable-retry|private note/);
    expect(mocks.insert.mock.calls[0][0]).not.toHaveProperty('analytics_source');
  });
  it('labels a newly persisted offline save', async () => {
    await createEggRecord({ ...row, expected_user_id: 'owner', analytics_persistence: 'offline_sync' });
    expect(event).toHaveBeenCalledWith('Egg Log Saved', { props: { source: 'quick_log_card', persistence: 'offline_sync' } });
  });
  it('does not double count an idempotent retry of an existing record', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate' } });
    mocks.existing.mockResolvedValue({ data: { id: 'existing-row' } });
    expect(await createEggRecord(row)).toEqual({ id: 'existing-row' });
    expect(event).not.toHaveBeenCalled();
  });
  it('does not count a rejected save or a save for another account', async () => {
    mocks.single.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(createEggRecord(row)).rejects.toThrow('permission denied');
    await expect(createEggRecord({ ...row, expected_user_id: 'another' })).rejects.toThrow('kontot');
    expect(event).not.toHaveBeenCalled();
  });
});
