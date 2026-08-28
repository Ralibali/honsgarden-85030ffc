import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DEMO_USER_PROFILE } from '@/lib/demoData';
import { resolvePremiumType, type PremiumType } from '@/lib/premiumStatus';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  is_premium?: boolean;
  subscription_status?: string;
  subscription_end?: string | null;
  premium_type?: PremiumType;
  stripe_price_id?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (mode?: 'login' | 'register') => Promise<void>;
  register: (email: string, password: string, name: string, meta?: Record<string, any>) => Promise<any>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refreshSubscription: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const SYNC_INTERVAL_MS = 60_000;
const CHECK_SUBSCRIPTION_TIMEOUT_MS = 8_000;
const PRIVATE_CACHE_NAMES = ['supabase-rest', 'supabase-storage'];
const GLOBAL_QUERY_CACHE_KEY = 'honsgarden_rq_cache_v1';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('check-subscription timeout')), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

async function clearPrivateClientCaches(): Promise<void> {
  try {
    localStorage.removeItem(GLOBAL_QUERY_CACHE_KEY);
    sessionStorage.removeItem('_track_sid');
  } catch {
    // Private browsing or blocked storage.
  }

  try {
    if ('caches' in window) {
      await Promise.all(PRIVATE_CACHE_NAMES.map((cacheName) => caches.delete(cacheName)));
    }
  } catch {
    // Cache cleanup is best effort.
  }

  try {
    navigator.serviceWorker?.controller?.postMessage({ type: 'CLEAR_PRIVATE_CACHES' });
  } catch {
    // Service worker may not be active yet.
  }
}

function toBasicProfile(supaUser: SupabaseUser): UserProfile {
  return {
    id: supaUser.id,
    email: supaUser.email ?? '',
    name: supaUser.user_metadata?.name ?? '',
    is_premium: false,
    subscription_status: 'free',
    premium_type: 'free',
  };
}

async function syncSubscriptionStatus(): Promise<{ subscribed: boolean; subscriptionEnd: string | null; premiumType: PremiumType | null; priceId: string | null; synced: boolean; userMissing?: boolean }> {
  try {
    const { data, error } = await withTimeout(supabase.functions.invoke('check-subscription'), CHECK_SUBSCRIPTION_TIMEOUT_MS);
    if (error) {
      const msg = (error.message || '') + ' ' + JSON.stringify((error as any).context ?? {});
      if (/User from sub claim in JWT does not exist/i.test(msg)) {
        return { subscribed: false, subscriptionEnd: null, premiumType: null, priceId: null, synced: false, userMissing: true };
      }
      console.warn('[Auth] check-subscription error:', error.message);
      return { subscribed: false, subscriptionEnd: null, premiumType: null, priceId: null, synced: false };
    }

    return {
      subscribed: !!data?.subscribed,
      subscriptionEnd: data?.subscription_end ?? data?.subscriptionEnd ?? null,
      premiumType: data?.premium_type ?? null,
      priceId: data?.price_id ?? null,
      synced: true,
    };
  } catch (err) {
    console.warn('[Auth] check-subscription failed:', err);
    return { subscribed: false, subscriptionEnd: null, premiumType: null, priceId: null, synced: false };
  }
}

