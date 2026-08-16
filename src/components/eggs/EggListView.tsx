import React from 'react';
import { CloudOff, Egg as EggIcon, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EggListViewProps {
  eggs: any[];
  henNameMap: Record<string, string>;
  flockNameMap: Record<string, string>;
  henFlockMap?: Record<string, string>;
  onDelete: (id: string) => void;
}

function friendlyDate(value: string) {
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat('sv-SE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

export function EggListView({ eggs, henNameMap, flockNameMap, henFlockMap = {}, onDelete }: EggListViewProps) {
  if (eggs.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Inga ägg registrerade ännu</div>;
  }

  return (
    <div className="eggbook-list divide-y divide-border/50">
      {eggs.slice(0, 30).map((entry: any) => {
        const entryId = entry._id || entry.id;
        const henName = entry.hen_id ? henNameMap[entry.hen_id] : null;
        const flockName = entry.flock_id
          ? flockNameMap[entry.flock_id]
          : (entry.hen_id && henFlockMap[entry.hen_id] ? flockNameMap[henFlockMap[entry.hen_id]] : null);
        const source = [henName, flockName].filter(Boolean).join(' · ');

        return (
          <div key={entryId} className="eggbook-list__row grid grid-cols-[36px_minmax(0,1fr)_auto_32px] items-center gap-2.5 px-4 sm:px-5 py-3.5 hover:bg-secondary/25 transition-colors">
            <div className="eggbook-list__mark grid h-9 w-9 place-items-center rounded-xl bg-primary/[0.07] text-primary" aria-hidden="true">
              <EggIcon className="h-4 w-4" />
            </div>
            <div className="eggbook-list__copy min-w-0">
              <div className="eggbook-list__date-row flex min-w-0 items-center gap-2 flex-wrap">
                <p className="font-serif text-sm text-foreground capitalize leading-tight">{friendlyDate(entry.date)}</p>
                {entry.pending && (
                  <span className="eggbook-list__pending inline-flex items-center gap-1 text-[9px] text-amber-700 dark:text-amber-300 font-medium">
                    <CloudOff className="h-3 w-3" /> Väntar på synk
                  </span>
                )}
              </div>
              <p className="eggbook-list__source mt-1 text-[11px] text-muted-foreground truncate">{source || 'Gårdens gemensamma logg'}</p>
              {entry.notes && <p className="eggbook-list__note mt-1.5 text-[11px] text-muted-foreground/80 italic truncate">“{entry.notes}”</p>}
            </div>
            <div className="eggbook-list__count flex items-baseline gap-1 text-right">
              <strong className="font-serif text-xl font-medium tabular-nums text-foreground">{entry.count}</strong>
              <span className="text-[9px] font-semibold text-muted-foreground">ägg</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="eggbook-list__delete h-8 w-8 p-0 text-muted-foreground/40 hover:text-destructive"
              onClick={() => onDelete(entryId)}
              aria-label={`Ta bort registreringen från ${friendlyDate(entry.date)}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
