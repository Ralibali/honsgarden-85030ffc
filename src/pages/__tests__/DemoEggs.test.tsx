import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import DemoApp from '@/pages/DemoApp';

const from = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from } }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

it('keeps the dashboard, backfill form and updated egg history in one demo session', async () => {
  render(
    <MemoryRouter initialEntries={['/demo']}>
      <Routes><Route path="/demo" element={<DemoApp />} /></Routes>
    </MemoryRouter>,
  );

  const initial = await screen.findByRole('button', { name: /^\d+ ägg idag/ });
  const total = Number(initial.textContent?.match(/^\d+/)?.[0]);
  fireEvent.click(await screen.findByRole('link', { name: 'Logga en annan dag' }));
  fireEvent.change(await screen.findByLabelText('Antal ägg', { exact: true }), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: 'Spara 3 ägg' }));
  await screen.findByText('Visa alla dagar');

  fireEvent.click(screen.getByRole('link', { name: 'Idag', exact: true }));
  expect(await screen.findByRole('button', { name: new RegExp(`^${total + 3} ägg idag`) })).toBeVisible();
  fireEvent.click(screen.getByRole('link', { name: 'Historik' }));
  expect(await screen.findByRole('heading', { name: 'Historik' })).toBeVisible();
  const nav = screen.getByRole('navigation', { name: 'Prova appen' });
  expect(within(nav).getByRole('link', { name: 'Äggbok' })).toHaveAttribute('aria-current', 'page');
  expect(from).not.toHaveBeenCalled();
}, 15_000);
