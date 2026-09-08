import { describe, expect, it, vi } from 'vitest';
import { DIGITAL_PRODUCT_CATALOG, getPublicDigitalProduct } from '../digitalProducts';
import { getDigitalProduct, isDigitalProductReady, vatBreakdown } from '../../../supabase/functions/_shared/digitalProduct';
import { sendDigitalReceipt } from '../../../supabase/functions/_shared/digitalReceipt';

describe('digital product delivery contract', () => {
  it.each(Object.values(DIGITAL_PRODUCT_CATALOG))('$slug has matching public and private product details', product => {
    const server = getDigitalProduct(product.slug)!;
    expect(server.amountOre).toBe(product.price * 100);
    expect(server.vatRate * 100).toBe(product.vatPercent);
    expect(server.totalPages).toBe(product.pages);
    expect(server.samplePages).toBe(product.samplePages);
    expect(server.deliveryPath).toBe(`/guider/${product.slug}/hamta`);
    expect(server.bucket).toBe('digital-products');
    expect(server.objectPath).not.toContain('samples/');
  });
  it('rejects unknown and prototype product names', () => {
    for (const slug of ['__proto__', 'constructor', 'toString', 'unknown', null]) {
      expect(getPublicDigitalProduct(slug)).toBeNull();
      expect(getDigitalProduct(slug)).toBeNull();
    }
  });
  it('only permits supported server configurations before resolving a verified tax rate', () => {
    const original = getDigitalProduct('mina-forsta-hons')!;
    expect(isDigitalProductReady(original)).toBe(true);
    expect(isDigitalProductReady({ ...original, stripeTaxRateId: '' })).toBe(true);
    expect(isDigitalProductReady({ ...original, vatRate: 0 })).toBe(false);
    expect(isDigitalProductReady({ ...original, allowedBillingCountries: ['US'] })).toBe(false);
    expect(isDigitalProductReady({ ...original, stripeTaxRateId: 'invalid' })).toBe(false);
    expect(isDigitalProductReady({ ...original, stripePriceId: '' })).toBe(false);
  });
  it('calculates inclusive VAT without changing the advertised customer amount', () => {
    expect(vatBreakdown(17900, .06)).toEqual({ netOre: 16887, vatOre: 1013 });
    expect(vatBreakdown(12900, .06)).toEqual({ netOre: 12170, vatOre: 730 });
    expect(vatBreakdown(14900, .25)).toEqual({ netOre: 11920, vatOre: 2980 });
    expect(vatBreakdown(9900, .25)).toEqual({ netOre: 7920, vatOre: 1980 });
  });
  it.each(Object.values(DIGITAL_PRODUCT_CATALOG))('$slug receives its own name, VAT and delivery link in the receipt', async product => {
    const server = getDigitalProduct(product.slug)!;
    const rpc = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    await expect(sendDigitalReceipt({ rpc }, { id: 'test-order', order_number: 'HG-TEST', customer_email: 'test@example.se', amount_ore: server.amountOre, vat_rate: server.vatRate, consent_terms_version: server.termsVersion, consent_at: null, paid_at: null }, server)).resolves.toEqual({ ok: true, queued: true });
    const payload = rpc.mock.calls[0][1].p_payload;
    expect(payload.to).toBe('test@example.se');
    expect(payload.subject).toContain(server.name);
    expect(payload.text).toContain(server.name);
    expect(payload.html).toContain(server.name);
    expect(payload.html).toContain(`${product.pages} sidor`);
    expect(payload.text).toContain(`${product.vatPercent}%`);
    expect(payload.text).toContain(`https://honsgarden.se${server.deliveryPath}?t=`);
    if (product.slug !== 'mina-forsta-hons') expect(payload.text + payload.html).not.toContain('Mina första höns');
  });
});
