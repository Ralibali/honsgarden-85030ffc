import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';
import { resetSignupTrackingForTests } from '@/lib/analytics';

const login = vi.fn();
const register = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    login: (...args: unknown[]) => login(...args),
    register: (...args: unknown[]) => register(...args),
    isAuthenticated: false,
    loading: false,
  }),
}));

vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/lib/api', () => ({ api: { updateCoopSettings: vi.fn() } }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn(),
    auth: { resetPasswordForEmail: vi.fn() },
  },
}));
vi.mock('@/components/GoogleAuthButton', () => ({
  default: () => <div data-testid="google-auth" />,
  AuthDivider: () => <div />,
}));
vi.mock('@/components/AppleAuthButton', () => ({
  default: () => <div data-testid="apple-auth" />,
}));
vi.mock('@/components/CountrySelect', () => ({
  CountrySelect: () => <div data-testid="country-select" />,
}));

import Login from '@/pages/Login';

const CREATED = '2026-08-28T16:00:00.000Z';

function newEmailUser() {
  return {
    id: 'user-register-1',
    created_at: CREATED,
    last_sign_in_at: null,
    identities: [{ provider: 'email', created_at: CREATED, last_sign_in_at: null }],
  };
}

function renderLogin(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/app" element={<p>Din hönsgård</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function signupCalls(plausible: ReturnType<typeof vi.fn>) {
  return plausible.mock.calls.filter((call) => call[0] === 'Signup Completed');
}

describe('Login – Signup fires only when an account is created', () => {
  const plausible = vi.fn();

  beforeEach(() => {
    resetSignupTrackingForTests();
    localStorage.clear();
    login.mockReset();
    register.mockReset();
    plausible.mockReset();
    vi.mocked(toast).mockClear();
    window.analyticsEvent = plausible;
    login.mockResolvedValue(undefined);
    register.mockResolvedValue({ user: newEmailUser(), session: null });
  });

  afterEach(() => {
    resetSignupTrackingForTests();
    localStorage.clear();
    delete window.analyticsEvent;
  });

  it('fires Signup Completed once after a successful email register', async () => {
    renderLogin('/login?mode=register');

    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('E-post'), { target: { value: 'ada@example.se' } });
    fireEvent.change(screen.getByLabelText('Lösenord'), { target: { value: 'hemligt12' } });
    fireEvent.click(screen.getByLabelText(/Jag godkänner/));

    fireEvent.click(screen.getByRole('button', { name: /Skapa konto/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(signupCalls(plausible)).toHaveLength(1);
    });
    expect(plausible).toHaveBeenCalledWith('Signup Completed', {
      props: { source: 'signup_form' },
    });
  });

  it('does not fire Signup Completed on a successful email login', async () => {
    renderLogin('/login?mode=login');

    fireEvent.change(screen.getByLabelText('E-post'), { target: { value: 'ada@example.se' } });
    fireEvent.change(screen.getByLabelText('Lösenord'), { target: { value: 'hemligt12' } });
    fireEvent.click(screen.getByRole('button', { name: /Logga in/i }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledTimes(1);
    });
    expect(signupCalls(plausible)).toHaveLength(0);
  });

  it('takes an auto-confirmed new member directly into the app', async () => {
    register.mockResolvedValue({ user: newEmailUser(), session: { access_token: 'test-session' } });
    renderLogin('/login?mode=register');
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('E-post'), { target: { value: 'ada@example.se' } });
    fireEvent.change(screen.getByLabelText('Lösenord'), { target: { value: 'hemligt12' } });
    fireEvent.click(screen.getByLabelText(/Jag godkänner/));
    fireEvent.click(screen.getByRole('button', { name: /Skapa konto/i }));
    expect(await screen.findByText('Din hönsgård')).toBeInTheDocument();
    expect(signupCalls(plausible)).toHaveLength(1);
  });

  it.each(['confirmation', 'existing account'])('explains the next step without claiming success for %s without a session', async (kind) => {
    const user = newEmailUser();
    register.mockResolvedValue({ user: kind === 'confirmation' ? user : { ...user, identities: [] }, session: null });
    renderLogin('/login?mode=register');
    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('E-post'), { target: { value: 'ada@example.se' } });
    fireEvent.change(screen.getByLabelText('Lösenord'), { target: { value: 'hemligt12' } });
    fireEvent.click(screen.getByLabelText(/Jag godkänner/));
    fireEvent.click(screen.getByRole('button', { name: /Skapa konto/i }));
    expect(await screen.findByRole('status')).toHaveTextContent('Kontrollera din inkorg');
    expect(screen.getByLabelText('Lösenord')).toHaveValue('');
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'Konto skapat!' }));
    expect(signupCalls(plausible)).toHaveLength(kind === 'confirmation' ? 1 : 0);
  });

  it('does not fire Signup Completed when register fails or no account was created', async () => {
    register.mockRejectedValueOnce(new Error('Registrering misslyckades'));
    renderLogin('/login?mode=register');

    fireEvent.change(screen.getByLabelText('Namn'), { target: { value: 'Ada' } });
    fireEvent.change(screen.getByLabelText('E-post'), { target: { value: 'ada@example.se' } });
    fireEvent.change(screen.getByLabelText('Lösenord'), { target: { value: 'hemligt12' } });
    fireEvent.click(screen.getByLabelText(/Jag godkänner/));
    fireEvent.click(screen.getByRole('button', { name: /Skapa konto/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledTimes(1);
    });
    expect(signupCalls(plausible)).toHaveLength(0);

    register.mockResolvedValueOnce({
      user: { id: 'existing', created_at: CREATED, identities: [] },
      session: null,
    });
    fireEvent.click(screen.getByRole('button', { name: /Skapa konto/i }));

    await waitFor(() => {
      expect(register).toHaveBeenCalledTimes(2);
    });
    expect(signupCalls(plausible)).toHaveLength(0);
  });
});
