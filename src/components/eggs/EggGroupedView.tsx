import React, { useMemo } from 'react';
import { Trash2, Users, Egg as EggIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
    eggs.slice(0, 100).forEach((e: any) => {
      if (!groups[e.date]) groups[e.date] = [];
      groups[e.date].push(e);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [eggs]);

  if (eggs.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Inga ägg registrerade ännu</div>;
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (dateStr === todayStr) return 'Idag';
    if (dateStr === yesterdayStr) return 'Igår';
    return d.toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  return (
    <div className="divide-y divide-border">
      {groupedByDate.map(([date, entries]) => {
        const totalForDay = entries.reduce((s: number, e: any) => s + (e.count || 0), 0);
        return (
          <div key={date}>
            {/* Date header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 bg-muted/30">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                {formatDate(date)}
                <span className="text-muted-foreground font-normal ml-2">{date}</span>
              </span>
              <span className="text-sm font-bold text-foreground tabular-nums">
                {totalForDay} 🥚
              </span>
            </div>
            {/* Entries for that date */}
            <div className="divide-y divide-border/50">
              {entries.map((entry: any) => {
                const entryId = entry._id || entry.id;
                const flockName = entry.flock_id
                  ? flockNameMap[entry.flock_id]
                  : (entry.hen_id && henFlockMap[entry.hen_id] ? flockNameMap[henFlockMap[entry.hen_id]] : null);
                const henName = entry.hen_id ? henNameMap[entry.hen_id] : null;
                const label = flockName || henName || 'Utan grupp';

                return (
                  <div key={entryId} className="flex items-center justify-between px-4 sm:px-6 py-2 sm:py-2.5 hover:bg-secondary/50 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {flockName ? (
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Users className="h-3.5 w-3.5 text-primary" />
                        </div>
                      ) : henName ? (
                        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                          <span className="text-sm">🐔</span>
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          <EggIcon className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{label}</p>
                        {entry.notes && <p className="text-[10px] text-muted-foreground truncate">{entry.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="stat-number text-base sm:text-lg text-foreground tabular-nums">{entry.count}</span>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(entryId)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
