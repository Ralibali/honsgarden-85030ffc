import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { selectAll } from '@/lib/selectAll';

export function useAffiliateProductNames() {
  const { data } = useQuery({
    queryKey: ['affiliate-product-names'],
    queryFn: async () => {
      const { data, error } = await selectAll(() => supabase.from('affiliate_products').select('id,name,slug,external_id').order('id'));
      if (error) throw error;
      const names = new Map<string, string>();
      for (const row of data ?? []) {
        for (const id of [row.id, row.slug, row.external_id]) if (id) names.set(id, row.name);
      }
      return names;
    },
  });
  return (id: string) => data?.get(id) ?? (/^[\da-f]{8}-[\da-f-]{27}$/i.test(id) ? 'Produktnamn saknas' : id);
}
