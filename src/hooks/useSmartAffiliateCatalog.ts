import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { mapDatabaseProduct, mergeCatalog } from '@/lib/affiliateCatalog';
import type { SmartAffiliateProduct } from '@/lib/smartAffiliate';

export { FALLBACK_AFFILIATE_CATALOG } from '@/lib/affiliateCatalog';

const EMPTY_DATABASE_PRODUCTS: SmartAffiliateProduct[] = [];

export function useSmartAffiliateCatalog(): SmartAffiliateProduct[] {
  const { data } = useQuery({
    queryKey: ['smart-affiliate-catalog'],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('affiliate_products')
        .select('id, external_id, name, price, price_original, image_url, image_urls, product_url, affiliate_url, category, in_stock, is_active, description, short_description, specs, affiliate_advertisers(slug, name)')
        .eq('is_active', true)
        .eq('in_stock', true)
        .limit(1000);
      if (error) throw error;
      return (rows ?? [])
        .map((row) => mapDatabaseProduct(row as unknown as Record<string, any>))
        .filter((product): product is SmartAffiliateProduct => Boolean(product));
    },
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: 1,
  });

  return useMemo(
    () => mergeCatalog(data ?? EMPTY_DATABASE_PRODUCTS),
    [data],
  );
}
