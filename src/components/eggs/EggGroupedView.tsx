import React, { useMemo } from 'react';
import { Trash2, Users, Egg as EggIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { localCalendarDate, todayLocal } from '@/lib/datetime';

interface EggGroupedViewProps {
  eggs: any[];
  henNameMap: Record<string, string>;
  flockNameMap: Record<string, string>;
  henFlockMap?: Record<string, string>;
  onDelete: (id: string) => void;
}

export function EggGroupedView({ eggs, henNameMap, flockNameMap, henFlockMap = {}, onDelete }: EggGroupedViewProps) {
  const groupedByDate = useMemo(() => {
    const groups: Record<string, any[]> = {};
    eggs.slice(0, 100).forEach((entry: any) => {
      if (!groups[entry.date]) groups[entry.date] = [];
      groups[entry.date].push(entry);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [eggs]);

  if (eggs.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Inga ägg registrerade ännu</div>;
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(`${dateStr}T12:00:00`);
    const now = new Date();
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const todayStr = todayLocal();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = localCalendarDate(yesterday, timezone);

    if (dateStr === todayStr) return 'Idag';
    if (dateStr === yesterdayStr) return 'Igår';
    const formatted = new Intl.DateTimeFormat('sv-SE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  };

  return (
    <div className="eggbook-days divide-y divide-border/50">
      {groupedByDate.map(([date, entries]) => {
        const totalForDay = entries.reduce((sum: number, entry: any) => sum + (entry.count || 0), 0);
        return (
          <article key={date} className="eggbook-day px-4 sm:px-5 py-4">
            <header className="eggbook-day__header flex items-end justify-between gap-4 pb-3">
              <div>
                <p className="font-serif text-base sm:text-lg text-foreground leading-none">{formatDate(date)}</p>
                <p className="mt-1.5 text-[10px] text-muted-foreground/65 tabular-nums">{date}</p>
              </div>
              <div className="eggbook-day__total flex items-baseline gap-1.5 text-right">
                <strong className="font-serif text-2xl font-medium text-foreground tabular-nums">{totalForDay}</strong>
                <span className="text-[10px] font-semibold text-muted-foreground">ägg</span>
              </div>
            </header>

            <div className="eggbook-day__entries grid gap-1">
              {entries.map((entry: any) => {
                const entryId = entry._id || entry.id;
                const flockName = entry.flock_id
                  ? flockNameMap[entry.flock_id]
                  : (entry.hen_id && henFlockMap[entry.hen_id] ? flockNameMap[henFlockMap[entry.hen_id]] : null);
                const henName = entry.hen_id ? henNameMap[entry.hen_id] : null;
                const label = [henName, flockName].filter(Boolean).join(' · ') || 'Gårdens gemensamma logg';

                return (
                  <div key={entryId} className="eggbook-day__entry grid grid-cols-[34px_minmax(0,1fr)_auto_30px] items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-secondary/25 transition-colors">
                    <div className="grid h-8 w-8 place-items-center rounded-lg bg-primary/[0.06] text-primary" aria-hidden="true">
                      {flockName ? <Users className="h-3.5 w-3.5" /> : henName ? <span className="text-sm">🐔</span> : <EggIcon className="h-3.5 w-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs sm:text-sm font-medium text-foreground truncate">{label}</p>
                      {entry.notes && <p className="mt-1 text-[10px] text-muted-foreground/75 italic truncate">“{entry.notes}”</p>}
                    </div>
                    <span className="font-serif text-lg text-foreground tabular-nums">{entry.count}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground/35 hover:text-destructive"
                      onClick={() => onDelete(entryId)}
                      aria-label={`Ta bort ${entry.count} ägg från ${formatDate(date)}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}
