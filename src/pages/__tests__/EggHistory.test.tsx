import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Eggs from '@/pages/Eggs';
import type { EggLog } from '@/lib/api';

const mocks = vi.hoisted(() => ({ getEggs: vi.fn(), update: vi.fn(), create: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: {
  getEggs: mocks.getEggs, updateEggRecord: mocks.update, createEggRecord: mocks.create,
  fetchEggLogWeatherSnapshot: async () => null,
  getHens: async () => [], getFlocks: async () => [], getFeedRecords: async () => [], getTransactions: async () => [], getDailyChores: async () => [],
} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/useActiveKarens', () => ({ useActiveKarens: () => ({ data: [] }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackFirstEggIfNew: vi.fn() }));
vi.mock('@/lib/personalRecords', () => ({ checkPersonalRecords: () => [], recordLabel: vi.fn() }));
vi.mock('@/components/EggSuccessAnimation', () => ({ EggSuccessAnimation: () => null }));
vi.mock('@/components/PersonalRecordToast', () => ({ PersonalRecordToast: () => null }));
vi.mock('@/components/FeatureSuggestionToast', () => ({ FeatureSuggestionToast: () => null }));

const original = { id: 'original', date: '2026-08-01', count: 8, hen_id: 'hen', flock_id: 'flock', notes: 'Original note', user_id: 'owner', created_at: '', weather: null, client_id: null } as EggLog;
let rows: EggLog[];
beforeEach(() => {
  vi.clearAllMocks();
  rows = [{ ...original }];
  mocks.getEggs.mockImplementation(async () => rows);
  mocks.update.mockImplementation(async (entry, changes) => {
    const saved = { ...entry, ...changes };
    rows = rows.map((row) => row.id === entry.id ? saved : row);
    return saved;
  });
  mocks.create.mockImplementation(async (data) => {
    const saved = { ...original, ...data, id: 'new' };
    rows = [...rows, saved];
    return saved;
  });
});

function mount(path = '/app/eggs') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<MemoryRouter initialEntries={[path]}><QueryClientProvider client={client}><Eggs /></QueryClientProvider></MemoryRouter>);
  return client;
}

describe('egg book history flow', () => {
  it('adds eggs to any previous date through the direct backfill entry point', async () => {
    mount('/app/eggs?log=1');
    fireEvent.change(await screen.findByLabelText('Datum', { exact: true }), { target: { value: '2025-04-03' } });
    fireEvent.change(screen.getByLabelText('Antal ägg', { exact: true }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara 6 ägg' }));
    await waitFor(() => expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ date: '2025-04-03', count: 6 })));
    await waitFor(() => expect(screen.getByLabelText('Hitta en dag')).toHaveValue('2025-04-03'));
  });

  it('corrects an existing date and count, refreshes totals and keeps the row identity', async () => {
    const client = mount();
    fireEvent.click(await screen.findByRole('button', { name: /Ändra registreringen/ }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Datum'), { target: { value: '2026-07-31' } });
    fireEvent.change(within(dialog).getByLabelText('Antal ägg'), { target: { value: '4' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Spara ändringar' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(mocks.update).toHaveBeenCalledWith(original, { date: '2026-07-31', count: 4 });
    expect(mocks.create).not.toHaveBeenCalled();
    expect(client.getQueryData(['eggs'])).toEqual([{ ...original, date: '2026-07-31', count: 4 }]);
    expect(screen.getByLabelText('Hitta en dag')).toHaveValue('2026-07-31');
  });

  it('preserves the correction draft when saving fails', async () => {
    mocks.update.mockRejectedValue(new Error('Det gick inte att spara'));
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Ändra registreringen/ }));
    fireEvent.change(screen.getByLabelText('Antal ägg'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara ändringar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Det gick inte att spara');
    expect(screen.getByLabelText('Antal ägg')).toHaveValue(3);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('preserves a backfill draft on a server failure', async () => {
    mocks.create.mockRejectedValue(new Error('Serverfel'));
    mount('/app/eggs?log=1');
    fireEvent.change(await screen.findByLabelText('Datum', { exact: true }), { target: { value: '2026-07-12' } });
    fireEvent.change(screen.getByLabelText('Antal ägg'), { target: { value: '9' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spara 9 ägg' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Spara 9 ägg' })).toBeEnabled());
    expect(screen.getByLabelText('Antal ägg')).toHaveValue(9);
    expect(screen.getByLabelText('Datum', { exact: true })).toHaveValue('2026-07-12');
  });

  it('makes old dates reachable and keeps all entries of a busy day visible in both views', async () => {
    rows = Array.from({ length: 115 }, (_, i) => ({ ...original, id: `same-day-${i}`, count: 1 }));
    rows.push({ ...original, id: 'old', date: '2025-01-01' });
    mount();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ändra registreringen/ })).toHaveLength(116));
    fireEvent.click(screen.getByRole('button', { name: 'Listvy' }));
    expect(screen.getAllByRole('button', { name: /Ändra registreringen/ })).toHaveLength(116);
    fireEvent.change(screen.getByLabelText('Hitta en dag'), { target: { value: '2025-01-01' } });
    expect(screen.getAllByRole('button', { name: /Ändra registreringen/ })).toHaveLength(1);
  });

  it('does not write when editing is cancelled', async () => {
    mount();
    fireEvent.click(await screen.findByRole('button', { name: /Ändra registreringen/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Avbryt' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.update).not.toHaveBeenCalled();
  });

  it('loads older complete days on demand', async () => {
    rows = Array.from({ length: 20 }, (_, i) => ({ ...original, id: `day-${i}`, date: `2026-08-${String(i + 1).padStart(2, '0')}` }));
    mount();
    await waitFor(() => expect(screen.getAllByRole('button', { name: /Ändra registreringen/ })).toHaveLength(14));
    fireEvent.click(screen.getByRole('button', { name: 'Visa äldre dagar' }));
    expect(screen.getAllByRole('button', { name: /Ändra registreringen/ })).toHaveLength(20);
  });

  it('keeps today’s add button on today even when history is filtered', async () => {
    mount();
    fireEvent.change(await screen.findByLabelText('Hitta en dag'), { target: { value: '2025-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: /^Lägg till$/ }));
    const date = new Date();
    const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    expect(screen.getByLabelText('Datum', { exact: true })).toHaveValue(today);
  });

  it('does not allow pending offline entries to be edited in either view', async () => {
    rows = [{ ...original, id: 'pending-test' }];
    mount();
    expect(await screen.findByRole('button', { name: /Ändra registreringen/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Listvy' }));
    expect(screen.getByRole('button', { name: /Ändra registreringen/ })).toBeDisabled();
  });
});
