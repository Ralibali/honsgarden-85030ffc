import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

interface UserProfile {
  id: string;
  email: string;
  name?: string;
  is_premium?: boolean;
  subscription_status?: string;
  subscription_end?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<any>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SYNC_INTERVAL_MS = 60_000;

function toBasicProfile(supaUser: SupabaseUser): UserProfile {
  return {
    id: supaUser.id,
    email: supaUser.email ?? '',
    name: supaUser.user_metadata?.name ?? '',
    is_premium: false,
    subscription_status: 'free',
  };
}

async function syncSubscriptionStatus(): Promise<{ subscribed: boolean; subscriptionEnd: string | null; synced: boolean }> {
  try {
    const { data, error } = await supabase.functions.invoke('check-subscription');
    if (error) {
      console.warn('[Auth] check-subscription error:', error.message);
      return { subscribed: false, subscriptionEnd: null, synced: false };
    }

    return {
      subscribed: !!data?.subscribed,
      subscriptionEnd: data?.subscription_end ?? data?.subscriptionEnd ?? null,
      synced: true,
    };
  } catch (err) {
    console.warn('[Auth] check-subscription failed:', err);
    return { subscribed: false, subscriptionEnd: null, synced: false };
  }
}

async function buildProfile(supaUser: SupabaseUser): Promise<UserProfile> {
  const { subscribed, subscriptionEnd, synced } = await syncSubscriptionStatus();

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, subscription_status, premium_expires_at')
    .eq('user_id', supaUser.id)
    .maybeSingle();

  const now = new Date();
  const profileExpiryDate = profile?.premium_expires_at ? new Date(profile.premium_expires_at) : null;
  const syncedExpiryDate = subscriptionEnd ? new Date(subscriptionEnd) : null;
  const hasValidProfileExpiry = !!profileExpiryDate && profileExpiryDate > now;
  const hasValidSyncedExpiry = !!syncedExpiryDate && syncedExpiryDate > now;

  let subStatus = profile?.subscription_status ?? 'free';

  // Stripe/check-subscription ska väga tyngst när den lyckas.
  // Annars kan en gammal profiles-rad som fortfarande säger "free" göra att en betalande kund låses ute.
  if (synced && subscribed) {
    subStatus = 'premium';
  } else if (hasValidSyncedExpiry || hasValidProfileExpiry) {
    subStatus = 'premium';
  } else if (synced && !subscribed) {
    subStatus = 'free';
  }

  const resolvedSubscriptionEnd = subscriptionEnd ?? profile?.premium_expires_at ?? null;

  return {
    id: supaUser.id,
    email: supaUser.email ?? '',
    name: profile?.display_name ?? supaUser.user_metadata?.name ?? '',
    is_premium: subStatus === 'premium',
    subscription_status: subStatus,
    subscription_end: resolvedSubscriptionEnd,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserRef = useRef<SupabaseUser | null>(null);
  const profileReadyRef = useRef(false);

  const startPeriodicSync = useCallback((supaUser: SupabaseUser) => {
    if (syncIntervalRef.current) {
      clearInterval(syncIntervalRef.current);
    }
    currentUserRef.current = supaUser;

    syncIntervalRef.current = setInterval(async () => {
      // Gate: don't sync until the initial profile has been fully loaded
      if (!currentUserRef.current || !profileReadyRef.current) return;
      try {
        const profile = await buildProfile(currentUserRef.current);
        setUser(profile);
      } catch {
        // Non-blocking periodic sync
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
      const profile = await buildProfile(session.user);
      setUser(profile);
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

      if (isMounted) {
        setUser(toBasicProfile(supaUser));
      }

      if (hydrateProfile) {
        // Mark profile as not ready until buildProfile completes
        profileReadyRef.current = false;

        void buildProfile(supaUser)
          .then((profile) => {
            if (isMounted) {
              setUser(profile);
              profileReadyRef.current = true;
              startPeriodicSync(supaUser);
            }
          })
          .catch(() => {
            if (isMounted) {
              // Even on failure, allow periodic sync to retry
              profileReadyRef.current = true;
              startPeriodicSync(supaUser);
            }
          });
      }
    };

    // Wait for getSession to restore from storage before processing auth state
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
        setLoading(false);
        return;
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

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);

    if (data.user) {
      setUser(toBasicProfile(data.user));
      profileReadyRef.current = false;
      void buildProfile(data.user).then((p) => {
        setUser(p);
        profileReadyRef.current = true;
        startPeriodicSync(data.user);
      }).catch(() => {
        profileReadyRef.current = true;
      });
    }
  };

  const register = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) throw new Error(error.message);
    return data;
  };

  const logout = async () => {
    stopPeriodicSync();
    const currentId = currentUserRef.current?.id ?? null;
    await supabase.auth.signOut();
    setUser(null);
    try {
      // Clear Supabase session keys + the global "theme" cache (per-user theme
      // lives under u:<id>:theme and is kept so it re-applies on next login).
      const keysToRemove = Object.keys(localStorage).filter(k =>
        k.startsWith('sb-') || k.startsWith('supabase') || k === 'theme' || k === '_track_sid'
      );
      keysToRemove.forEach(k => localStorage.removeItem(k));
      // Clear legacy global honsgarden-* keys (newer code uses u:<id>: prefix)
      Object.keys(localStorage)
        .filter(k => k.startsWith('honsgarden-') && !k.startsWith('honsgarden-imported'))
        .forEach(k => localStorage.removeItem(k));
      // NOTE: We intentionally keep u:<id>:* keys so the user's preferences
      // (theme, dismissed nudges, last hen, etc.) survive logout/login on the
      // same device. Other users on this device have their own prefix.
      void currentId;
    } catch { /* private browsing */ }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, isAuthenticated: !!user, refreshSubscription }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
