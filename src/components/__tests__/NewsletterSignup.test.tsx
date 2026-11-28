import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import NewsletterSignup from '../NewsletterSignup';

const { insert, errorToast } = vi.hoisted(() => ({ insert: vi.fn(), errorToast: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert }) } }));
vi.mock('sonner', () => ({ toast: { error: errorToast, success: vi.fn() } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('lets a reader retry the same address after a network failure', async () => {
  insert.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ error: null });
  render(<NewsletterSignup />);
  fireEvent.change(screen.getByRole('textbox', { name: 'E-postadress' }), { target: { value: 'Test@Example.com' } });
  const submit = screen.getByRole('button', { name: 'Prenumerera' });
  fireEvent.click(submit);
  await waitFor(() => expect(errorToast).toHaveBeenCalled());
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  expect(await screen.findByRole('status')).toHaveTextContent('Tack');
  expect(insert).toHaveBeenLastCalledWith({ email: 'test@example.com' });
});
