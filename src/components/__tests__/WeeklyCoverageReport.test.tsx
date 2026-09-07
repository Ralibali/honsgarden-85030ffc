import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({ eggs: vi.fn(), hens: vi.fn(), chores: vi.fn(), invoke: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { getEggs: mock.eggs, getHens: mock.hens, getDailyChores: mock.chores } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'test', is_premium: true } }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mock.invoke } } }));
import AIWeeklySummary from '../AIWeeklySummary';
afterEach(() => { cleanup(); vi.resetAllMocks(); });
describe('weekly report missing data', () => {
  it('shows a failed data source explicitly and never requests AI on a failed fetch', async () => {
    mock.eggs.mockRejectedValue(new Error('Offline')); mock.hens.mockResolvedValue([]); mock.chores.mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AIWeeklySummary /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Kunde inte hämta: äggregistreringar'));
    expect(screen.queryByText(/0 ägg registrerade/)).not.toBeInTheDocument(); expect(mock.invoke).not.toHaveBeenCalled();
    client.clear();
  });
  it('reports an empty log as missing days and keeps AI disabled', async () => {
    mock.eggs.mockResolvedValue([]); mock.hens.mockResolvedValue([{ is_active: true, hen_type: 'hen' }]); mock.chores.mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter><AIWeeklySummary /></MemoryRouter></QueryClientProvider>);
    await waitFor(() => expect(screen.getByText('Sammanfatta med AI')).toBeDisabled());
    expect(screen.getByText(/Saknas denna vecka:/)).toBeInTheDocument(); expect(screen.getByText(/Saknade dagar räknas inte som noll/)).toBeInTheDocument(); expect(mock.invoke).not.toHaveBeenCalled();
    client.clear();
  });
});
