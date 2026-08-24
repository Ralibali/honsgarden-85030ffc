import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { todayLocal } from '@/lib/datetime';

export interface ActiveKarens {
  id: string;
  title: string;
  hen_id: string | null;
  flock_id: string | null;
  egg_safe_from: string; // YYYY-MM-DD
  days_left: number;
}

export function useActiveKarens() {
  return useQuery<ActiveKarens[]>({
    queryKey: ['active-karens'],
    queryFn: async () => {
      const today = todayLocal();
      const { data, error } = await (supabase
        .from('health_events') as any)
        .select('id, title, hen_id, flock_id, egg_safe_from')
        .gte('egg_safe_from', today)
        .order('egg_safe_from', { ascending: true });
      if (error) throw error;
      const t = new Date(today).getTime();
      return ((data ?? []) as any[]).map((e) => ({
        ...e,
        days_left: Math.max(0, Math.round((new Date(e.egg_safe_from).getTime() - t) / 86400000)),
      })) as ActiveKarens[];
    },
    staleTime: 60_000,
  });
}
