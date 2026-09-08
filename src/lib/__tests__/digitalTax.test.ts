import { describe, expect, it, vi } from 'vitest';
import { resolveDigitalTaxRate } from '../../../supabase/functions/_shared/digitalTax';
const valid = { id: 'txr_verified', active: true, inclusive: true, percentage: 25, country: 'SE' };
const product = { vatRate: .25, stripeTaxRateId: '', allowedBillingCountries: ['SE'] };
const client = () => ({ taxRates: { retrieve: vi.fn().mockResolvedValue(valid), list: vi.fn().mockResolvedValue({data: [], has_more: false}), create: vi.fn().mockResolvedValue(valid) } });
describe('verified Swedish VAT before payment', () => {
  it('reuses a matching rate after paginating past incorrect rates', async () => {
    const stripe = client(); stripe.taxRates.list.mockResolvedValueOnce({data:[{...valid,id:'txr_exclusive',inclusive:false}],has_more:true}).mockResolvedValueOnce({data:[valid],has_more:false});
    expect(await resolveDigitalTaxRate(stripe, product)).toBe(valid.id);
    expect(stripe.taxRates.list).toHaveBeenLastCalledWith({ active: true, limit: 100, starting_after: 'txr_exclusive' });
    expect(stripe.taxRates.create).not.toHaveBeenCalled();
  });
  it('creates only the fixed inclusive rate with a shared idempotency key', async () => {
    const stripe = client(); expect(await resolveDigitalTaxRate(stripe, product)).toBe(valid.id);
    expect(stripe.taxRates.create).toHaveBeenCalledWith(expect.objectContaining({percentage:25,inclusive:true,country:'SE',tax_type:'vat'}),{idempotencyKey:'honsgarden-se-vat-inclusive-25-v1'});
  });
  it.each([{active:false},{inclusive:false},{percentage:6},{country:'NO'}])('rejects a configured rate mismatch %j', async difference => {
    const stripe = client(); stripe.taxRates.retrieve.mockResolvedValue({...valid,...difference});
    await expect(resolveDigitalTaxRate(stripe,{...product,stripeTaxRateId:valid.id})).rejects.toThrow();
    expect(stripe.taxRates.create).not.toHaveBeenCalled();
  });
  it('stops when Stripe is unavailable and never falls back to zero tax', async () => {
    const stripe=client(); stripe.taxRates.list.mockRejectedValue(new Error('Stripe unavailable'));
    await expect(resolveDigitalTaxRate(stripe, product)).rejects.toThrow('Stripe unavailable'); expect(stripe.taxRates.create).not.toHaveBeenCalled();
  });
  it('rejects unsupported jurisdiction before calling Stripe', async () => {
    const stripe=client(); await expect(resolveDigitalTaxRate(stripe,{...product,allowedBillingCountries:['SE','NO']})).rejects.toThrow(); expect(stripe.taxRates.list).not.toHaveBeenCalled();
  });
});
