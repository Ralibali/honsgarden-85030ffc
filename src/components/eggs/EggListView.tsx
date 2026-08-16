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
    <div className="eggbook-list divide-y divide-border">
      {eggs.slice(0, 30).map((entry: any) => {
        const entryId = entry._id || entry.id;
        const henName = entry.hen_id ? henNameMap[entry.hen_id] : null;
        const flockName = entry.flock_id
          ? flockNameMap[entry.flock_id]
          : (entry.hen_id && henFlockMap[entry.hen_id] ? flockNameMap[henFlockMap[entry.hen_id]] : null);
        const source = [henName, flockName].filter(Boolean).join(' · ');

        return (
          <div key={entryId} className="eggbook-list__row">
            <div className="eggbook-list__mark" aria-hidden="true">
              <EggIcon className="h-4 w-4" />
            </div>
            <div className="eggbook-list__copy">
              <div className="eggbook-list__date-row">
                <p>{friendlyDate(entry.date)}</p>
                {entry.pending && (
                  <span className="eggbook-list__pending">
                    <CloudOff className="h-3 w-3" /> Väntar på synk
                  </span>
                )}
              </div>
              <p className="eggbook-list__source">{source || 'Gårdens gemensamma logg'}</p>
              {entry.notes && <p className="eggbook-list__note">“{entry.notes}”</p>}
            </div>
            <div className="eggbook-list__count">
              <strong>{entry.count}</strong>
              <span>ägg</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="eggbook-list__delete h-8 w-8 p-0"
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
