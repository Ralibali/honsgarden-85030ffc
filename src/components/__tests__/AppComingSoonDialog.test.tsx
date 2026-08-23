import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import AppComingSoonDialog from '../AppComingSoonDialog';

const mockGetHens = vi.fn();
const mockGetEggs = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('@/hooks/useTracking', () => ({
  trackClick: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));
vi.mock('@/lib/api', () => ({
  api: {
    getHens: (...args: unknown[]) => mockGetHens(...args),
    getEggs: (...args: unknown[]) => mockGetEggs(...args),
  },
}));

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <AppComingSoonDialog />
    </QueryClientProvider>,
  );
}

describe('AppComingSoonDialog – PWA-prompt under onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetHens.mockReset();
    mockGetEggs.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('visas inte automatiskt innan första hönan är tillagd', async () => {
    mockGetHens.mockResolvedValue([]);
    mockGetEggs.mockResolvedValue([]);
    renderDialog();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4000);
    });

    expect(screen.queryByText(/kommer snart som app/i)).not.toBeInTheDocument();
  });

  it('visas efter aktivering när hönor och ägg finns', async () => {
    mockGetHens.mockResolvedValue([{ id: 'hen-1' }]);
    mockGetEggs.mockResolvedValue([{ id: 'egg-1' }]);
    renderDialog();

    await waitFor(() => expect(mockGetHens).toHaveBeenCalled());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3500);
    });

    expect(await screen.findByText(/kommer snart som app/i)).toBeInTheDocument();
  });
});
