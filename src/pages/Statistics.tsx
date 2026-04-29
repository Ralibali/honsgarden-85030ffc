import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calculator, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, Users, BarChart3, Egg, Bird } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumGate } from '@/components/PremiumGate';
import EmptyState from '@/components/EmptyState';
import AIDeviationAlerts from '@/components/AIDeviationAlerts';
import SmartStatisticsOverview from '@/components/SmartStatisticsOverview';

export default function Statistics() {
  const [showAllInsights, setShowAllInsights] = useState(false);
  const [showAllHens, setShowAllHens] = useState(false);
  const [showAllBreeds, setShowAllBreeds] = useState(false);
  const [showAllFlocks, setShowAllFlocks] = useState(false);
  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['stats-summary'],
    queryFn: () => api.getSummaryStats().catch(() => null),
  });

  const { data: insights } = useQuery({
    queryKey: ['stats-insights'],
    queryFn: () => api.getStatisticsInsights().catch(() => null),
  });

  const { data: feedStats } = useQuery({
    queryKey: ['feed-stats-for-statistics'],
    queryFn: () => api.getFeedStatistics().catch(() => null),
  });

  const { data: hensWithEggs = [] } = useQuery({
    queryKey: ['hens-with-eggs'],
    queryFn: () => api.getHensWithEggTotals().catch(() => []),
  });

  const { data: flockStats } = useQuery({
    queryKey: ['flock-statistics'],
    queryFn: () => api.getFlockStatistics().catch(() => ({ flocks: [], unassigned_eggs: 0 })),
  });

  const costPerEgg = feedStats?.cost_per_egg || 0;
  const revenuePerEgg = insights?.revenue_per_egg || 0;
  const profitPerEgg = revenuePerEgg - costPerEgg;

  if (summaryLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-4 animate-fade-in">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20" />)}
        </div>
      </div>
    );
  }

  const totalEggs = Number(summary?.total_eggs || 0);
  const hasEnoughData = totalEggs > 0;

  const rankedHens = [...hensWithEggs]
    .filter((h: any) => h.hen_type !== 'rooster')
    .sort((a: any, b: any) => (b.total_eggs || 0) - (a.total_eggs || 0));
  const maxEggs = rankedHens.length > 0 ? rankedHens[0]?.total_eggs || 1 : 1;

  const flocks = (flockStats as any)?.flocks || [];
  const unassignedEggs = (flockStats as any)?.unassigned_eggs || 0;
  const maxFlockEggs = flocks.length > 0 ? Math.max(...flocks.map((f: any) => f.total_eggs), 1) : 1;

  return (
    <PremiumGate feature="Statistik" blur>
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Statistik 📊</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">Förstå din hönsgård på ett enkelt och hjälpsamt sätt</p>
        </div>

        <AIDeviationAlerts variant="inline" />

        {!hasEnoughData ? (
          <EmptyState
            icon={BarChart3}
            title="Statistiken vaknar snart till liv"
            description="När du har loggat ägg i några dagar kan Hönsgården börja visa trender, bästa värpdag, snitt per höna och kostnad per ägg. Det här blir din personliga bild av hur flocken mår över tid."
            actionLabel="Logga dagens ägg"
            onAction={() => window.location.assign('/app/eggs')}
            secondaryLabel="Lägg till hönor"
            onSecondaryAction={() => window.location.assign('/app/hens')}
          />
        ) : (
          <>
            <SmartStatisticsOverview />

            {insights && insights.tips && (() => {
              const tips = (Array.isArray(insights.tips) ? insights.tips : [insights.tips]).filter(Boolean);
              const PREVIEW_COUNT = 3;
              const visible = showAllInsights ? tips : tips.slice(0, PREVIEW_COUNT);
              const hiddenCount = tips.length - PREVIEW_COUNT;
              return (
                <Card className="bg-card border-border shadow-sm">
                  <CardHeader className="px-4 sm:px-6">
                    <CardTitle className="font-serif text-base sm:text-lg">📈 Fler insikter</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6 pb-4">
                    <ul className="space-y-2">
                      {visible.map((tip: string, i: number) => (
                        <li key={i} className="flex gap-2 items-start text-sm text-foreground">
                          <span className="text-primary mt-1 shrink-0">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                    {hiddenCount > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllInsights((v) => !v)}
                        className="mt-3 w-full rounded-xl text-primary hover:text-primary"
                      >
                        {showAllInsights ? (
                          <><ChevronUp className="h-4 w-4 mr-1" /> Visa mindre</>
                        ) : (
                          <><ChevronDown className="h-4 w-4 mr-1" /> Visa {hiddenCount} till</>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })()}

            <Card className="bg-gradient-to-br from-primary/10 via-card to-accent/5 border-primary/20 shadow-sm overflow-hidden">
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Egg className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="data-label mb-1">Historik totalt</p>
                    <h2 className="font-serif text-lg sm:text-xl text-foreground">{totalEggs} ägg loggade totalt</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                      Snittet är {summary?.avg_per_day != null ? Number(summary.avg_per_day).toFixed(1) : '–'} ägg per dag. Bästa dagen hittills är {summary?.best_day ?? 'inte beräknad ännu'}. Fortsätt logga så blir insikterna ännu smartare.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { label: 'Totalt ägg', value: summary?.total_eggs ?? '–' },
                { label: 'Snitt/dag', value: summary?.avg_per_day != null ? Number(summary.avg_per_day).toFixed(1) : '–' },
                { label: 'Bästa dag', value: summary?.best_day ?? '–' },
                { label: 'Produktivitet', value: summary?.productivity != null ? `${Math.round(summary.productivity)}%` : '–' },
              ].map((s) => (
                <Card key={s.label} className="bg-card border-border shadow-sm">
                  <CardContent className="p-3 sm:p-4 text-center">
                    <p className="stat-number text-xl sm:text-2xl text-foreground break-words">{s.value}</p>
                    <p className="data-label mt-1 text-[10px] sm:text-xs">{s.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(costPerEgg > 0 || revenuePerEgg > 0) && (
              <Card className="bg-primary/5 border-primary/20 shadow-sm">
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Calculator className="h-5 w-5 text-primary" />
                    <h2 className="font-serif text-base text-primary">Kostnad per ägg</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-background/70 border border-border/40 p-3">
                      <p className="stat-number text-xl text-destructive">{costPerEgg.toFixed(2)} kr</p>
                      <p className="data-label text-[10px] mt-1">Kostnad/ägg</p>
                    </div>
                    <div className="rounded-xl bg-background/70 border border-border/40 p-3">
                      <p className="stat-number text-xl text-success">{revenuePerEgg.toFixed(2)} kr</p>
                      <p className="data-label text-[10px] mt-1">Intäkt/ägg</p>
                    </div>
                    <div className="rounded-xl bg-background/70 border border-border/40 p-3">
                      <p className={`stat-number text-xl ${profitPerEgg >= 0 ? 'text-primary' : 'text-destructive'}`}>{profitPerEgg.toFixed(2)} kr</p>
                      <p className="data-label text-[10px] mt-1">Vinst/ägg</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {flocks.length > 0 && (
              <Card className="bg-card border-border shadow-sm">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="font-serif text-base sm:text-lg">🏠 Ägg per flock</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4">
                  <div className="space-y-4">
                    {(showAllFlocks ? flocks : flocks.slice(0, 5)).map((flock: any) => (
                      <div key={flock.id} className="space-y-1.5 rounded-2xl border border-border/40 bg-muted/15 p-3 sm:border-0 sm:bg-transparent sm:p-0">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate">{flock.name}</span>
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              <Users className="h-3 w-3 mr-0.5" />
                              {flock.active_hens}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {flock.week_change !== null && (
                              <span className={`flex items-center gap-0.5 text-[11px] font-medium ${flock.week_change > 0 ? 'text-success' : flock.week_change < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {flock.week_change > 0 ? <TrendingUp className="h-3 w-3" /> : flock.week_change < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                                {flock.week_change > 0 ? '+' : ''}{flock.week_change}%
                              </span>
                            )}
                            <span className="stat-number text-sm text-primary">{flock.total_eggs} ägg</span>
                          </div>
                        </div>
                        <div className="w-full bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2 transition-all duration-500"
                            style={{ width: `${Math.min(100, (flock.total_eggs / maxFlockEggs) * 100)}%` }}
                          />
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                          <span>Veckan: <strong className="text-foreground">{flock.week_eggs}</strong></span>
                          <span>30 dagar: <strong className="text-foreground">{flock.month_eggs}</strong></span>
                          <span>Snitt/dag: <strong className="text-foreground">{flock.avg_per_day}</strong></span>
                        </div>
                      </div>
                    ))}
                    {flocks.length > 5 && (
                      <button
                        onClick={() => setShowAllFlocks((v) => !v)}
                        className="w-full text-xs font-medium text-primary hover:text-primary/80 transition-colors py-2 rounded-xl hover:bg-muted/40"
                      >
                        {showAllFlocks ? 'Visa mindre' : `Visa ${flocks.length - 5} till`}
                      </button>
                    )}
                    {unassignedEggs > 0 && (
                      <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
                        <span className="text-muted-foreground italic">Ej tilldelade</span>
                        <span className="stat-number text-muted-foreground">{unassignedEggs} ägg</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <Card className="bg-card border-border shadow-sm">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="font-serif text-base sm:text-lg">🏆 Topplista – Hönor</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4">
                  <div className="space-y-3">
                    {rankedHens.length > 0 ? (
                      <>
                        {(showAllHens ? rankedHens : rankedHens.slice(0, 5)).map((hen: any, i: number) => {
                          const eggs = hen.total_eggs || 0;
                          return (
                            <button key={hen.id} onClick={() => window.location.assign(`/app/hens/${hen.id}`)} className="w-full flex items-center gap-2 sm:gap-3 rounded-xl hover:bg-muted/40 p-1.5 transition-colors text-left">
                              <span className="stat-number text-base sm:text-lg w-6 text-center text-muted-foreground shrink-0">
                                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="text-xs sm:text-sm font-medium text-foreground truncate">{hen.name}</span>
                                  <span className="stat-number text-xs sm:text-sm text-primary shrink-0">{eggs} ägg</span>
                                </div>
                                <div className="w-full bg-secondary rounded-full h-1.5">
                                  <div className="bg-primary rounded-full h-1.5 transition-all duration-500" style={{ width: `${Math.min(100, (eggs / maxEggs) * 100)}%` }} />
                                </div>
                              </div>
                            </button>
                          );
                        })}
                        {rankedHens.length > 5 && (
                          <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setShowAllHens(v => !v)}>
                            {showAllHens ? 'Visa mindre' : `Visa ${rankedHens.length - 5} till`}
                          </Button>
                        )}
                      </>
                    ) : (
                      <EmptyState
                        icon={Bird}
                        title="Topplistan väntar på hönor"
                        description="När du kopplar ägg till enskilda hönor kan Hönsgården visa vilka som värper mest och hur utvecklingen ser ut över tid."
                        actionLabel="Gå till hönor"
                        onAction={() => window.location.assign('/app/hens')}
                      />
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border shadow-sm">
                <CardHeader className="px-4 sm:px-6">
                  <CardTitle className="font-serif text-base sm:text-lg">Rasfördelning</CardTitle>
                </CardHeader>
                <CardContent className="px-4 sm:px-6 pb-4">
                  {hensWithEggs.length > 0 ? (() => {
                    const breedEntries = Object.entries(
                      hensWithEggs.reduce((acc: Record<string, number>, hen: any) => {
                        const breed = hen.breed || 'Okänd';
                        acc[breed] = (acc[breed] || 0) + 1;
                        return acc;
                      }, {})
                    ).sort((a, b) => (b[1] as number) - (a[1] as number));
                    const visibleBreeds = showAllBreeds ? breedEntries : breedEntries.slice(0, 5);
                    return (
                      <div className="space-y-2">
                        {visibleBreeds.map(([breed, count]) => (
                          <div key={breed} className="flex items-center justify-between gap-3 text-sm rounded-xl bg-muted/20 px-3 py-2">
                            <span className="text-foreground truncate">{breed}</span>
                            <span className="stat-number text-muted-foreground shrink-0">{count as number} st</span>
                          </div>
                        ))}
                        {breedEntries.length > 5 && (
                          <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setShowAllBreeds(v => !v)}>
                            {showAllBreeds ? 'Visa mindre' : `Visa ${breedEntries.length - 5} till`}
                          </Button>
                        )}
                      </div>
                    );
                  })() : (
                    <EmptyState
                      emoji="🌿"
                      title="Ingen rasdata ännu"
                      description="Fyll gärna i ras på dina hönor. Då blir statistiken mer personlig och flocken lättare att förstå."
                      actionLabel="Uppdatera hönor"
                      onAction={() => window.location.assign('/app/hens')}
                    />
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </PremiumGate>
  );
}
