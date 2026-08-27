import { APPLE_IAP_PRODUCT_IDS, APPLE_IAP_PRODUCTS, type AppleIapPlan } from '@/lib/appleIap';
import { isNativeIos } from '@/lib/nativePlatform';
import { supabase } from '@/integrations/supabase/client';
import type { Transaction } from '@capgo/native-purchases';

export type StoreKitProduct = {
  id: string;
  plan: AppleIapPlan;
  title: string;
  description: string;
  priceString: string;
};

function productPlan(id: string): AppleIapPlan | null {
  if (id === APPLE_IAP_PRODUCTS.monthly) return 'monthly';
  if (id === APPLE_IAP_PRODUCTS.yearly) return 'yearly';
  return null;
}

async function loadPlugin() {
  const mod = await import('@capgo/native-purchases');
  return mod;
}

export async function isIosBillingAvailable(): Promise<boolean> {
  if (!isNativeIos()) return false;
  try {
    const { NativePurchases } = await loadPlugin();
    const { isBillingSupported } = await NativePurchases.isBillingSupported();
    return !!isBillingSupported;
  } catch {
    return false;
  }
}

export async function loadStoreKitProducts(): Promise<StoreKitProduct[]> {
  if (!isNativeIos()) return [];
  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();
  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [...APPLE_IAP_PRODUCT_IDS],
    productType: PURCHASE_TYPE.SUBS,
  });
  return (products ?? [])
    .map((product) => {
      const plan = productPlan(product.identifier);
      if (!plan) return null;
      return {
        id: product.identifier,
        plan,
        title: product.title,
        description: product.description,
        priceString: product.priceString,
      } satisfies StoreKitProduct;
    })
    .filter((product): product is StoreKitProduct => !!product);
}

export async function purchaseStoreKitPlan(plan: AppleIapPlan, userId: string): Promise<string> {
  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();
  const result = await NativePurchases.purchaseProduct({
    productIdentifier: APPLE_IAP_PRODUCTS[plan],
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: userId,
  });
  const jws = result.jwsRepresentation;
  if (!jws) throw new Error('StoreKit returned no signed transaction');
  return jws;
}

export async function restoreStoreKitTransactions(): Promise<string[]> {
  const { NativePurchases, PURCHASE_TYPE } = await loadPlugin();
  await NativePurchases.restorePurchases();
  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
  });
  return (purchases ?? [])
    .map((purchase: Transaction) => purchase.jwsRepresentation)
    .filter((jws): jws is string => typeof jws === 'string' && jws.length > 0);
}

export async function openAppStoreSubscriptions(): Promise<void> {
  const { NativePurchases } = await loadPlugin();
  await NativePurchases.manageSubscriptions();
}

export async function syncAppleTransactions(jwsList: string[]): Promise<{
  subscribed: boolean;
  subscription_end: string | null;
}> {
  const { data, error } = await supabase.functions.invoke('verify-apple-subscription', {
    body: { transactions: jwsList.map((jws) => ({ jws })) },
  });
  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.message || data.error);
  return {
    subscribed: !!data?.subscribed,
    subscription_end: data?.subscription_end ?? null,
  };
}
