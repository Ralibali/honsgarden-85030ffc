import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Target } from 'lucide-react';
import { TIER_PREMIUM_DAYS, type Achievement } from '@/components/Achievements';

interface AchievementNudgeProps {
  achievements: Achievement[];
}

export default function AchievementNudge({ achievements }: AchievementNudgeProps) {
  
  // Find the closest locked achievement (highest progress, not yet unlocked)
  const closest = achievements.find(a => !a.unlocked && a.progress > 0);
  
  if (!closest || closest.progress < 30) return null;

  const remaining = closest.target - closest.current;
  const days = TIER_PREMIUM_DAYS[closest.tier];

  return (
    <Card className="border-warning/20 bg-warning/5 shadow-sm overflow-hidden">
      <div className="h-0.5 bg-gradient-to-r from-warning/60 to-warning/20" />
      <CardContent className="p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-warning/10 flex items-center justify-center shrink-0">
          <span className="text-lg">{closest.emoji}</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">
            Nästan där! {closest.title}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {remaining} kvar – belöning: +{days} dag{days > 1 ? 'ar' : ''} Premium
          </p>
        </div>
        <div className="w-10 h-10 rounded-full border-2 border-warning/30 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-bold text-warning tabular-nums">{Math.round(closest.progress)}%</span>
        </div>
      </CardContent>
    </Card>
  );
}
