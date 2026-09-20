import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { api } from '@/lib/api';
import { buildAchievements } from '@/components/Achievements';
import { emitUnlockCelebration } from '@/lib/unlockBus';

/**
 * Appglobal belöningsmotor. Flyttad från Achievements-komponenten så att
 * upplåsningar firas i ögonblicket de händer, oavsett vilken sida användaren är på.
 */
export function useAchievementRewards() {
  const { user } = useAuth();
  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs(), staleTime: 60_000, enabled: !!user?.id });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000, enabled: !!user?.id });
  const { data: streakData } = useQuery({ queryKey: ['streak'], queryFn: () => api.getStreak(), staleTime: 60_000, enabled: !!user?.id });
  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords(), staleTime: 60_000, enabled: !!user?.id });
  const { data: transactions = [] } = useQuery({ queryKey: ['transactions'], queryFn: () => api.getTransactions(), staleTime: 60_000, enabled: !!user?.id });
  const { data: chores = [] } = useQuery({ queryKey: ['daily-chores'], queryFn: () => api.getDailyChores(), staleTime: 60_000, enabled: !!user?.id });

  const streak = (streakData as any)?.current_streak ?? 0;

  const achievements = useMemo(
    () => buildAchievements(eggs as any[], hens as any[], streak, feedRecords as any[], transactions as any[], chores as any[]),
    [eggs, hens, streak, feedRecords, transactions, chores],
  );

  const rewardedRef = useRef<Set<string>>(new Set());
  const runningRef = useRef(false);

  useEffect(() => {
    if (!user?.id) return;
    if (runningRef.current) return;
    const unlocked = achievements.filter((a) => a.unlocked);
    if (unlocked.length === 0) return;

    const grantRewards = async () => {
      runningRef.current = true;
      try {
        const { data: existing } = await supabase
          .from('achievement_rewards')
          .select('achievement_id')
          .eq('user_id', user.id);

        const alreadyRewarded = new Set((existing || []).map((r) => r.achievement_id));

        const fresh = unlocked.filter(
          (a) => !alreadyRewarded.has(a.id) && !rewardedRef.current.has(a.id),
        );
        if (fresh.length === 0) return;

        let celebrated = 0;
        const overflow: string[] = [];

        for (const achievement of fresh) {
          rewardedRef.current.add(achievement.id);

          // Registrering och premiumdagar sker i databasen (SECURITY DEFINER),
          // eftersom klienten inte får skriva i achievement_rewards.
          const { data, error } = await supabase.rpc('claim_achievement_reward', {
            _achievement_id: achievement.id,
            _tier: achievement.tier,
          });
          if (error) {
            rewardedRef.current.delete(achievement.id);
            console.error('[achievements] kunde inte registrera utmärkelse', error.message);
            continue;
          }

          const result = (data ?? {}) as { inserted?: boolean; granted_days?: number };
          if (!result.inserted) continue;
          const days = result.granted_days ?? 0;

          if (celebrated < 3) {
            celebrated++;
            emitUnlockCelebration({
              id: achievement.id,
              emoji: achievement.emoji,
              title: achievement.title,
              description: achievement.description,
              tier: achievement.tier,
              premiumDays: days,
            });
          } else {
            overflow.push(achievement.title);
          }
        }

        if (overflow.length > 0) {
          toast({
            title: `🏆 …och ${overflow.length} utmärkelse${overflow.length > 1 ? 'r' : ''} till!`,
            description: overflow.join(' · '),
          });
        }
      } finally {
        runningRef.current = false;
      }
    };

    void grantRewards();
  }, [achievements, user?.id]);
}
