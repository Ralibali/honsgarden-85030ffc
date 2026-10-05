import { useAuth } from '@/hooks/useAuth';
import { shouldShowAds } from '@/lib/adVisibility';

/** True when ad surfaces may render for the current visitor (see adVisibility). */
export function useShowAds(): boolean {
  const { user, loading, premiumResolved } = useAuth();
  return shouldShowAds({ loading, premiumResolved, isPremium: Boolean(user?.is_premium) });
}
