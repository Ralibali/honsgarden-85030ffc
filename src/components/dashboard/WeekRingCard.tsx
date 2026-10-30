import { useEffect } from 'react';
import { Check, Flame } from 'lucide-react';
import type { WeekProgress } from '@/lib/logStreak';
import { emitUnlockCelebration, type UnlockCelebration } from '@/lib/unlockBus';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Props {
  week: WeekProgress;
  streak: number;
  winter: boolean;
  /** Ingen firning i demoläget. */
  demo?: boolean;
}

const CELEBRATED_KEY = 'hg_perfect_week_celebrated_v1';

function tierFor(weeksInRow: number): UnlockCelebration['tier'] {
  if (weeksInRow >= 8) return 'diamond';
  if (weeksInRow >= 4) return 'gold';
  if (weeksInRow >= 2) return 'silver';
  return 'bronze';
}

function summary(week: WeekProgress): string {
  if (week.perfect) {
    return week.perfectWeeksInRow >= 2
      ? `Perfekt vecka – ${week.perfectWeeksInRow} i rad! 🎉`
      : 'Perfekt vecka – alla sju dagar! 🎉';
  }
  const stillPossible = week.loggedCount + week.remainingPossible === 7;
  if (stillPossible) {
    const left = 7 - week.loggedCount;
    return `${week.loggedCount} av 7 dagar · ${left} kvar till perfekt vecka`;
  }
  return `${week.loggedCount} av 7 dagar loggade – varje dag räknas`;
}

/**
 * Veckans ring: sju prickar måndag–söndag som fylls för varje loggad dag,
 * även äggfria. En perfekt vecka firas med helskärmsfirandet – en gång per vecka.
 */
export default function WeekRingCard({ week, streak, winter, demo = false }: Props) {
  const { user } = useAuth();

  useEffect(() => {
    if (demo || !week.perfect) return;
    if (readScoped(user?.id, CELEBRATED_KEY) === week.weekStart) return;
    writeScoped(user?.id, CELEBRATED_KEY, week.weekStart);
    emitUnlockCelebration({
      id: `perfect-week-${week.weekStart}`,
      emoji: '🥚',
      title: week.perfectWeeksInRow >= 2 ? `${week.perfectWeeksInRow} perfekta veckor i rad!` : 'Perfekt vecka!',
      description: 'Du har loggat flocken alla sju dagar. Det är så mönstren blir synliga.',
      tier: tierFor(week.perfectWeeksInRow),
      premiumDays: 0,
    });
  }, [demo, user?.id, week.perfect, week.perfectWeeksInRow, week.weekStart]);

  return (
    <section className="today-v3__journal" aria-labelledby="week-ring-heading">
      <div className="today-v3__section-heading">
        <div>
          <p className="today-v3__eyebrow">{winter ? 'Vinterläge: äggfria dagar räknas' : 'Logga varje dag – även utan ägg'}</p>
          <h2 id="week-ring-heading">Veckans ring</h2>
        </div>
        {streak >= 2 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-semibold text-foreground" aria-label={`${streak} dagar i rad`}>
            <Flame className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            {streak} i rad
          </span>
        )}
      </div>

      <ol className="grid grid-cols-7 gap-1.5" aria-label="Loggade dagar den här veckan">
        {week.days.map((day) => (
          <li key={day.date} className="flex flex-col items-center gap-1.5">
            <span
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-300',
                day.logged && 'scale-100 border-transparent bg-primary text-primary-foreground shadow-sm',
                !day.logged && day.isToday && 'animate-pulse border-primary/60 bg-primary/5',
                !day.logged && !day.isToday && day.isFuture && 'border-dashed border-border bg-transparent',
                !day.logged && !day.isToday && !day.isFuture && 'border-border bg-muted/60',
                week.perfect && 'bg-success',
              )}
              aria-label={`${day.label}: ${day.logged ? 'loggad' : day.isFuture ? 'kommer' : day.isToday ? 'idag, inte loggad än' : 'inte loggad'}`}
            >
              {day.logged ? <Check className="h-5 w-5" aria-hidden="true" /> : null}
            </span>
            <span className={cn('text-[11px] font-medium', day.isToday ? 'text-foreground' : 'text-muted-foreground')}>{day.label}</span>
          </li>
        ))}
      </ol>

      <p className="mt-3 px-1 text-sm font-medium text-foreground" data-testid="week-ring-summary">{summary(week)}</p>
    </section>
  );
}
