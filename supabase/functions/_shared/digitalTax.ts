/** Resolve only the server-configured Swedish VAT rate; never accept tax input from a shopper. */
interface TaxRate { id: string; active: boolean; inclusive: boolean; percentage: number; country: string | null }
interface TaxClient {
  taxRates: {
    retrieve(id: string): Promise<TaxRate>;
    list(params: { active: boolean; limit: number; starting_after?: string }): Promise<{ data: TaxRate[]; has_more: boolean }>;
    create(params: { display_name: string; description: string; inclusive: boolean; percentage: number; country: string; jurisdiction: string; tax_type: 'vat' }, options: { idempotencyKey: string }): Promise<TaxRate>;
  };
}
export async function resolveDigitalTaxRate(stripe: TaxClient, product: { vatRate: number; stripeTaxRateId: string; allowedBillingCountries: string[] }): Promise<string> {
  if (![0.06, 0.25].includes(product.vatRate) || product.allowedBillingCountries.length !== 1 || product.allowedBillingCountries[0] !== 'SE') throw new Error('Unsupported digital VAT configuration');
  const percentage = product.vatRate * 100;
  const matches = (rate: TaxRate) => rate.active && rate.inclusive && rate.percentage === percentage && rate.country === 'SE';
  if (product.stripeTaxRateId) {
    const rate = await stripe.taxRates.retrieve(product.stripeTaxRateId);
    if (!matches(rate)) throw new Error('Configured VAT rate does not match product');
    return rate.id;
  }
  let cursor: string | undefined;
  for (;;) {
    const page = await stripe.taxRates.list({ active: true, limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    const rate = page.data.find(matches);
    if (rate) return rate.id;
    if (!page.has_more) break;
    const next = page.data.at(-1)?.id;
    if (!next || next === cursor) throw new Error('Incomplete VAT rate listing');
    cursor = next;
  }
  // The shared key also prevents duplicate rates from two simultaneous product checkouts.
  const created = await stripe.taxRates.create({ display_name: 'Moms', description: `Hönsgården Sverige ${percentage}% inkluderad moms`, inclusive: true, percentage, country: 'SE', jurisdiction: 'Sverige', tax_type: 'vat' }, { idempotencyKey: `honsgarden-se-vat-inclusive-${percentage}-v1` });
  if (!matches(created)) throw new Error('Stripe VAT rate verification failed');
  return created.id;
}
