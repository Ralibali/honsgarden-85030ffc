import { supabase } from '@/integrations/supabase/client';
import { isNativeAndroid } from '@/lib/nativePlatform';
import type { StoreKitProduct } from '@/lib/appleIapClient';
import type { Product } from '@capgo/native-purchases';

export const GOOGLE_PLAY_PRODUCT_ID = 'honsgarden_plus';
export type GooglePlayPlan = 'monthly' | 'yearly';

/** The plugin returns the base plan in identifier and the product in planIdentifier. */
export function selectGoogleBasePlan(products: Product[], plan: GooglePlayPlan): Product | undefined {
  return products.find((p) => p.planIdentifier === GOOGLE_PLAY_PRODUCT_ID
    && p.identifier === plan && !p.offerId && !!p.offerToken && !!p.priceString?.trim());
}

export async function googleAccountId(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`honsgarden:${userId.toLowerCase()}`));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function isGoogleBillingAvailable(): Promise<boolean> {
  if (!isNativeAndroid()) return false;
  try {
    const { NativePurchases } = await import('@capgo/native-purchases');
    return !!(await NativePurchases.isBillingSupported()).isBillingSupported;
  } catch { return false; }
}

async function queryProducts() {
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  return NativePurchases.getProducts({ productIdentifiers: [GOOGLE_PLAY_PRODUCT_ID], productType: PURCHASE_TYPE.SUBS });
}

export async function loadGooglePlayProducts(): Promise<StoreKitProduct[]> {
  if (!isNativeAndroid()) return [];
  const { products } = await queryProducts();
  return (['monthly', 'yearly'] as const).flatMap((plan) => {
    const product = selectGoogleBasePlan(products, plan);
    return product ? [{ id: GOOGLE_PLAY_PRODUCT_ID, plan, title: product.title,
      description: product.description, priceString: product.priceString }] : [];
  });
}

export class GooglePurchasePending extends Error {
  constructor() { super('Google Play behandlar betalningen. Plus aktiveras när betalningen har bekräftats.'); }
}

export async function purchaseGooglePlayPlan(plan: GooglePlayPlan, userId: string): Promise<string> {
  // ProductDetails/offer tokens must be fresh when opening Google's purchase sheet.
  const { products } = await queryProducts();
  const product = selectGoogleBasePlan(products, plan);
  if (!product) throw new Error('Priset kunde inte hämtas från Google Play. Försök igen.');
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  const purchase = await NativePurchases.purchaseProduct({
    productIdentifier: GOOGLE_PLAY_PRODUCT_ID,
    planIdentifier: plan,
    offerToken: product.offerToken,
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: await googleAccountId(userId),
    autoAcknowledgePurchases: false,
  });
  if (purchase.purchaseState !== '1') throw new GooglePurchasePending();
  if (!purchase.purchaseToken) throw new Error('Google Play returnerade inget köp att verifiera.');
  return purchase.purchaseToken;
}

export async function restoreGooglePlayTransactions(): Promise<string[]> {
  const { NativePurchases, PURCHASE_TYPE } = await import('@capgo/native-purchases');
  const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS });
  return [...new Set(purchases.filter((p) => p.productIdentifier === GOOGLE_PLAY_PRODUCT_ID
    && p.purchaseState === '1').map((p) => p.purchaseToken).filter((token): token is string => !!token))];
}

export async function openGooglePlaySubscriptions(): Promise<void> {
  const { NativePurchases } = await import('@capgo/native-purchases');
  await NativePurchases.manageSubscriptions();
}

export async function syncGooglePlayTransactions(purchaseTokens: string[]): Promise<{
  subscribed: boolean; subscription_end: string | null;
}> {
  // Only the server may grant access and acknowledge a verified purchase.
  const { data, error } = await supabase.functions.invoke('verify-google-subscription', { body: { purchaseTokens } });
  if (error || data?.error) {
    throw new Error('Köpet kunde inte bekräftas just nu. Försök med Återställ köp igen.');
  }
  return { subscribed: data?.subscribed === true, subscription_end: data?.subscription_end ?? null };
}
