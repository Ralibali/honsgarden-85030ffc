import React, { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Egg, Flame, Star, Trophy, Target, Zap, Heart, Crown, Gift, Users, Calendar, Package, Coins, ClipboardCheck } from 'lucide-react';

export interface Achievement {
  id: string;
  title: string;
  description: string;
  emoji: string;
  icon: React.ElementType;
  unlocked: boolean;
  progress: number;
  current: number;
  target: number;
  tier: 'bronze' | 'silver' | 'gold' | 'diamond';
}

export const TIER_PREMIUM_DAYS: Record<Achievement['tier'], number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  diamond: 5,
};

export const MAX_ACHIEVEMENT_PREMIUM_DAYS = 7;

const TIER_LABELS: Record<Achievement['tier'], string> = {
  bronze: 'Brons',
  silver: 'Silver',
  gold: 'Guld',
  diamond: 'Diamant',
};

interface AchievementsProps {
  eggs: any[];
  hens: any[];
  streak: number;
  feedRecords?: any[];
  transactions?: any[];
  chores?: any[];
}

function getTierColors(tier: string, unlocked: boolean) {
  if (!unlocked) return { bg: 'bg-muted/40', border: 'border-border/30', text: 'text-muted-foreground/40', icon: 'text-muted-foreground/30' };
  switch (tier) {
    case 'bronze': return { bg: 'bg-accent/8', border: 'border-accent/20', text: 'text-accent', icon: 'text-accent' };
    case 'silver': return { bg: 'bg-muted/60', border: 'border-border', text: 'text-foreground', icon: 'text-muted-foreground' };
    case 'gold': return { bg: 'bg-warning/10', border: 'border-warning/25', text: 'text-warning', icon: 'text-warning' };
    case 'diamond': return { bg: 'bg-primary/10', border: 'border-primary/25', text: 'text-primary', icon: 'text-primary' };
    default: return { bg: 'bg-muted/40', border: 'border-border/30', text: 'text-muted-foreground', icon: 'text-muted-foreground' };
  }
}

