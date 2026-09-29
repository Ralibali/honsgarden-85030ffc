import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { googleAccountId, loadGooglePlayProducts, purchaseGooglePlayPlan, restoreGooglePlayTransactions, syncGooglePlayTransactions, GooglePurchasePending } from '../googlePlayClient';

const mocks = vi.hoisted(() => ({ products: vi.fn(), purchase: vi.fn(), purchases: vi.fn(), invoke: vi.fn() }));
vi.mock('@/lib/nativePlatform', () => ({ isNativeAndroid: () => true }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));
vi.mock('@capgo/native-purchases', () => ({ PURCHASE_TYPE: { SUBS: 'subs' }, NativePurchases: {
  getProducts: mocks.products, purchaseProduct: mocks.purchase, getPurchases: mocks.purchases,
} }));
const base = { identifier: 'monthly', planIdentifier: 'honsgarden_plus', offerToken: 'current-offer',
  title: 'Plus', description: 'Monthly', priceString: '39 kr' };

describe('Google Play billing boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('crypto', webcrypto);
    mocks.products.mockResolvedValue({ products: [base] });
    mocks.purchase.mockResolvedValue({ purchaseState: '1', purchaseToken: 'verified-on-server' });
  });
  it('shows only regular plans belonging to this product, never a trial offer price', async () => {
    mocks.products.mockResolvedValue({ products: [
      { ...base, offerId: 'free-trial', priceString: '0 kr' },
      { ...base, planIdentifier: 'another_app', identifier: 'yearly' }, base,
    ] });
    expect(await loadGooglePlayProducts()).toEqual([expect.objectContaining({ plan: 'monthly', priceString: '39 kr' })]);
  });
  it('passes fresh base-plan details and an obfuscated account; server acknowledges after validation', async () => {
    await purchaseGooglePlayPlan('monthly', 'USER-ID');
    expect(mocks.products).toHaveBeenCalledOnce();
    expect(mocks.purchase).toHaveBeenCalledWith(expect.objectContaining({
      productIdentifier: 'honsgarden_plus', planIdentifier: 'monthly', offerToken: 'current-offer',
      appAccountToken: await googleAccountId('user-id'), autoAcknowledgePurchases: false,
    }));
    expect(await googleAccountId('USER-ID')).toMatch(/^[0-9a-f]{64}$/);
  });
  it('never treats a pending payment as completed', async () => {
    mocks.purchase.mockResolvedValue({ purchaseState: '2', purchaseToken: 'pending' });
    await expect(purchaseGooglePlayPlan('monthly', 'u')).rejects.toBeInstanceOf(GooglePurchasePending);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
  it('restores only purchased Plus tokens and removes duplicates', async () => {
    const purchased = { productIdentifier: 'honsgarden_plus', purchaseState: '1', purchaseToken: 'a' };
    mocks.purchases.mockResolvedValue({ purchases: [purchased, purchased,
      { ...purchased, purchaseState: '2', purchaseToken: 'b' },
      { ...purchased, productIdentifier: 'unrelated', purchaseToken: 'c' }] });
    expect(await restoreGooglePlayTransactions()).toEqual(['a']);
  });
  it('fails closed when server verification fails', async () => {
    mocks.invoke.mockResolvedValue({ data: null, error: new Error('unavailable') });
    await expect(syncGooglePlayTransactions(['a'])).rejects.toThrow(/bekräftas/);
    expect(mocks.invoke).toHaveBeenCalledWith('verify-google-subscription', { body: { purchaseTokens: ['a'] } });
  });
});
