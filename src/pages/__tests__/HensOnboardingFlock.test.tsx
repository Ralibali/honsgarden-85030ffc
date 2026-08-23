import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import Hens from '../Hens';

const mockGetHens = vi.fn();
const mockGetFlocks = vi.fn();
const mockCreateHen = vi.fn();
const mockGetOrCreateDefaultFlock = vi.fn();
const mockCreateFlock = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/components/HenAvatar', () => ({
  default: () => <div data-testid="hen-avatar" />,
}));
vi.mock('@/lib/api', () => ({
  api: {
    getHens: (...args: unknown[]) => mockGetHens(...args),
    getFlocks: (...args: unknown[]) => mockGetFlocks(...args),
    createHen: (...args: unknown[]) => mockCreateHen(...args),
    getOrCreateDefaultFlock: (...args: unknown[]) => mockGetOrCreateDefaultFlock(...args),
    createFlock: (...args: unknown[]) => mockCreateFlock(...args),
    updateHen: vi.fn(),
    deleteHen: vi.fn(),
    deleteFlock: vi.fn(),
    updateCoopSettings: vi.fn(),
  },
}));

function renderHens(initialEntry = '/app/hens') {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Hens />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Hens – onboarding-vald flock följer med första hönan', () => {
  beforeEach(() => {
    localStorage.clear();
    mockGetHens.mockReset();
    mockGetFlocks.mockReset();
    mockCreateHen.mockReset();
    mockGetOrCreateDefaultFlock.mockReset();
    mockCreateFlock.mockReset();
    mockGetHens.mockResolvedValue([]);
    mockGetFlocks.mockResolvedValue([{ id: 'flock-honsuset', name: 'Hönshuset' }]);
    mockCreateHen.mockResolvedValue({ id: 'hen-1' });
    mockGetOrCreateDefaultFlock.mockResolvedValue({ id: 'flock-min', name: 'Min flock' });
  });

  it('placerar första hönan i den flock användaren skapat, inte i Min flock', async () => {
    renderHens();

    const addButtons = await screen.findAllByRole('button', { name: 'Lägg till' });
    fireEvent.click(addButtons[0]);
    fireEvent.change(await screen.findByPlaceholderText(/Greta/i), { target: { value: 'Blanka' } });
    fireEvent.click(screen.getByRole('button', { name: /Lägg till höna/i }));

    await waitFor(() => expect(mockCreateHen).toHaveBeenCalledTimes(1));
    expect(mockCreateHen).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Blanka', flock_id: 'flock-honsuset' }),
    );
    expect(mockGetOrCreateDefaultFlock).not.toHaveBeenCalled();
  });

  it('öppnar flock-dialogen från onboarding-CTA', async () => {
    renderHens('/app/hens?create=flock');
    expect(await screen.findByPlaceholderText(/Stora hönsgården/i)).toBeInTheDocument();
  });
});
