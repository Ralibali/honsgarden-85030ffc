import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type DashboardLayout = {
  order: string[];
  hidden: string[];
};

const DEFAULT_LAYOUT: DashboardLayout = { order: [], hidden: [] };

/**
 * Manages the user's preferred dashboard widget order + hidden widgets.
 * Stored in profiles.preferences.dashboard_layout (jsonb).
 * Premium-only feature, but the hook is safe for everyone (returns defaults).
 */
export function useDashboardLayout(allWidgetIds: string[]) {
  const { user } = useAuth();
  const [layout, setLayout] = useState<DashboardLayout>(DEFAULT_LAYOUT);
  const [loaded, setLoaded] = useState(false);

  // Load preferences
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoaded(true);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const prefs = (data?.preferences ?? {}) as any;
      const stored = prefs.dashboard_layout as DashboardLayout | undefined;
      if (stored && Array.isArray(stored.order)) {
        setLayout({
          order: stored.order.filter((id) => allWidgetIds.includes(id)),
          hidden: Array.isArray(stored.hidden) ? stored.hidden.filter((id) => allWidgetIds.includes(id)) : [],
        });
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, allWidgetIds.join('|')]);

  const save = useCallback(
    async (next: DashboardLayout) => {
      setLayout(next);
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();
      const prefs = ((data?.preferences ?? {}) as any) || {};
      prefs.dashboard_layout = next;
      await supabase.from('profiles').update({ preferences: prefs }).eq('user_id', user.id);
    },
    [user?.id]
  );

  // Resolve final order: stored first, then any new widgets appended in default order
  const resolvedOrder = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const id of layout.order) {
      if (allWidgetIds.includes(id) && !seen.has(id)) {
        out.push(id);
        seen.add(id);
      }
    }
    for (const id of allWidgetIds) {
      if (!seen.has(id)) {
        out.push(id);
        seen.add(id);
      }
    }
    return out;
  })();

  const isHidden = (id: string) => layout.hidden.includes(id);

  return {
    loaded,
    layout: { order: resolvedOrder, hidden: layout.hidden },
    isHidden,
    setOrder: (order: string[]) => save({ ...layout, order }),
    toggleHidden: (id: string) => {
      const hidden = layout.hidden.includes(id)
        ? layout.hidden.filter((x) => x !== id)
        : [...layout.hidden, id];
      save({ order: resolvedOrder, hidden });
    },
    reset: () => save(DEFAULT_LAYOUT),
  };
}