export function buildAchievements(eggs: any[], hens: any[], streak: number, feedRecords: any[] = [], transactions: any[] = [], chores: any[] = []): Achievement[] {
  const totalEggs = eggs.reduce((sum: number, e: any) => sum + (e.count || 0), 0);
  const activeHens = hens.filter((h: any) => h.is_active).length;
  const totalHens = hens.length;
  const uniqueDays = new Set(eggs.filter((e: any) => e.count > 0).map((e: any) => e.date)).size;
  const hensWithEggs = new Set(eggs.filter((e: any) => e.hen_id).map((e: any) => e.hen_id)).size;

  // Check for eggs on weekends
  const weekendDays = new Set(
    eggs.filter((e: any) => {
      const day = new Date(e.date).getDay();
      return (day === 0 || day === 6) && e.count > 0;
    }).map((e: any) => e.date)
  ).size;

  // Best single day
  const dailyCounts: Record<string, number> = {};
  eggs.forEach((e: any) => { dailyCounts[e.date] = (dailyCounts[e.date] || 0) + (e.count || 0); });
  const bestDay = Math.max(0, ...Object.values(dailyCounts));

  const list: Achievement[] = [
    {
      id: 'first-egg',
      title: 'Första ägget!',
      description: 'Registrera ditt första ägg',
      emoji: '🥚',
      icon: Egg,
      unlocked: totalEggs >= 1,
      progress: Math.min(100, (totalEggs / 1) * 100),
      current: Math.min(totalEggs, 1),
      target: 1,
      tier: 'bronze',
    },
    {
      id: 'dozen',
      title: 'Ett dussin',
      description: 'Registrera 12 ägg totalt',
      emoji: '📦',
      icon: Egg,
      unlocked: totalEggs >= 12,
      progress: Math.min(100, (totalEggs / 12) * 100),
      current: Math.min(totalEggs, 12),
      target: 12,
      tier: 'bronze',
    },
    {
      id: 'hundred-eggs',
      title: 'Hundralansen',
      description: 'Registrera 100 ägg totalt',
      emoji: '💯',
      icon: Star,
      unlocked: totalEggs >= 100,
      progress: Math.min(100, (totalEggs / 100) * 100),
      current: Math.min(totalEggs, 100),
      target: 100,
      tier: 'silver',
    },
    {
      id: 'five-hundred',
      title: 'Äggfabriken',
      description: 'Registrera 500 ägg totalt',
      emoji: '🏭',
      icon: Trophy,
      unlocked: totalEggs >= 500,
      progress: Math.min(100, (totalEggs / 500) * 100),
      current: Math.min(totalEggs, 500),
      target: 500,
      tier: 'gold',
    },
    {
      id: 'thousand-eggs',
      title: 'Äggets mästare',
      description: 'Registrera 1 000 ägg totalt',
      emoji: '👑',
      icon: Crown,
      unlocked: totalEggs >= 1000,
      progress: Math.min(100, (totalEggs / 1000) * 100),
      current: Math.min(totalEggs, 1000),
      target: 1000,
      tier: 'diamond',
    },
    {
      id: 'streak-7',
      title: 'Veckosviten',
      description: 'Logga ägg 7 dagar i rad',
      emoji: '🔥',
      icon: Flame,
      unlocked: streak >= 7,
      progress: Math.min(100, (streak / 7) * 100),
      current: Math.min(streak, 7),
      target: 7,
      tier: 'bronze',
    },
    {
      id: 'streak-30',
      title: 'Månadsmaraton',
      description: 'Logga ägg 30 dagar i rad',
      emoji: '🏃',
      icon: Flame,
      unlocked: streak >= 30,
      progress: Math.min(100, (streak / 30) * 100),
      current: Math.min(streak, 30),
      target: 30,
      tier: 'gold',
    },
    {
      id: 'streak-100',
      title: 'Legendens streak',
      description: 'Logga ägg 100 dagar i rad',
      emoji: '⚡',
      icon: Zap,
      unlocked: streak >= 100,
      progress: Math.min(100, (streak / 100) * 100),
      current: Math.min(streak, 100),
      target: 100,
      tier: 'diamond',
    },
    {
      id: 'first-hen',
      title: 'Ny kompis',
      description: 'Lägg till din första höna',
      emoji: '🐔',
      icon: Heart,
      unlocked: activeHens >= 1,
      progress: Math.min(100, (activeHens / 1) * 100),
      current: Math.min(activeHens, 1),
      target: 1,
      tier: 'bronze',
    },
    {
      id: 'flock-5',
      title: 'Liten flock',
      description: 'Ha minst 5 aktiva hönor',
      emoji: '🐓',
      icon: Target,
      unlocked: activeHens >= 5,
      progress: Math.min(100, (activeHens / 5) * 100),
      current: Math.min(activeHens, 5),
      target: 5,
      tier: 'silver',
    },
    {
      id: 'flock-10',
      title: 'Stor flock',
      description: 'Ha minst 10 aktiva hönor',
      emoji: '🏠',
      icon: Users,
      unlocked: activeHens >= 10,
      progress: Math.min(100, (activeHens / 10) * 100),
      current: Math.min(activeHens, 10),
      target: 10,
      tier: 'gold',
    },
    {
      id: 'dedicated',
      title: 'Hängiven hönsbonde',
      description: 'Logga ägg minst 60 olika dagar',
      emoji: '📅',
      icon: Target,
      unlocked: uniqueDays >= 60,
      progress: Math.min(100, (uniqueDays / 60) * 100),
      current: Math.min(uniqueDays, 60),
      target: 60,
      tier: 'gold',
    },
    {
      id: 'tracker',
      title: 'Detektivhöna',
      description: 'Koppla ägg till minst 5 specifika hönor',
      emoji: '🔍',
      icon: Star,
      unlocked: hensWithEggs >= 5,
      progress: Math.min(100, (hensWithEggs / 5) * 100),
      current: Math.min(hensWithEggs, 5),
      target: 5,
      tier: 'silver',
    },
    {
      id: 'weekend-warrior',
      title: 'Helghjälte',
      description: 'Logga ägg 20 helgdagar',
      emoji: '🎉',
      icon: Calendar,
      unlocked: weekendDays >= 20,
      progress: Math.min(100, (weekendDays / 20) * 100),
      current: Math.min(weekendDays, 20),
      target: 20,
      tier: 'silver',
    },
    {
      id: 'super-day',
      title: 'Superdag',
      description: 'Få minst 10 ägg på en dag',
      emoji: '🌟',
      icon: Zap,
      unlocked: bestDay >= 10,
      progress: Math.min(100, (bestDay / 10) * 100),
      current: Math.min(bestDay, 10),
      target: 10,
      tier: 'silver',
    },
    {
      id: 'collector',
      title: 'Samlaren',
      description: 'Registrera 15 olika hönor totalt',
      emoji: '📋',
      icon: Users,
      unlocked: totalHens >= 15,
      progress: Math.min(100, (totalHens / 15) * 100),
      current: Math.min(totalHens, 15),
      target: 15,
      tier: 'gold',
    },
    // Feed achievements
    {
      id: 'first-feed',
      title: 'Första fodret',
      description: 'Logga ditt första foderinköp',
      emoji: '🌾',
      icon: Package,
      unlocked: feedRecords.length >= 1,
      progress: Math.min(100, (feedRecords.length / 1) * 100),
      current: Math.min(feedRecords.length, 1),
      target: 1,
      tier: 'bronze',
    },
    {
      id: 'feed-tracker',
      title: 'Foderexperten',
      description: 'Logga 10 foderinköp',
      emoji: '📊',
      icon: Package,
      unlocked: feedRecords.length >= 10,
      progress: Math.min(100, (feedRecords.length / 10) * 100),
      current: Math.min(feedRecords.length, 10),
      target: 10,
      tier: 'silver',
    },
    // Finance achievements
    {
      id: 'first-transaction',
      title: 'Första transaktionen',
      description: 'Logga din första inkomst eller utgift',
      emoji: '💰',
      icon: Coins,
      unlocked: transactions.length >= 1,
      progress: Math.min(100, (transactions.length / 1) * 100),
      current: Math.min(transactions.length, 1),
      target: 1,
      tier: 'bronze',
    },
    {
      id: 'finance-pro',
      title: 'Ekonomiproffs',
      description: 'Logga 20 transaktioner',
      emoji: '📈',
      icon: Coins,
      unlocked: transactions.length >= 20,
      progress: Math.min(100, (transactions.length / 20) * 100),
      current: Math.min(transactions.length, 20),
      target: 20,
      tier: 'silver',
    },
    // Chores achievements
    {
      id: 'first-chore',
      title: 'Första uppgiften',
      description: 'Skapa din första dagliga uppgift',
      emoji: '✅',
      icon: ClipboardCheck,
      unlocked: chores.length >= 1,
      progress: Math.min(100, (chores.length / 1) * 100),
      current: Math.min(chores.length, 1),
      target: 1,
      tier: 'bronze',
    },
  ];

  return list.sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return b.progress - a.progress;
  });
}

