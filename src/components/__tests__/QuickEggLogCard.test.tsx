import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import QuickEggLogCard from '../dashboard/QuickEggLogCard';
import { todayLocal } from '@/lib/datetime';

const mockCreate = vi.fn();
const mockDelete = vi.fn();
const mockToast = vi.fn();
const mockTrack = vi.fn();

vi.mock('@/lib/api', () => ({
  api: {
    createEggRecord: (...args: unknown[]) => mockCreate(...args),
    deleteEggRecord: (...args: unknown[]) => mockDelete(...args),
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: unknown[]) => mockToast(...args) }));
vi.mock('@/lib/analytics', () => ({ trackFirstEggIfNew: (...args: unknown[]) => mockTrack(...args) }));

function renderCard(todayEggs: number, ids: string[] = []) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <QuickEggLogCard todayEggs={todayEggs} todayEggRowIds={ids} />
    </QueryClientProvider>,
  );
}

describe('QuickEggLogCard – äggloggning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({});
    mockDelete.mockResolvedValue({});
  });

  it('loggar ett ägg med dagens datum när man trycker på plus', async () => {
    renderCard(2, ['id-1', 'id-2']);
    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));

    await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
    expect(mockCreate).toHaveBeenCalledWith({ date: todayLocal(), count: 1 });
    await waitFor(() => expect(mockToast).toHaveBeenCalledWith({ title: '🥚 +1 ägg loggat' }));
    expect(mockTrack).toHaveBeenCalledWith('quick_log_card');
  });

  it('minus är avaktiverad när det inte finns några ägg idag', () => {
    renderCard(0, []);
    expect(screen.getByLabelText('Ta bort ett ägg')).toBeDisabled();
  });

  it('tar bort senaste ägget när man trycker på minus', async () => {
    renderCard(3, ['id-senast', 'id-aldre']);
    fireEvent.click(screen.getByLabelText('Ta bort ett ägg'));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledTimes(1));
    expect(mockDelete).toHaveBeenCalledWith('id-senast');
  });

  it('visar feltoast om loggningen misslyckas', async () => {
    mockCreate.mockRejectedValue(new Error('nätverksfel'));
    renderCard(0, []);
    fireEvent.click(screen.getByLabelText('Lägg till ett ägg'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Fel', variant: 'destructive' }),
      ),
    );
  });
});
