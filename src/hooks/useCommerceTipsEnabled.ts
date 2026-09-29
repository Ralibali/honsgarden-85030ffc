import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

/**
 * Användarens val i Inställningar → "Säsongsanpassade produkttips".
 * Gäller alla produkttips i appen. Fail-closed: inga tips visas förrän
 * preferensen är laddad, och inte heller om den inte går att läsa.
 * Settings uppdaterar samma query-nyckel direkt när reglaget ändras.
 */
export function useCommerceTipsEnabled(): boolean {
  const { user } = useAuth();
  const { data = false } = useQuery({
    queryKey: ['commerce-tip-preference', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      const prefs = (
        data?.preferences && typeof data.preferences === 'object'
          ? data.preferences
          : {}
      ) as Record<string, unknown>;
      return prefs.commerce_tips_enabled !== false;
    },
    staleTime: 10 * 60_000,
  });
  return Boolean(user?.id) && data;
}
