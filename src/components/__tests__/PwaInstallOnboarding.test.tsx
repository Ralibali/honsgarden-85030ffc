import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PwaInstallOnboarding from '../PwaInstallOnboarding';

const mockGetHens = vi.fn();
const mockGetEggs = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, loading: false }),
}));
vi.mock('@/hooks/useTracking', () => ({
  trackClick: vi.fn(),
}));
vi.mock('@/lib/api', () => ({
  api: {
    getHens: (...args: unknown[]) => mockGetHens(...args),
    getEggs: (...args: unknown[]) => mockGetEggs(...args),
  },
}));

function renderPrompt() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PwaInstallOnboarding />
    </QueryClientProvider>,
  );
}

describe('PwaInstallOnboarding – gated under onboarding', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockGetHens.mockReset();
    mockGetEggs.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('öppnas inte medan onboarding fortfarande är aktiv', async () => {
    mockGetHens.mockResolvedValue([]);
    mockGetEggs.mockResolvedValue([]);
    renderPrompt();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2500);
    });

    expect(screen.queryByText(/Installera Hönsgården på din mobil/i)).not.toBeInTheDocument();
  });

  it('får öppnas efter att första hönan och ägget finns', async () => {
    mockGetHens.mockResolvedValue([{ id: 'hen-1' }]);
    mockGetEggs.mockResolvedValue([{ id: 'egg-1' }]);
    renderPrompt();

    await waitFor(() => expect(mockGetHens).toHaveBeenCalled());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(await screen.findByText(/Installera Hönsgården på din mobil/i)).toBeInTheDocument();
  });
});
