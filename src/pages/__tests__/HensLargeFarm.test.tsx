import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Hens from '@/pages/Hens';

const mocks = vi.hoisted(() => ({ getHens: vi.fn(), createHen: vi.fn(), createHens: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: {
  getHens: mocks.getHens, createHen: mocks.createHen, createHens: mocks.createHens,
  getFlocks: async () => [{ id: 'flock', name: 'Stora gården' }],
  getOrCreateDefaultFlock: async () => ({ id: 'flock' }),
  updateCoopSettings: async () => ({}),
} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackFirstHenIfNew: vi.fn() }));
vi.mock('@/components/HenAvatar', () => ({ default: () => null }));

const hen = (i: number, extra: Record<string, unknown> = {}) => ({
  id: `hen-${i}`, name: `Höna ${String(i).padStart(3, '0')}`, breed: 'Leghorn', color: null, is_active: true,
  hen_type: 'hen', flock_id: 'flock', birth_date: null, notes: null, image_url: null, ...extra,
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><Hens /></MemoryRouter></QueryClientProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getHens.mockResolvedValue([...Array.from({ length: 150 }, (_, i) => hen(i + 1)), hen(151, { name: 'Greta', breed: 'Brahma' })]);
  mocks.createHens.mockImplementation(async (_shared: unknown, names: string[]) => names.length);
});

describe('hens page for large farms', () => {
  it('renders large flocks in steps and can show more', async () => {
    mount();
    expect(await screen.findByText('Visa fler (91 kvar)')).toBeInTheDocument();
    expect(screen.getByText('Visar 60 av 151')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Visa fler (91 kvar)' }));
    expect(screen.getByText('Visar 120 av 151')).toBeInTheDocument();
  });

  it('searches by name and breed', async () => {
    mount();
    const search = await screen.findByRole('searchbox', { name: 'Sök bland hönorna' });
    fireEvent.change(search, { target: { value: 'brahma' } });
    expect(screen.getByText('Greta')).toBeInTheDocument();
    expect(screen.queryByText('Höna 001')).not.toBeInTheDocument();
    fireEvent.change(search, { target: { value: 'ingen sådan' } });
    expect(screen.getByText(/Ingen höna matchar/)).toBeInTheDocument();
  });

  it('adds a numbered batch that continues after existing hens', async () => {
    mount();
    await screen.findByText('Visar 60 av 151');
    fireEvent.click(screen.getAllByRole('button', { name: /Lägg till/ })[0]);
    fireEvent.change(await screen.findByLabelText('Antal'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Namn (numreras) *'), { target: { value: 'Höna' } });
    expect(screen.getByText(/Skapar 3 st: Höna 151 … Höna 153/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Lägg till 3 st' }));
    await waitFor(() => expect(mocks.createHens).toHaveBeenCalledTimes(1));
    const [shared, names] = mocks.createHens.mock.calls[0];
    expect(names).toEqual(['Höna 151', 'Höna 152', 'Höna 153']);
    expect(shared).toMatchObject({ hen_type: 'hen', flock_id: 'flock' });
    expect(shared).not.toHaveProperty('name');
    expect(mocks.createHen).not.toHaveBeenCalled();
  });
});
