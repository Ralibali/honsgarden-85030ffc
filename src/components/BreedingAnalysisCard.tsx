import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { AlertTriangle, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });

function pctLabel(p: number) {
  if (p > 0) return `+${nf.format(p)} %`;
  return `${nf.format(p)} %`;
}

function PctIcon({ p }: { p: number }) {
  if (p > 2) return <TrendingUp className="h-3.5 w-3.5 text-primary" />;
  if (p < -2) return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
}

export default function BreedingAnalysisCard() {
  const [showAllParents, setShowAllParents] = useState(false);
  const [showAllInbreed, setShowAllInbreed] = useState(false);
  const { data, isLoading } = useQuery({
    queryKey: ['breeding-values'],
    queryFn: () => api.getBreedingValues(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🧬 Avelsanalys</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const parents = data.parents ?? [];
  const visibleParents = showAllParents ? parents : parents.slice(0, 5);
  const inbreeding = data.inbreeding ?? [];
  const visibleInbreed = showAllInbreed ? inbreeding : inbreeding.slice(0, 5);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">🧬 Avelsanalys</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Vilka föräldrar ger bäst avkomma – och hur ser släktskapen ut?
        </p>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 pb-4">
        {!data.hasParentData && inbreeding.length === 0 ? (
          <EmptyState
            emoji="🌿"
            title="För få släktkopplingar ännu"
            description="När du fyllt i mamma och pappa på dina hönor – och loggat ägg på dem – kan vi visa avelsvärden och flagga eventuell inavel."
            actionLabel="Gå till hönor"
            onAction={() => window.location.assign('/app/hens')}
          />
        ) : (
          <Tabs defaultValue="values" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="values" className="text-xs">Avelsvärde</TabsTrigger>
              <TabsTrigger value="inbreeding" className="text-xs">
                Inavel
                {data.highInbreedingCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-destructive/15 text-destructive text-[10px] px-1.5">
                    {data.highInbreedingCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="values" className="mt-3 space-y-3">
              {parents.length === 0 ? (
                <EmptyState
                  emoji="🐣"
                  title="För få föräldrar med flera avkommor"
                  description="Vi behöver minst två avkommor per förälder, alla med loggade ägg, för att räkna ut ett avelsvärde."
                />
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Flockens snitt:{' '}
                    <strong className="text-foreground">
                      {nf.format(data.flockAvgEggsPerDay)} ägg/dag per höna
                    </strong>
                  </p>
                  {visibleParents.map((p, i) => (
                    <div
                      key={p.parentId}
                      className="rounded-2xl bg-muted/20 border border-border/40 p-3"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="stat-number text-sm text-muted-foreground w-5 text-center shrink-0">
                            {i + 1}
                          </span>
                          <span className="text-sm font-medium text-foreground truncate">
                            {p.parentName}
                          </span>
                          <Badge variant="secondary" className="text-[10px] font-normal shrink-0">
                            {p.parentRole === 'father'
                              ? 'Pappa'
                              : p.parentRole === 'mother'
                                ? 'Mamma'
                                : 'Förälder'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <PctIcon p={p.pctVsFlock} />
                          <span className="stat-number text-sm text-foreground">
                            {pctLabel(p.pctVsFlock)}
                          </span>
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {p.offspringCount} {p.offspringCount === 1 ? 'avkomma' : 'avkommor'} ·{' '}
                        snitt {nf.format(p.avgEggsPerDay)} ägg/dag
                      </div>
                    </div>
                  ))}
                  {parents.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAllParents((v) => !v)}
                    >
                      {showAllParents ? 'Visa mindre' : `Visa ${parents.length - 5} till`}
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                    Avelsvärde = hur mycket bättre eller sämre avkomman värper jämfört med flocksnittet,
                    räknat som ägg per levnadsdag.
                  </p>
                </>
              )}
            </TabsContent>

            <TabsContent value="inbreeding" className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px] font-normal">
                  Avancerat
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  Wrights inavelskoefficient (förenklad, 4 generationer)
                </span>
              </div>

              {inbreeding.length === 0 ? (
                <EmptyState
                  emoji="✅"
                  title="Ingen inavel påvisad"
                  description="Inga hönor har gemensamma anfäder via både mamma och pappa i de senaste fyra generationerna."
                />
              ) : (
                <>
                  {visibleInbreed.map((row) => {
                    const pct = row.fIndex * 100;
                    const high = row.fIndex > 0.125;
                    return (
                      <button
                        key={row.henId}
                        onClick={() => window.location.assign(`/app/hens/${row.henId}`)}
                        className={`w-full text-left rounded-2xl border p-3 transition-colors ${
                          high
                            ? 'bg-destructive/5 border-destructive/30 hover:bg-destructive/10'
                            : 'bg-muted/20 border-border/40 hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate">
                              {row.henName}
                            </span>
                            {high && (
                              <Badge
                                variant="outline"
                                className="text-[10px] font-normal border-destructive/40 text-destructive shrink-0"
                              >
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Hög
                              </Badge>
                            )}
                          </div>
                          <span className="stat-number text-sm text-foreground shrink-0">
                            F = {nf.format(pct)} %
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Gemensamma anfäder:{' '}
                          {row.commonAncestors
                            .slice(0, 3)
                            .map((a) => a.name)
                            .join(', ')}
                          {row.commonAncestors.length > 3 &&
                            ` +${row.commonAncestors.length - 3} till`}
                        </div>
                      </button>
                    );
                  })}
                  {inbreeding.length > 5 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => setShowAllInbreed((v) => !v)}
                    >
                      {showAllInbreed ? 'Visa mindre' : `Visa ${inbreeding.length - 5} till`}
                    </Button>
                  )}
                  <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                    F över 12,5 % motsvarar ungefär kusinparning. Värt att fundera på nytt blod
                    för att hålla flocken vital över tid.
                  </p>
                </>
              )}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
