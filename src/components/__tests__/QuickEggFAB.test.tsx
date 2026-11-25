import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import { QuickEggFAB } from '@/components/QuickEggFAB';
import { todayLocal } from '@/lib/datetime';

const { create, checkRecords } = vi.hoisted(() => ({ create: vi.fn(), checkRecords: vi.fn(() => []) }));
vi.mock('@/lib/api', () => ({
  api: { createEggRecord: create, getHens: async () => [], getFlocks: async () => [] },
}));
vi.mock('@/lib/personalRecords', () => ({ checkPersonalRecords: checkRecords }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'member' } }) }));
vi.mock('@/components/SettingsTrustPortal', () => ({ default: () => null }));
vi.mock('@/components/EggSuccessAnimation', () => ({ EggSuccessAnimation: () => null }));

it('counts a saved quick entry once in the book and the personal record', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const day = todayLocal();
  const original = { id: 'earlier', date: day, count: 2 };
  const saved = { id: 'entry', date: day, count: 3, client_id: 'client-entry' };
  create.mockResolvedValue(saved);
  client.setQueryData(['hens'], [{ id: 'hen', is_active: true, name: 'Rut', hen_type: 'hen' }]);
  client.setQueryData(['eggs'], [original]);

  render(<MemoryRouter><QueryClientProvider client={client}><QuickEggFAB /></QueryClientProvider></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Registrera ägg (E)' }));
  fireEvent.click(screen.getByRole('button', { name: '3', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Logga 3 ägg idag' }));

  await waitFor(() => expect(checkRecords).toHaveBeenCalledWith('member', [saved, original], day));
  expect(client.getQueryData(['eggs'])).toEqual([saved, original]);
  expect(create).toHaveBeenCalledTimes(1);
});
