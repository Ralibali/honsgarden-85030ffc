import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Premium from '@/pages/Premium';

const mockInvoke = vi.fn();
const mockToast = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: unknown[]) => mockToast(...args) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', premium_type: null }, refreshSubscription: vi.fn() }),
}));
vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/hooks/useTracking', () => ({ trackClick: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));
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
});
