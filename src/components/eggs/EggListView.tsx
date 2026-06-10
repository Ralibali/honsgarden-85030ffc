import React from 'react';
import { Calendar, Egg as EggIcon, Trash2, CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';


interface EggListViewProps {
  eggs: any[];
  henNameMap: Record<string, string>;
  flockNameMap: Record<string, string>;
  henFlockMap?: Record<string, string>;
  onDelete: (id: string) => void;
}

export function EggListView({ eggs, henNameMap, flockNameMap, henFlockMap = {}, onDelete }: EggListViewProps) {
  if (eggs.length === 0) {
    return <div className="p-8 text-center text-muted-foreground text-sm">Inga ägg registrerade ännu</div>;
  }

  return (
    <div className="divide-y divide-border">
      {eggs.slice(0, 30).map((entry: any) => {
        const entryId = entry._id || entry.id;
        const henName = entry.hen_id ? henNameMap[entry.hen_id] : null;
        const flockName = entry.flock_id
          ? flockNameMap[entry.flock_id]
          : (entry.hen_id && henFlockMap[entry.hen_id] ? flockNameMap[henFlockMap[entry.hen_id]] : null);
        return (
          <div key={entryId} className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 hover:bg-secondary/50 transition-colors">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <EggIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
                  <p className="text-xs sm:text-sm text-muted-foreground">{entry.date}</p>
                  {entry.pending && (
                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300 px-1.5 py-0.5 rounded-md font-medium">
                      <CloudOff className="h-2.5 w-2.5" /> Väntar på synk
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  {flockName && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md font-medium">👥 {flockName}</span>
                  )}
                  {henName && (
                    <span className="text-xs bg-accent/10 text-accent px-2 py-0.5 rounded-md font-medium">🐔 {henName}</span>
                  )}
                  {!flockName && !henName && (
                    <span className="text-xs text-muted-foreground">Utan grupp</span>
                  )}
                </div>
                {entry.notes && <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{entry.notes}</p>}
              </div>

            </div>
            <div className="flex items-center gap-2">
              <span className="stat-number text-lg sm:text-xl text-foreground">{entry.count}</span>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" onClick={() => onDelete(entryId)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
