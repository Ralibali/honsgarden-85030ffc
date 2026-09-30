import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { FunctionsHttpError } from '@supabase/supabase-js';
import Premium from '@/pages/Premium';

const mockInvoke = vi.fn();
const mockToast = vi.fn();
const mockLogClientError = vi.fn();
const mockRefreshSession = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    auth: { refreshSession: (...args: unknown[]) => mockRefreshSession(...args) },
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: unknown[]) => mockToast(...args) }));
vi.mock('@/lib/errorLogger', () => ({ logClientError: (...args: unknown[]) => mockLogClientError(...args) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', premium_type: null }, refreshSubscription: vi.fn() }),
}));
vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/hooks/useTracking', () => ({ trackClick: vi.fn() }));
vi.mock('@/lib/analytics', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/analytics')>(), trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    getEggs: vi.fn().mockResolvedValue([]),
    getHens: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { returnObjects?: boolean }) => (opts?.returnObjects ? [] : key),
    i18n: { language: 'sv' },
  }),
}));

function renderPremium() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/app/premium']}>
        <Premium />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Premium – checkout-flöde', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
    mockRefreshSession.mockReset();
    mockInvoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/session' }, error: null });
  });

  it('startar Stripe-checkout med rätt plan när man väljer månadsvis', async () => {
    renderPremium();
    fireEvent.click(screen.getByText('plans.monthly.cta'));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('create-checkout', { body: { plan: 'monthly' } }),
    );
  });

  it('startar Stripe-checkout med årsplan', async () => {
    renderPremium();
    fireEvent.click(screen.getByText('plans.yearly.cta'));

    await waitFor(() =>
      expect(mockInvoke).toHaveBeenCalledWith('create-checkout', { body: { plan: 'yearly' } }),
    );
  });

  it('visar feltoast om checkout-funktionen svarar med fel', async () => {
    mockInvoke.mockResolvedValue({ data: { error: 'stripe_not_configured' }, error: null });
    renderPremium();
    fireEvent.click(screen.getByText('plans.monthly.cta'));

    await waitFor(() =>
      expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' })),
    );
  });

  it('bevarar serverns feltext, sparar felsökningskontext och låter kunden försöka igen', async () => {
    mockInvoke.mockResolvedValue({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({
        error: 'price_unavailable', message: 'Det valda priset är inte tillgängligt.',
      }), { status: 500, headers: { 'Content-Type': 'application/json' } })),
    });
    renderPremium();
    const button = screen.getByText('plans.monthly.cta');
    fireEvent.click(button);

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Det valda priset är inte tillgängligt.',
      variant: 'destructive',
    })));
    expect(mockLogClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Det valda priset är inte tillgängligt.' }),
      { context: { source: 'plus_checkout', plan: 'monthly', httpStatus: 500 } },
    );
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    await waitFor(() => expect(mockInvoke).toHaveBeenCalledTimes(2));
  });

  it('förnyar en avvisad inloggning en gång och visar serverns fel om det nya försöket misslyckas', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({ message: 'Invalid JWT' }), { status: 401 })),
    }).mockResolvedValueOnce({
      data: null,
      error: new FunctionsHttpError(new Response(JSON.stringify({
        code: 'BOOT_ERROR', message: 'Betalningstjänsten är tillfälligt otillgänglig.',
      }), { status: 503 })),
    });
    mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'test-refreshed-token' } }, error: null });
    renderPremium();
    const button = screen.getByText('plans.yearly.cta');
    fireEvent.click(button);

    await waitFor(() => expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      description: 'Betalningstjänsten är tillfälligt otillgänglig.', variant: 'destructive',
    })));
    expect(mockRefreshSession).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockInvoke).toHaveBeenLastCalledWith('create-checkout', {
      body: { plan: 'yearly' }, headers: { Authorization: 'Bearer test-refreshed-token' },
    });
    expect(mockLogClientError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Betalningstjänsten är tillfälligt otillgänglig.' }),
      { context: { source: 'plus_checkout', plan: 'yearly', httpStatus: 503, errorCode: 'BOOT_ERROR' } },
    );
    expect(button).not.toBeDisabled();
  });
});
