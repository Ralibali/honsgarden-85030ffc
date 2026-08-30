import { Card, CardContent } from '@/components/ui/card';
import { Crown, Medal, TrendingUp, TrendingDown, Trophy, Coins } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { PremiumInsight } from '@/lib/premiumInsights';

const INSIGHT_ICONS: Record<PremiumInsight['id'], LucideIcon> = {
  best_layer_week: Medal,
  flock_trend: TrendingUp,
  best_week_ever: Trophy,
  cost_per_egg: Coins,
};

interface PremiumInsightsCardProps {
  insights: PremiumInsight[];
  /** Flocktrend riktning avgör ikon — skickas separat för att hålla libben ren. */
  trendDirection?: 'up' | 'down' | null;
}

/**
 * Plus-insikter på dashboarden (Swarm K). Visas endast för användare
 * med capability 'advanced_analytics' och endast när libben returnerat
 * minst en insikt — aldrig tomma platshållare, aldrig ny betalvägg.
 */
export default function PremiumInsightsCard({ insights, trendDirection = null }: PremiumInsightsCardProps) {
  if (insights.length === 0) return null;

  return (
    <Card className="border-amber-500/20 bg-amber-500/[0.04] shadow-sm rounded-2xl">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Crown className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-medium text-foreground text-sm">Dina insikter</p>
          <span className="text-[10px] font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400 bg-amber-500/10 rounded-full px-2 py-0.5">
            Plus
          </span>
        </div>
        <ul className="space-y-3">
          {insights.map((insight) => {
            const Icon =
              insight.id === 'flock_trend' && trendDirection === 'down'
                ? TrendingDown
                : INSIGHT_ICONS[insight.id];
            return (
              <li key={insight.id} className="flex items-start gap-3">
                <Icon className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{insight.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{insight.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
