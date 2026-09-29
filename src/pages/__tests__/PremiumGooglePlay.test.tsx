import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Premium from '@/pages/Premium';
import svPremium from '@/i18n/locales/sv/premium.json';

const mockInvoke = vi.fn();
const mockPurchase = vi.fn();
const mockRestore = vi.fn();
const mockSync = vi.fn();
const mockLoadProducts = vi.fn();
const mockBillingSupported = vi.fn();
const products = [
  { id: 'se.honsgarden.plus.monthly', plan: 'monthly', title: 'Plus', description: '', priceString: '39 kr' },
  { id: 'se.honsgarden.plus.yearly', plan: 'yearly', title: 'Plus år', description: '', priceString: '299 kr' },
];

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-1', premium_type: 'free' }, refreshSubscription: vi.fn() }),
}));
vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/hooks/useTracking', () => ({ trackClick: vi.fn() }));
vi.mock('@/lib/analytics', async (importOriginal) => ({ ...await importOriginal<typeof import('@/lib/analytics')>(), trackEvent: vi.fn() }));
vi.mock('@/lib/api', () => ({
  api: {
    getEggs: () => Promise.resolve([]),
    getHens: () => Promise.resolve([]),
  },
}));
vi.mock('@/lib/nativePlatform', () => ({
  isNativeIos: () => false,
  isNativeAndroid: () => true,
  isNativePlatform: () => true,
}));
vi.mock('@/lib/googlePlayClient', () => ({
  isGoogleBillingAvailable: () => mockBillingSupported(),
  loadGooglePlayProducts: () => mockLoadProducts(),
  purchaseGooglePlayPlan: (...args: unknown[]) => mockPurchase(...args),
  restoreGooglePlayTransactions: (...args: unknown[]) => mockRestore(...args),
  syncGooglePlayTransactions: (...args: unknown[]) => mockSync(...args),
  openGooglePlaySubscriptions: vi.fn(),
  GooglePurchasePending: class extends Error {},
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

describe('Premium – Android Google Play', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLoadProducts.mockReset().mockResolvedValue(products);
    mockBillingSupported.mockReset().mockResolvedValue(true);
    mockPurchase.mockResolvedValue('signed.jws.token');
    mockRestore.mockResolvedValue(['signed.jws.token']);
    mockSync.mockResolvedValue({ subscribed: true, subscription_end: '2026-09-27T00:00:00.000Z' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('does not start Stripe checkout on Android and uses Google Play instead', async () => {
    renderPremium();
    await waitFor(() => expect(screen.getByText('39 kr')).toBeInTheDocument());
    fireEvent.click(screen.getByText(svPremium.plans.monthly.cta));

    await waitFor(() => expect(mockPurchase).toHaveBeenCalledWith('monthly', 'user-1'));
    expect(mockInvoke).not.toHaveBeenCalledWith('create-checkout', expect.anything());
    expect(screen.queryByText(svPremium.trust.stripe)).not.toBeInTheDocument();
    expect(screen.getByText(svPremium.android.restore)).toBeInTheDocument();
  });

  it('shows loading text and prevents checkout until Google supplies a price', () => {
    mockLoadProducts.mockReturnValue(new Promise(() => {}));
    renderPremium();
    expect(screen.getAllByText(svPremium.android.loading_price)).toHaveLength(2);
    expect(screen.queryByText('—')).not.toBeInTheDocument();
    expect(screen.queryByText('39 kr')).not.toBeInTheDocument();
    const checkout = screen.getByRole('button', { name: svPremium.plans.monthly.cta });
    expect(checkout).toBeDisabled();
    fireEvent.click(checkout);
    expect(mockPurchase).not.toHaveBeenCalled();
  });

  it.each(['empty', 'error', 'unsupported'] as const)('offers a working retry when the catalog is %s', async (failure) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    if (failure === 'empty') mockLoadProducts.mockResolvedValueOnce([]);
    if (failure === 'error') mockLoadProducts.mockRejectedValueOnce(new Error('Offline'));
    if (failure === 'unsupported') mockBillingSupported.mockResolvedValueOnce(false);
    renderPremium();

    const retry = await screen.findByRole('button', { name: svPremium.android.retry_prices });
    expect(screen.getByText(svPremium.android.products_unavailable)).toBeInTheDocument();
    expect(screen.getAllByText(svPremium.android.price_unavailable)).toHaveLength(2);
    expect(screen.queryByText('39 kr')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: svPremium.plans.monthly.cta })).toBeDisabled();
    expect(screen.getByRole('button', { name: svPremium.android.restore })).toBeEnabled();

    fireEvent.click(retry);
    await screen.findByText('39 kr');
    expect(screen.getByRole('button', { name: svPremium.plans.monthly.cta })).toBeEnabled();
    expect(screen.queryByText(svPremium.android.products_unavailable)).not.toBeInTheDocument();
  });

  it('only allows plans with a usable Google Play price when the catalog is incomplete', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockLoadProducts.mockResolvedValue([products[0], { ...products[1], priceString: ' ' }]);
    renderPremium();
    await screen.findByText('39 kr');
    expect(screen.getByRole('button', { name: svPremium.plans.monthly.cta })).toBeEnabled();
    expect(screen.getByRole('button', { name: svPremium.plans.yearly.cta })).toBeDisabled();
    expect(screen.getByText(svPremium.android.price_unavailable)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: svPremium.android.retry_prices })).toBeEnabled();
  });

  it('recovers from a stalled request and ignores its late result after retry', async () => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let finishOldRequest!: (value: typeof products) => void;
    mockLoadProducts.mockReturnValueOnce(new Promise((resolve) => { finishOldRequest = resolve; }));
    const view = renderPremium();
    await act(async () => {});
    await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
    expect(screen.getAllByText(svPremium.android.price_unavailable)).toHaveLength(2);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: svPremium.android.retry_prices })); });
    expect(screen.getByText('39 kr')).toBeInTheDocument();
    await act(async () => { finishOldRequest([]); });
    expect(screen.getByText('39 kr')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: svPremium.plans.monthly.cta })).toBeEnabled();
    view.unmount();
  });
});
