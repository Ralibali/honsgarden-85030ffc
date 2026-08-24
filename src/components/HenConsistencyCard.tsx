import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });

function indexColor(idx: number) {
  if (idx >= 75) return 'bg-primary';
  if (idx >= 50) return 'bg-primary/70';
  if (idx >= 25) return 'bg-primary/40';
  return 'bg-muted-foreground/40';
}

export default function HenConsistencyCard() {
  const [showAll, setShowAll] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['hen-consistency'],
    queryFn: () => api.getHenConsistency(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">⭐ Pålitligaste värparna</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;
  const hens = data.hens ?? [];
  const visible = showAll ? hens : hens.slice(0, 5);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">⭐ Pålitligaste värparna</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          En jämn värpare är ofta mer värd än en ryckig storvärpare. Rankat efter jämnhet.
        </p>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4">
        {hens.length === 0 ? (
          <EmptyState
            emoji="🐔"
            title="Inga hönor med tillräcklig data ännu"
            description="Koppla ägg till enskilda hönor för att se vilka som värper jämnast. Vi behöver minst 14 dagar per höna för att räkna ut jämnhetsindex."
            actionLabel="Gå till hönor"
            onAction={() => window.location.assign('/app/hens')}
          />
        ) : (
          <div className="space-y-3">
            {visible.map((hen, i) => {
              const isBestConsistency = hen.id === data.bestConsistencyId;
              const isLongestStreak = hen.id === data.longestStreakId;
              return (
                <button
                  key={hen.id}
                  onClick={() => window.location.assign(`/app/hens/${hen.id}`)}
                  className="w-full text-left rounded-2xl bg-muted/20 border border-border/40 hover:bg-muted/30 transition-colors p-3"
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="stat-number text-sm text-muted-foreground w-5 text-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">{hen.name}</span>
                      {isBestConsistency && (
                        <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                          Jämnast
                        </Badge>
                      )}
                      {isLongestStreak && (
                        <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                          🔥 Längst streak
                        </Badge>
                      )}
                    </div>
                    <span className="stat-number text-sm text-primary shrink-0">{hen.totalEggs} ägg</span>
                  </div>

                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${indexColor(hen.consistencyIndex)} transition-all duration-500`}
                        style={{ width: `${hen.consistencyIndex}%` }}
                      />
                    </div>
                    <span className="stat-number text-xs text-foreground tabular-nums shrink-0 w-12 text-right">
                      {hen.consistencyIndex}/100
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                    <span>
                      Snitt: <strong className="text-foreground">{nf.format(hen.perWeek)}</strong> /vecka
                    </span>
                    <span>
                      Längsta streak:{' '}
                      <strong className="text-foreground">
                        {hen.longestStreak} {hen.longestStreak === 1 ? 'dag' : 'dagar'}
                      </strong>
                    </span>
                    <span>
                      Pågående:{' '}
                      <strong className="text-foreground">
                        {hen.currentStreak} {hen.currentStreak === 1 ? 'dag' : 'dagar'}
                      </strong>
                    </span>
                  </div>
                </button>
              );
            })}

            {hens.length > 5 && (
              <Button variant="ghost" size="sm" className="w-full" onClick={() => setShowAll((v) => !v)}>
                {showAll ? 'Visa mindre' : `Visa ${hens.length - 5} till`}
              </Button>
            )}

            <p className="text-[11px] text-muted-foreground italic leading-relaxed">
              Jämnhetsindex (0–100) räknas ur variationskoefficienten – en höna som värper exakt lika många ägg varje dag landar nära 100.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
