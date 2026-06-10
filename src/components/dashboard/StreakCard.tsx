import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Flame, Trophy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { api } from '@/lib/api';

const MILESTONES = [365, 100, 30, 7];

function milestoneBadge(streak: number): string | null {
  const m = MILESTONES.find((n) => streak >= n);
  if (!m) return null;
  return `🏆 ${m} dagar!`;
}

function hasLoggedToday(lastActivity: string | null): boolean {
  if (!lastActivity) return false;
  const today = new Date().toISOString().slice(0, 10);
  return lastActivity === today;
}

export function StreakCard() {
  const navigate = useNavigate();
  const { data } = useQuery({
    queryKey: ['streak'],
    queryFn: () => api.getStreak(),
    staleTime: 60_000,
  });

  const streak = data?.current_streak ?? 0;
  const loggedToday = hasLoggedToday(data?.last_activity ?? null);
  const badge = milestoneBadge(streak);

  let status: string;
  let statusTone: 'muted' | 'warning' | 'success' = 'muted';
  if (streak === 0) {
    status = 'Logga dagens ägg för att starta en streak!';
  } else if (loggedToday) {
    status = 'Snyggt! Kom tillbaka imorgon.';
    statusTone = 'success';
  } else {
    status = 'Logga innan midnatt för att behålla din streak!';
    statusTone = 'warning';
  }

  const toneClass =
    statusTone === 'warning'
      ? 'text-destructive'
      : statusTone === 'success'
      ? 'text-primary'
      : 'text-muted-foreground';

  return (
    <Card
      className="border-border/50 shadow-sm cursor-pointer transition-colors hover:bg-muted/30"
      onClick={() => navigate('/app/eggs')}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') navigate('/app/eggs');
      }}
      aria-label="Öppna äggloggning"
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
              streak > 0 ? 'bg-orange-500/15' : 'bg-muted'
            }`}
          >
            <Flame
              className={`h-5 w-5 ${
                streak > 0 ? 'text-orange-500 fill-orange-400/40' : 'text-muted-foreground'
              }`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2 flex-wrap">
              <p className="font-serif text-lg leading-none text-foreground tabular-nums">
                {streak} {streak === 1 ? 'dag' : 'dagar'} i rad
              </p>
              {badge && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
                  <Trophy className="h-3 w-3" />
                  {badge}
                </span>
              )}
            </div>
            <p className={`text-xs mt-1.5 ${toneClass}`}>{status}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
