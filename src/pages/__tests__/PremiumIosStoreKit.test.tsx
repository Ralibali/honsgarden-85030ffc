import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Premium from '@/pages/Premium';
import svPremium from '@/i18n/locales/sv/premium.json';

const mockInvoke = vi.fn();
const mockPurchase = vi.fn();
const mockRestore = vi.fn();
const mockSync = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', premium_type: 'free' }, refreshSubscription: vi.fn() }),
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
vi.mock('@/lib/nativePlatform', () => ({
  isNativeIos: () => true,
  isNativePlatform: () => true,
}));
vi.mock('@/lib/appleIapClient', () => ({
  isIosBillingAvailable: () => Promise.resolve(true),
  loadStoreKitProducts: () => Promise.resolve([
    { id: 'se.honsgarden.plus.monthly', plan: 'monthly', title: 'Plus', description: '', priceString: '39 kr' },
    { id: 'se.honsgarden.plus.yearly', plan: 'yearly', title: 'Plus år', description: '', priceString: '299 kr' },
  ]),
  purchaseStoreKitPlan: (...args: unknown[]) => mockPurchase(...args),
  restoreStoreKitTransactions: (...args: unknown[]) => mockRestore(...args),
  syncAppleTransactions: (...args: unknown[]) => mockSync(...args),
  openAppStoreSubscriptions: vi.fn(),
}));

function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((acc, part) => {
    if (acc && typeof acc === 'object' && part in acc) return (acc as Record<string, unknown>)[part];
    return undefined;
  }, svPremium);
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { returnObjects?: boolean; count?: number; brand?: string }) => {
      const value = lookup(key);
      if (opts?.returnObjects) return Array.isArray(value) ? value : [];
      if (typeof value !== 'string') return key;
      return value
        .replace('{{count}}', String(opts?.count ?? ''))
        .replace('{{brand}}', opts?.brand ?? 'Hönsgården');
    },
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

describe('Premium – iOS StoreKit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPurchase.mockResolvedValue('signed.jws.token');
    mockRestore.mockResolvedValue(['signed.jws.token']);
    mockSync.mockResolvedValue({ subscribed: true, subscription_end: '2026-09-27T00:00:00.000Z' });
  });

  it('does not start Stripe checkout on iOS and uses StoreKit instead', async () => {
    renderPremium();
    await waitFor(() => expect(screen.getByText('39 kr')).toBeInTheDocument());
    fireEvent.click(screen.getByText(svPremium.plans.monthly.cta));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('monthly', 'user-1'));
    expect(mockInvoke).not.toHaveBeenCalledWith('create-checkout', expect.anything());
    expect(screen.queryByText(svPremium.trust.stripe)).not.toBeInTheDocument();
    expect(screen.getByText(svPremium.ios.restore)).toBeInTheDocument();
  });
});
