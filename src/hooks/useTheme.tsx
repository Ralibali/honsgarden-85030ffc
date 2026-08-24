import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';

export type Theme = 'light' | 'dark';

const CACHE_KEY = 'theme';

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}

/**
 * Per-user theme preference, persisted in profiles.preferences.theme so it
 * follows the user across devices. Also cached in user-scoped localStorage
 * for instant apply on next load (before the profile fetch resolves).
 */
export function useTheme(): {
  theme: Theme;
  setTheme: (t: Theme) => void;
  loaded: boolean;
} {
  const { user } = useAuth();
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'light';
    return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
  });
  const [loaded, setLoaded] = useState(false);

  // Load preference for the current user
  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setLoaded(true);
      return;
    }

    // 1. Apply user-scoped cached theme immediately
    const cached = readScoped(user.id, CACHE_KEY, false);
    if (cached === 'dark' || cached === 'light') {
      applyTheme(cached);
      setThemeState(cached);
    }

    // 2. Fetch authoritative preference from DB
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('preferences')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      const prefs = (data?.preferences ?? {}) as Record<string, any>;
      const stored = prefs.theme as Theme | undefined;
      if (stored === 'dark' || stored === 'light') {
        applyTheme(stored);
        setThemeState(stored);
        writeScoped(user.id, CACHE_KEY, stored);
      }
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const setTheme = useCallback(
    (next: Theme) => {
      applyTheme(next);
      setThemeState(next);
      if (!user?.id) return;
      writeScoped(user.id, CACHE_KEY, next);
      // Persist to DB (non-blocking)
      void (async () => {
        const { data } = await supabase
          .from('profiles')
          .select('preferences')
          .eq('user_id', user.id)
          .maybeSingle();
        const prefs = ((data?.preferences ?? {}) as Record<string, any>) || {};
        prefs.theme = next;
        await supabase.from('profiles').update({ preferences: prefs }).eq('user_id', user.id);
      })();
    },
    [user?.id],
  );

  return { theme, setTheme, loaded };
}
