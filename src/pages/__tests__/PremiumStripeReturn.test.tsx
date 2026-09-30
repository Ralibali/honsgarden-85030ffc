import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Premium from '@/pages/Premium';

const mockInvoke = vi.fn();
const mockToast = vi.fn();
const mockRefreshSubscription = vi.fn();
const mockTrackEvent = vi.fn();
const mockReplace = vi.fn();
const originalLocation = Object.getOwnPropertyDescriptor(window, 'location')!;

function translate(key: string, options?: { returnObjects?: boolean }) {
  return options?.returnObjects ? [] : key;
}

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => mockInvoke(...args) } },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: (...args: unknown[]) => mockToast(...args) }));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', premium_type: 'trial' },
    refreshSubscription: mockRefreshSubscription,
  }),
}));
vi.mock('@/hooks/useSeo', () => ({ useSeo: vi.fn() }));
vi.mock('@/hooks/useTracking', () => ({ trackClick: vi.fn() }));
vi.mock('@/lib/analytics', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/analytics')>(),
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));
vi.mock('@/lib/nativePlatform', () => ({
  isNativeIos: () => false,
  isNativeAndroid: () => false,
  isNativePlatform: () => false,
}));
vi.mock('@/components/premium/PremiumValueStats', () => ({ default: () => null }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: translate, i18n: { language: 'sv' } }),
}));

async function renderReturn() {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={['/app/premium?success=true&session_id=cs_return']}>
        <Premium />
      </MemoryRouter>,
    );
  });
}

describe('Premium – Stripe return confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockReset();
    vi.useFakeTimers();
    mockRefreshSubscription.mockResolvedValue(undefined);
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, replace: mockReplace },
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    Object.defineProperty(window, 'location', originalLocation);
  });

  it.each([
    { subscribed: true, premium_type: 'trial' },
    { subscribed: false, premium_type: 'free' },
    { subscribed: true, premium_type: 'paid', source: 'apple' },
    { subscribed: true, premium_type: 'paid', source: 'google' },
    { subscribed: true, premium_type: 'lifetime' },
  ])('keeps polling for Stripe payment when existing access is $premium_type/$source', async (existingAccess) => {
    mockInvoke
      .mockResolvedValueOnce({ data: existingAccess, error: null })
      .mockResolvedValueOnce({
        data: { subscribed: true, premium_type: 'paid', source: 'stripe', billing_interval: 'yearly' },
        error: null,
      });

    await renderReturn();

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockRefreshSubscription).not.toHaveBeenCalled();
    expect(mockToast).not.toHaveBeenCalled();
    expect(mockTrackEvent).not.toHaveBeenCalledWith('Premium Purchased', expect.anything());
    expect(mockReplace).not.toHaveBeenCalled();

    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });

    expect(mockInvoke).toHaveBeenCalledTimes(2);
    expect(mockRefreshSubscription).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith({
      title: 'toasts.welcome_title', description: 'toasts.welcome_desc',
    });
    expect(mockTrackEvent).toHaveBeenCalledWith('Premium Purchased', {
      plan: 'plus', billing_interval: 'yearly',
    });
    expect(mockReplace).toHaveBeenCalledWith('/app/premium');
  });

  it('accepts the existing Stripe backend response without a source field', async () => {
    mockInvoke.mockResolvedValue({
      data: { subscribed: true, premium_type: 'paid' }, error: null,
    });

    await renderReturn();

    expect(mockRefreshSubscription).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({ title: 'toasts.welcome_title' }));
    expect(mockReplace).toHaveBeenCalledWith('/app/premium');
  });
});
