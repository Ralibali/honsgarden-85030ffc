import { fireEvent, render, screen } from '@testing-library/react';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import ConfirmEmail from '../ConfirmEmail';

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { verifyOtp } } }));

function Destination() {
  const location = useLocation();
  return <p>{location.pathname + location.search}</p>;
}

afterEach(() => window.history.replaceState({}, '', '/'));

it.each([
  ['plus_annual', '/app/premium?plan=plus_annual&trial=7d'],
  ['unrecognized', '/app'],
])('restores the selected plan from confirmation in another tab (%s)', async (plan, expected) => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/auth/confirm#token_hash=confirmation&type=email');
  verifyOtp.mockResolvedValue({ data: { session: {}, user: { email_confirmed_at: '2026-11-25', user_metadata: { signup_plan: plan } } }, error: null });
  render(
    <HelmetProvider><MemoryRouter initialEntries={['/auth/confirm']}><Routes>
      <Route path="/auth/confirm" element={<ConfirmEmail />} />
      <Route path="/app/*" element={<Destination />} />
    </Routes></MemoryRouter></HelmetProvider>,
  );
  fireEvent.click(await screen.findByRole('button'));
  expect(await screen.findByText(expected)).toBeInTheDocument();
});