interface AchievementsComponentProps extends Partial<AchievementsProps> {
  achievements?: Achievement[];
  eggs: any[];
  hens: any[];
  streak: number;
}

export default function Achievements({ achievements: passedAchievements, eggs, hens, streak, feedRecords = [], transactions = [], chores = [] }: AchievementsComponentProps) {
  const computedAchievements = useMemo(() => passedAchievements ?? buildAchievements(eggs, hens, streak, feedRecords, transactions, chores), [passedAchievements, eggs, hens, streak, feedRecords, transactions, chores]);
  const achievements = computedAchievements;

  const unlockedCount = achievements.filter(a => a.unlocked).length;



  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-warning/10 flex items-center justify-center">
            <Trophy className="h-4 w-4 text-warning" />
          </div>
          <div>
            <h2 className="font-serif text-base text-foreground">Achievements</h2>
            <p className="text-[11px] text-muted-foreground">{unlockedCount} av {achievements.length} upplåsta</p>
          </div>
        </div>
        <span className="text-xs bg-warning/10 text-warning px-3 py-1 rounded-full font-semibold border border-warning/15">
          {unlockedCount}/{achievements.length}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {achievements.map((a) => {
          const colors = getTierColors(a.tier, a.unlocked);
          const days = TIER_PREMIUM_DAYS[a.tier];
          return (
            <Card
              key={a.id}
              className={`overflow-hidden border ${colors.border} ${a.unlocked ? 'shadow-sm' : 'opacity-60'} transition-all`}
            >
              <CardContent className="p-3 text-center">
                <span className={`text-2xl block mb-1.5 ${a.unlocked ? '' : 'grayscale opacity-40'}`}>
                  {a.emoji}
                </span>
                <p className={`text-[11px] font-semibold leading-tight ${a.unlocked ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {a.title}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{a.description}</p>

                {/* Reward badge */}
                <div className={`mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-semibold ${
                  a.unlocked 
                    ? 'bg-primary/10 text-primary' 
                    : 'bg-muted/50 text-muted-foreground/60'
                }`}>
                  <Gift className="h-2.5 w-2.5" />
                  +{days} dag{days > 1 ? 'ar' : ''} Premium
                </div>

                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-muted/50 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      a.unlocked
                        ? a.tier === 'diamond' ? 'bg-primary' : a.tier === 'gold' ? 'bg-warning' : a.tier === 'silver' ? 'bg-muted-foreground' : 'bg-accent'
                        : 'bg-muted-foreground/30'
                    }`}
                    style={{ width: `${a.progress}%` }}
                  />
                </div>
                <p className="text-[8px] text-muted-foreground mt-1 tabular-nums">
                  {a.current}/{a.target} · {TIER_LABELS[a.tier]}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
