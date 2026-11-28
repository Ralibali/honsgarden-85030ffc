import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { recordRecoveryUser } from '@/lib/resetPasswordLink';
import ResetPassword from '@/pages/ResetPassword';

const getSession = vi.fn();
const updateUser = vi.fn();
const verifyOtp = vi.fn();
const unsubscribe = vi.fn();
let authCallback: ((event: string) => void) | null = null;

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (event: string) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe } } };
      },
      getSession: (...args: unknown[]) => getSession(...args),
      verifyOtp: (...args: unknown[]) => verifyOtp(...args),
      updateUser: (...args: unknown[]) => updateUser(...args),
    },
  },
}));

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/reset-password']}>
      <ResetPassword />
    </MemoryRouter>,
  );
}

function setLocation(path: string) {
  window.history.replaceState({}, '', path);
}

describe('ResetPassword – tom och giltig länk', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordRecoveryUser('SIGNED_OUT');
    authCallback = null;
    getSession.mockResolvedValue({ data: { session: null } });
    setLocation('/reset-password');
  });

  afterEach(() => {
    setLocation('/reset-password');
  });

  it('visar felstate direkt utan token i stället för att hänga på Verifierar länk', () => {
    renderPage();

    expect(screen.getByText('Länken saknas eller är ogiltig')).toBeInTheDocument();
    expect(screen.queryByText('Verifierar länk…')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Begär en ny återställningslänk' })).toHaveAttribute(
      'href',
      '/login?mode=forgot',
    );
    expect(getSession).not.toHaveBeenCalled();
  });

  it('visar felstate direkt när recovery-länken har error i hashen', () => {
    setLocation('/reset-password#error=access_denied&error_code=otp_expired');
    renderPage();

    expect(screen.getByText('Länken saknas eller är ogiltig')).toBeInTheDocument();
    expect(screen.queryByText('Verifierar länk…')).not.toBeInTheDocument();
    expect(getSession).not.toHaveBeenCalled();
  });

  it('väntar på verifiering när en recovery-hash finns', () => {
    setLocation('/reset-password#access_token=tok_123&type=recovery');
    renderPage();

    expect(screen.getByText('Verifierar länk…')).toBeInTheDocument();
    expect(screen.queryByText('Länken saknas eller är ogiltig')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Nytt lösenord')).not.toBeInTheDocument();
  });

  it('visar formuläret efter PASSWORD_RECOVERY när token finns', async () => {
    setLocation('/reset-password?code=pkce-code');
    renderPage();

    expect(screen.getByText('Verifierar länk…')).toBeInTheDocument();
    expect(authCallback).toBeTypeOf('function');

    await act(async () => {
      authCallback?.('PASSWORD_RECOVERY');
    });

    expect(screen.getByLabelText('Nytt lösenord')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Uppdatera lösenord' })).toBeInTheDocument();
    expect(screen.queryByText('Verifierar länk…')).not.toBeInTheDocument();
  });

  it('verifierar token_hash innan formuläret visas', async () => {
    verifyOtp.mockResolvedValue({ data: { session: { user: { id: 'member' } } }, error: null });
    setLocation('/reset-password?token_hash=th_1&type=recovery');
    renderPage();
    expect(await screen.findByLabelText('Nytt lösenord')).toBeInTheDocument();
    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'th_1', type: 'recovery' });
    expect(window.location.search).toBe('');
  });

  it('visar fel när tokenverifieringen misslyckas', async () => {
    verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'Expired' } });
    setLocation('/reset-password?token_hash=th_1&type=recovery');
    renderPage();
    expect(await screen.findByText('Länken saknas eller är ogiltig')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nytt lösenord')).not.toBeInTheDocument();
  });

  it('klarar att Supabase redan har verifierat och rensat webbadressen före renderingen', async () => {
    recordRecoveryUser('PASSWORD_RECOVERY', 'member');
    getSession.mockResolvedValue({ data: { session: { user: { id: 'member' } } } });
    renderPage();
    expect(await screen.findByLabelText('Nytt lösenord')).toBeInTheDocument();
  });
});
