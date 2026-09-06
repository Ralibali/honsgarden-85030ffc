import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsNativeIos = vi.fn();
const mockInvoke = vi.fn();

vi.mock('@/lib/nativePlatform', () => ({
  isNativeIos: () => mockIsNativeIos(),
  isNativePlatform: () => mockIsNativeIos(),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

import { createCheckoutSession } from '@/lib/api';
import {
  checkoutBodyWithPlatform,
  invokeCreateCheckout,
  invokeShopCheckout,
  NATIVE_IOS_PLUS_STRIPE_MESSAGE,
  NATIVE_IOS_SHOP_STRIPE_MESSAGE,
} from '@/lib/stripeCheckout';

describe('native iOS Stripe defense', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue({ data: { url: 'https://checkout.stripe.test/session' }, error: null });
  });

  it('createCheckoutSession does not call create-checkout on native iOS', async () => {
    mockIsNativeIos.mockReturnValue(true);

    await expect(createCheckoutSession({ priceId: 'price_test' })).rejects.toThrow(
      NATIVE_IOS_PLUS_STRIPE_MESSAGE,
    );

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith('create-checkout', expect.anything());
  });

  it('invokeCreateCheckout does not call create-checkout on native iOS', async () => {
    mockIsNativeIos.mockReturnValue(true);

    await expect(invokeCreateCheckout({ plan: 'monthly' })).rejects.toThrow(
      NATIVE_IOS_PLUS_STRIPE_MESSAGE,
    );

    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('tags platform: ios so a leaked create-checkout body is rejected server-side', () => {
    mockIsNativeIos.mockReturnValue(true);
    expect(checkoutBodyWithPlatform({ plan: 'yearly' })).toEqual({
      plan: 'yearly',
      platform: 'ios',
    });
  });

  it('shop checkout does not call shop-checkout on native iOS', async () => {
    mockIsNativeIos.mockReturnValue(true);

    await expect(invokeShopCheckout({ items: [{ product_id: 'p1', quantity: 1 }] })).rejects.toThrow(
      NATIVE_IOS_SHOP_STRIPE_MESSAGE,
    );

    expect(mockInvoke).not.toHaveBeenCalled();
    expect(mockInvoke).not.toHaveBeenCalledWith('shop-checkout', expect.anything());
  });

  it('createCheckoutSession still starts Stripe checkout on web', async () => {
    mockIsNativeIos.mockReturnValue(false);

    await expect(createCheckoutSession({ priceId: 'price_test' })).resolves.toEqual({
      url: 'https://checkout.stripe.test/session',
    });

    expect(mockInvoke).toHaveBeenCalledWith('create-checkout', {
      body: { priceId: 'price_test' },
    });
  });
});
