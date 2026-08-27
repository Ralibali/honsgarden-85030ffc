export const IOS_BUNDLE_ID = 'se.honsgarden.app';

export const APPLE_IAP_PRODUCTS = {
  monthly: 'se.honsgarden.plus.monthly',
  yearly: 'se.honsgarden.plus.yearly',
} as const;

export const APPLE_IAP_PRODUCT_IDS = [
  APPLE_IAP_PRODUCTS.monthly,
  APPLE_IAP_PRODUCTS.yearly,
] as const;

export type AppleIapPlan = keyof typeof APPLE_IAP_PRODUCTS;

export function planFromProductId(productId: string): AppleIapPlan | null {
  if (productId === APPLE_IAP_PRODUCTS.monthly) return 'monthly';
  if (productId === APPLE_IAP_PRODUCTS.yearly) return 'yearly';
  return null;
}

export function isKnownAppleProductId(productId: string): boolean {
  return planFromProductId(productId) !== null;
}
