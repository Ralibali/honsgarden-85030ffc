import { isNativeIos } from '@/lib/nativePlatform';

export const NATIVE_IOS_PLUS_STRIPE_MESSAGE =
  'Plus on iOS is sold through StoreKit, not Stripe.';

export const NATIVE_IOS_SHOP_STRIPE_MESSAGE =
  'Shop checkout is not available in the iOS app.';

/** Adds `platform: ios` so create-checkout can reject native iOS (PR 33). */
export function checkoutBodyWithPlatform<T extends Record<string, unknown>>(
  body: T,
): T & { platform?: 'ios' } {
  return isNativeIos() ? { ...body, platform: 'ios' } : body;
}

/** Throws on Capacitor iOS so callers never start Stripe Checkout. */
export function refuseNativeIosStripeCheckout(kind: 'plus' | 'shop' = 'plus'): void {
  if (!isNativeIos()) return;
  throw new Error(kind === 'shop' ? NATIVE_IOS_SHOP_STRIPE_MESSAGE : NATIVE_IOS_PLUS_STRIPE_MESSAGE);
}