async function buildProfile(
  supaUser: SupabaseUser,
  options: { sync?: boolean } = {},
): Promise<UserProfile | null> {
  const doSync = options.sync !== false;
  let subscribed = false;
  let subscriptionEnd: string | null = null;
  let syncedPremiumType: PremiumType | null = null;
  let syncedPriceId: string | null = null;
  let synced = false;

  if (doSync) {
    const res = await syncSubscriptionStatus();
    if (res.userMissing) {
      try { await supabase.auth.signOut(); } catch { /* ignore */ }
      await clearPrivateClientCaches();
      return null;
    }
    subscribed = res.subscribed;
    subscriptionEnd = res.subscriptionEnd;
    syncedPremiumType = res.premiumType;
    syncedPriceId = res.priceId;
    synced = res.synced;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, subscription_status, premium_expires_at, is_lifetime_premium')
    .eq('user_id', supaUser.id)
    .maybeSingle();

  const hasLifetimePremium = profile?.is_lifetime_premium === true;
  const premiumType = resolvePremiumType({
    isLifetime: hasLifetimePremium,
    profileExpiry: profile?.premium_expires_at ?? null,
    synced,
    subscribed,
    syncedPremiumType,
    subscriptionEnd,
  });

  const isPremium = premiumType !== 'free';
  const resolvedSubscriptionEnd = premiumType === 'lifetime'
    ? null
    : subscriptionEnd ?? profile?.premium_expires_at ?? null;

  return {
    id: supaUser.id,
    email: supaUser.email ?? '',
    name: profile?.display_name ?? supaUser.user_metadata?.name ?? '',
    is_premium: isPremium,
    subscription_status: isPremium ? 'premium' : 'free',
    subscription_end: resolvedSubscriptionEnd,
    premium_type: premiumType,
    stripe_price_id: syncedPriceId,
  };
}

/** Local profile first so a 7-day signup trial is visible even if Stripe hangs. */
async function hydratePremiumProfile(
  supaUser: SupabaseUser,
  apply: (profile: UserProfile | null) => void,
  options: { sync?: boolean } = {},
): Promise<UserProfile | null> {
  const local = await buildProfile(supaUser, { sync: false });
  apply(local);
  if (options.sync === false) return local;
  const synced = await buildProfile(supaUser, { sync: true });
  apply(synced);
  return synced;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserRef = useRef<SupabaseUser | null>(null);
  const profileReadyRef = useRef(false);

  const startPeriodicSync = useCallback((supaUser: SupabaseUser) => {
    if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
    currentUserRef.current = supaUser;

    syncIntervalRef.current = setInterval(async () => {
      if (!currentUserRef.current || !profileReadyRef.current) return;
      try {
        const profile = await buildProfile(currentUserRef.current);
        setUser(profile);
      } catch {
        // Non-blocking periodic sync.
      }
    }, SYNC_INTERVAL_MS);
  }, []);

  const stopPeriodicSync = useCallback(() => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
      syncIntervalRef.current = null;
    }
    currentUserRef.current = null;
    profileReadyRef.current = false;
  }, []);

  const refreshSubscription = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      await hydratePremiumProfile(session.user, setUser);
    }
  }, []);

  const reloadProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const profile = await buildProfile(session.user, { sync: false });
      if (profile) setUser(profile);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const applySession = (session: Session | null, hydrateProfile: boolean) => {
      const supaUser = session?.user ?? null;
      if (!supaUser) {
        if (isMounted) setUser(null);
        stopPeriodicSync();
        return;
      }

      if (isMounted) setUser(toBasicProfile(supaUser));
      if (!hydrateProfile) return;

      // Sync profile from auth metadata (fills Google name/avatar on every login, never overwrites edits)
      void (async () => {
        try { await supabase.rpc('sync_profile_from_auth' as any); } catch { /* non-blocking */ }
      })();

      profileReadyRef.current = false;
      void hydratePremiumProfile(supaUser, (profile) => {
        if (!isMounted) return;
        setUser(profile);
        if (!profileReadyRef.current) {
          profileReadyRef.current = true;
          startPeriodicSync(supaUser);
        }
      }).catch(() => {
        if (isMounted) {
          profileReadyRef.current = true;
          startPeriodicSync(supaUser);
        }
      });
    };

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!isMounted) return;
        applySession(session, true);
        setLoading(false);
      })
      .catch(() => {
        if (!isMounted) return;
        setUser(null);
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      if (event === 'SIGNED_OUT') {
        setUser(null);
        stopPeriodicSync();
        void clearPrivateClientCaches();
        setLoading(false);
        return;
      }

      if (event === 'SIGNED_IN') {
        void import('@/lib/analytics').then(({ maybeTrackAuthSignup }) => {
          maybeTrackAuthSignup(event, session?.user);
        });
      }

      const shouldHydrateProfile = event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'USER_UPDATED';
      applySession(session, shouldHydrateProfile);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      stopPeriodicSync();
      subscription.unsubscribe();
    };
  }, [startPeriodicSync, stopPeriodicSync]);

  const loginWithGoogle = async (mode: 'login' | 'register' = 'login') => {
    const { trackEvent } = await import('@/lib/analytics');
    trackEvent('OAuth Started', { provider: 'google', mode });
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/app`,
      },
    });
    if (error) throw error;
  };

  const login = async (email: string, password: string) => {
    await clearPrivateClientCaches();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    if (data.user) {
      setUser(toBasicProfile(data.user));
      profileReadyRef.current = false;
      void hydratePremiumProfile(data.user, (profile) => {
        setUser(profile);
        if (!profileReadyRef.current) {
          profileReadyRef.current = true;
          startPeriodicSync(data.user);
        }
      }).catch(() => {
        profileReadyRef.current = true;
      });
    }
  };

  const register = async (email: string, password: string, name: string, meta?: Record<string, any>) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name, ...(meta ?? {}) } },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const logout = async () => {
    stopPeriodicSync();
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      await clearPrivateClientCaches();
    }

    try {
      const keysToRemove = Object.keys(localStorage).filter((key) =>
        key.startsWith('sb-') ||
        key.startsWith('supabase') ||
        key === 'theme' ||
        key === '_track_sid' ||
        key === GLOBAL_QUERY_CACHE_KEY
      );
      keysToRemove.forEach((key) => localStorage.removeItem(key));
      Object.keys(localStorage)
        .filter((key) => key.startsWith('honsgarden-') && !key.startsWith('honsgarden-imported'))
        .forEach((key) => localStorage.removeItem(key));
      // Användarspecifika u:<id>:*-preferenser behålls och kan inte läsas av andra konton.
    } catch {
      // Private browsing.
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginWithGoogle, register, logout, isAuthenticated: !!user, refreshSubscription, reloadProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

/**
 * Ger /demo en fiktiv premium-användare utan riktig inloggning,
 * så att demon kan visa hela produkten med exempeldata.
 */
// eslint-disable-next-line react-refresh/only-export-components
export function DemoAuthProvider({ children }: { children: React.ReactNode }) {
  const demoValue: AuthContextType = {
    user: DEMO_USER_PROFILE,
    loading: false,
    isAuthenticated: true,
    login: async () => {},
    loginWithGoogle: async () => {},
    register: async () => ({}),
    logout: async () => {},
    refreshSubscription: async () => {},
    reloadProfile: async () => {},
  };
  return <AuthContext.Provider value={demoValue}>{children}</AuthContext.Provider>;
}
