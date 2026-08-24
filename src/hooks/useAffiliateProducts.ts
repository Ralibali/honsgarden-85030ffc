import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AFFILIATE_PRODUCTS, type AffiliateProduct, type AffiliateAdvertiser } from '@/data/affiliateProducts';

const ALLOWED_CATEGORIES: readonly string[] = [
  'vatten', 'foder', 'vaerme', 'hus', 'klackning', 'staengsel', 'redskap', 'tillskott', 'startset',
];

function normalizeAdvertiser(slug?: string | null): AffiliateAdvertiser {
  return slug === 'bonden' ? 'bonden' : 'p-lindberg';
}

function normalizeCategory(c?: string | null): AffiliateProduct['category'] {
  return (ALLOWED_CATEGORIES.includes(c ?? '') ? c : 'redskap') as AffiliateProduct['category'];
}

/** Plockar ut cupa_sku ur en tracking-URL så vi kan matcha mot DB-katalogens external_id. */
export function skuFromTrackingUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.match(/cupa_sku=([^&]+)/)?.[1] ?? null;
}

/**
 * Hämtar aktiva produkter i lager från affiliate_products (DB-katalogen som
 * feed-synken fyller). Mappar till samma form som AFFILIATE_PRODUCTS.
 */
export function useAffiliateProducts(enabled = true) {
  return useQuery({
    queryKey: ['affiliate-products-db'],
    enabled,
    queryFn: async (): Promise<AffiliateProduct[]> => {
      const { data, error } = await supabase
        .from('affiliate_products')
        .select(
          'external_id, name, price, price_original, image_url, image_urls, product_url, affiliate_url, category, in_stock, is_active, affiliate_advertisers(slug)',
        )
        .eq('is_active', true)
        .eq('in_stock', true)
        .limit(500);
      if (error) throw error;

      return ((data ?? []) as any[])
        .map((r): AffiliateProduct => ({
          id: r.external_id ?? String(r.id ?? ''),
          advertiser: normalizeAdvertiser(r.affiliate_advertisers?.slug),
          name: r.name ?? '',
          price: r.price ?? '',
          imageUrl: r.image_url ?? r.image_urls?.[0] ?? '',
          trackingUrl: r.affiliate_url ?? r.product_url ?? '',
          productUrl: r.product_url ?? undefined,
          keywords: [],
          category: normalizeCategory(r.category),
          inStock: r.in_stock !== false,
          priceOriginal: typeof r.price_original === 'number' ? r.price_original : undefined,
        }))
        .filter((p) => p.name && p.imageUrl && p.trackingUrl);
    },
    staleTime: 10 * 60_000,
  });
}

/** DB-katalogen om den har produkter, annars den statiska listan. */
export function useCatalog(enabled = true): AffiliateProduct[] {
  const { data } = useAffiliateProducts(enabled);
  return useMemo(() => (data && data.length > 0 ? data : AFFILIATE_PRODUCTS), [data]);
}

/** Map från SKU → live-produkt (för att overlaya färskt pris/lager på den statiska listan). */
export function useLiveBySku(enabled = true): Map<string, AffiliateProduct> {
  const { data } = useAffiliateProducts(enabled);
  return useMemo(() => new Map((data ?? []).map((p) => [p.id, p])), [data]);
}

/** Heltal ur prissträng "1 175 kr" → 1175 (för rea-jämförelse). */
export function priceToNumber(price: string | null | undefined): number | null {
  if (!price) return null;
  const digits = price.replace(/[^\d]/g, '');
  return digits ? Number(digits) : null;
}
