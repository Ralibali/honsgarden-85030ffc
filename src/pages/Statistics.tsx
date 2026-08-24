import React, { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Bird,
  ChevronDown,
  ChevronUp,
  Download,
  Egg,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { todayLocal } from '@/lib/datetime';
import { downloadMultiSheetExcel } from '@/lib/exportUtils';
import { generateMonthlyReportPdf } from '@/lib/monthlyReportPdf';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { PremiumGate } from '@/components/PremiumGate';
import EmptyState from '@/components/EmptyState';
import AIDeviationAlerts from '@/components/AIDeviationAlerts';
import SmartStatisticsOverview from '@/components/SmartStatisticsOverview';
import EggProductionChart from '@/components/EggProductionChart';
import ProductionForecastCard from '@/components/ProductionForecastCard';
import DaylightRegressionCard from '@/components/DaylightRegressionCard';
import ProductionControlChart from '@/components/ProductionControlChart';
import SeasonDecompositionCard from '@/components/SeasonDecompositionCard';
import LayingRateCard from '@/components/LayingRateCard';
import AgeProductionCard from '@/components/AgeProductionCard';
import FlockSurvivalCard from '@/components/FlockSurvivalCard';
import FeedEfficiencyCard from '@/components/FeedEfficiencyCard';
import HatchStatsCard from '@/components/HatchStatsCard';
import SeasonalityCard from '@/components/SeasonalityCard';
import FlockBenchmarkCard from '@/components/FlockBenchmarkCard';
import HenConsistencyCard from '@/components/HenConsistencyCard';
import CohortAnalysisCard from '@/components/CohortAnalysisCard';
import CorrelationMatrixCard from '@/components/CorrelationMatrixCard';
import PageHeader from '@/components/PageHeader';

type HenEggRow = {
  id: string;
  name?: string | null;
  breed?: string | null;
  hen_type?: string | null;
  total_eggs?: number | null;
};

type FlockStatRow = {
  id: string;
  name: string;
  active_hens: number;
  total_eggs: number;
  week_eggs: number;
  month_eggs: number;
  avg_per_day: number;
  week_change?: number | null;
};

type FlockStatsResult = {
  flocks?: FlockStatRow[];
  unassigned_eggs?: number;
};

export default function Statistics() {
  const [reportLoading, setReportLoading] = useState(false);
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [showAllHens, setShowAllHens] = useState(false);

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['stats-summary'],
    queryFn: () => api.getSummaryStats().catch(() => null),
  });

  const { data: feedStats } = useQuery({
    queryKey: ['feed-stats-for-statistics'],
    queryFn: () => api.getFeedStatistics().catch(() => null),
  });

  const { data: statisticsInsights } = useQuery({
    queryKey: ['stats-insights'],
    queryFn: () => api.getStatisticsInsights().catch(() => null),
  });

  const { data: hensWithEggs = [] } = useQuery({
    queryKey: ['hens-with-eggs'],
    queryFn: () => api.getHensWithEggTotals().catch(() => []),
  });

  const { data: flockStats } = useQuery({
    queryKey: ['flock-statistics'],
    queryFn: () => api.getFlockStatistics().catch(() => ({ flocks: [], unassigned_eggs: 0 })),
  });

  const rankedHens = useMemo(() => {
    return [...(hensWithEggs as HenEggRow[])]
      .filter((hen) => hen.hen_type !== 'rooster')
      .sort((a, b) => Number(b.total_eggs || 0) - Number(a.total_eggs || 0));
  }, [hensWithEggs]);

  const flocks = ((flockStats as FlockStatsResult | undefined)?.flocks || []);
  const totalEggs = Number(summary?.total_eggs || 0);
  const costPerEgg = Number(feedStats?.cost_per_egg || 0);
  const revenuePerEgg = Number(statisticsInsights?.revenue_per_egg || 0);
  const profitPerEgg = revenuePerEgg - costPerEgg;

  if (summaryLoading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-fade-in">
        <Skeleton className="h-12 w-56" />
        <Skeleton className="h-64 rounded-3xl" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  const handleExportExcel = () => {
    const today = todayLocal();
    const summaryRows = [
      { Nyckeltal: 'Totalt ägg', Värde: summary?.total_eggs ?? '' },
      { Nyckeltal: 'Snitt per dag', Värde: summary?.avg_per_day != null ? Number(summary.avg_per_day).toFixed(1) : '' },
      { Nyckeltal: 'Bästa dag', Värde: summary?.best_day ?? '' },
      { Nyckeltal: 'Produktivitet (%)', Värde: summary?.productivity != null ? Math.round(summary.productivity) : '' },
      { Nyckeltal: 'Kostnad per ägg (kr)', Värde: costPerEgg > 0 ? Number(costPerEgg.toFixed(2)) : '' },
      { Nyckeltal: 'Intäkt per ägg (kr)', Värde: revenuePerEgg > 0 ? Number(revenuePerEgg.toFixed(2)) : '' },
      { Nyckeltal: 'Vinst per ägg (kr)', Värde: profitPerEgg !== 0 ? Number(profitPerEgg.toFixed(2)) : '' },
    ];

    const henRows = rankedHens.map((hen) => ({
      Namn: hen.name ?? '',
      Ras: hen.breed ?? '',
      'Totalt ägg': hen.total_eggs ?? 0,
    }));

    const flockRows = flocks.map((flock) => ({
      Namn: flock.name,
      'Aktiva hönor': flock.active_hens,
      'Totalt ägg': flock.total_eggs,
      Veckan: flock.week_eggs,
      '30 dagar': flock.month_eggs,
      'Snitt per dag': flock.avg_per_day,
    }));

    downloadMultiSheetExcel(
      [
        { name: 'Sammanfattning', rows: summaryRows },
        { name: 'Hönor', rows: henRows },
        { name: 'Flockar', rows: flockRows },
      ],
      `honsgarden-statistik-${today}`,
    );
  };

  const handleMonthlyReport = async () => {
    setReportLoading(true);
    try {
      const [eggs, transactions, hens] = await Promise.all([
        api.getEggs(),
        api.getTransactions(),
        api.getHens(),
      ]);

      await generateMonthlyReportPdf({
        month: new Date(),
        eggs: eggs.map((egg) => ({ date: egg.date, count: egg.count })),
        transactions: transactions.map((transaction) => ({
          date: transaction.date,
          type: transaction.type,
          amount: transaction.amount,
        })),
        henCount: hens.length,
        topHens: rankedHens.slice(0, 5).map((hen) => ({
          name: hen.name ?? 'Namnlös',
          breed: hen.breed ?? null,
          totalEggs: hen.total_eggs ?? 0,
        })),
      });

      toast({ title: 'Månadsrapporten är klar 📄' });
    } catch (error) {
      toast({
        title: 'Kunde inte skapa rapporten',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <PremiumGate feature="Statistik" featureKey="statistics" preview>
      <div className="insights-page max-w-5xl mx-auto space-y-5 sm:space-y-7 animate-fade-in">
        <PageHeader
          title="Insikter"
          emoji="✨"
          subtitle="Vad händer i din hönsgård – förklarat så att siffrorna faktiskt blir användbara"
          actions={(
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="rounded-xl shrink-0">
                  <Download className="h-4 w-4 mr-2" />
                  Spara
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="rounded-xl">
                <DropdownMenuItem onClick={handleMonthlyReport} disabled={reportLoading} className="gap-2 cursor-pointer">
                  {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  Månadsrapport som PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportExcel} className="gap-2 cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4" />
                  Rådata som Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        />

        <AIDeviationAlerts variant="inline" />

        {totalEggs <= 0 ? (
          <EmptyState
            icon={Sparkles}
            title="Insikterna vaknar snart"
            description="Logga ägg några dagar så kan Hönsgården börja se mönster, jämföra perioder och berätta vad som verkar förändras i flocken."
            actionLabel="Logga dagens ägg"
            onAction={() => window.location.assign('/app/eggs')}
            secondaryLabel="Lägg till hönor"
            onSecondaryAction={() => window.location.assign('/app/hens')}
          />
        ) : (
          <>
            <SmartStatisticsOverview />

            <section className="insights-main-chart space-y-3" aria-labelledby="production-heading">
              <div className="px-1">
                <p className="data-label">Över tid</p>
                <h2 id="production-heading" className="font-serif text-xl sm:text-2xl text-foreground mt-1">Hur värpningen faktiskt har utvecklats</h2>
                <p className="text-sm text-muted-foreground mt-1">Här är kurvan värd att titta på. Resten kan vänta tills du vill fördjupa dig.</p>
              </div>
              <EggProductionChart />
            </section>

            {(costPerEgg > 0 || revenuePerEgg > 0) && (
              <section className="egg-economy-story">
                <Card className="overflow-hidden">
                  <CardContent className="p-5 sm:p-6">
                    <div className="flex items-start gap-4">
                      <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Wallet className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="data-label">Ekonomin i ett ägg</p>
                        <h2 className="font-serif text-xl text-foreground mt-1">
                          {profitPerEgg >= 0 ? 'Du ligger på plus per ägg' : 'Kostnaden är högre än intäkten just nu'}
                        </h2>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                          Ett ägg kostar ungefär <strong className="text-foreground">{costPerEgg.toFixed(2)} kr</strong> i registrerad foderkostnad
                          {revenuePerEgg > 0 ? <> och ger ungefär <strong className="text-foreground">{revenuePerEgg.toFixed(2)} kr</strong> i intäkt.</> : '.'}
                          {revenuePerEgg > 0 ? <> Det motsvarar <strong className={profitPerEgg >= 0 ? 'text-primary' : 'text-destructive'}>{profitPerEgg.toFixed(2)} kr per ägg</strong> före andra kostnader.</> : null}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </section>
            )}

            <section className="flock-story space-y-3" aria-labelledby="flock-story-heading">
              <div className="px-1">
                <p className="data-label">Flocken bakom siffrorna</p>
                <h2 id="flock-story-heading" className="font-serif text-xl sm:text-2xl text-foreground mt-1">Vilka bidrar mest just nu?</h2>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <Card className="flock-ranking-card">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <Bird className="h-4 w-4 text-primary" />
                        <h3 className="font-serif text-lg text-foreground">Hönorna</h3>
                      </div>
                      <Badge variant="secondary">{rankedHens.length} profiler</Badge>
                    </div>

                    {rankedHens.length > 0 ? (
                      <div className="space-y-1">
                        {(showAllHens ? rankedHens : rankedHens.slice(0, 5)).map((hen, index) => (
                          <button
                            key={hen.id}
                            onClick={() => window.location.assign(`/app/hens/${hen.id}`)}
                            className="flock-ranking-row w-full"
                          >
                            <span className="flock-ranking-position">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : index + 1}</span>
                            <span className="min-w-0 flex-1 text-left">
                              <strong className="block truncate">{hen.name || 'Namnlös höna'}</strong>
                              <small className="block truncate">{hen.breed || 'Ras ej angiven'}</small>
                            </span>
                            <span className="flock-ranking-value">{Number(hen.total_eggs || 0)} ägg</span>
                          </button>
                        ))}
                        {rankedHens.length > 5 && (
                          <Button variant="ghost" size="sm" className="w-full mt-2 rounded-xl" onClick={() => setShowAllHens((value) => !value)}>
                            {showAllHens ? 'Visa färre' : `Visa ${rankedHens.length - 5} hönor till`}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <EmptyState
                        icon={Bird}
                        title="Ingen individuell topplista ännu"
                        description="Koppla några ägg till enskilda hönor så blir deras profiler och den här jämförelsen mer levande."
                        actionLabel="Öppna flocken"
                        onAction={() => window.location.assign('/app/hens')}
                      />
                    )}
                  </CardContent>
                </Card>

                <Card className="flock-ranking-card">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between gap-2 mb-4">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <h3 className="font-serif text-lg text-foreground">Flockarna</h3>
                      </div>
                      <Badge variant="secondary">{flocks.length} flockar</Badge>
                    </div>

                    {flocks.length > 0 ? (
                      <div className="space-y-2.5">
                        {flocks.slice(0, 5).map((flock) => (
                          <div key={flock.id} className="flock-plain-row">
                            <div className="min-w-0">
                              <strong className="block truncate">{flock.name}</strong>
                              <small>{flock.active_hens} aktiva hönor · {flock.week_eggs} ägg denna vecka</small>
                            </div>
                            <span>{flock.total_eggs} ägg</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-border/50 p-6 text-center">
                        <p className="text-sm font-medium text-foreground">Du använder inga separata flockar ännu</p>
                        <p className="text-xs text-muted-foreground mt-1">Det är helt okej – den här delen blir användbar först när du vill dela upp hönsen.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </section>

            <section className="deep-insights-section">
              <button
                type="button"
                onClick={() => setShowDeepDive((value) => !value)}
                className="deep-insights-toggle w-full"
                aria-expanded={showDeepDive}
              >
                <span className="flex items-start gap-3 text-left">
                  <span className="w-10 h-10 rounded-2xl bg-primary/8 flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </span>
                  <span>
                    <strong className="font-serif text-lg text-foreground">Fördjupa dig</strong>
                    <small className="block text-xs text-muted-foreground mt-1">Prognoser, dagsljus, säsong, kontrollkurvor och mer avancerade jämförelser</small>
                  </span>
                </span>
                {showDeepDive ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
              </button>

              {showDeepDive && (
                <div className="deep-insights-content space-y-4 mt-4 animate-fade-in">
                  <ProductionForecastCard />
                  <DaylightRegressionCard />
                  <ProductionControlChart />
                  <SeasonDecompositionCard />
                  <LayingRateCard />
                  <AgeProductionCard />
                  <FlockSurvivalCard />
                  <FeedEfficiencyCard />
                  <HatchStatsCard />
                  <SeasonalityCard />
                  <FlockBenchmarkCard />
                  <HenConsistencyCard />
                  <CohortAnalysisCard />
                  <CorrelationMatrixCard />
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </PremiumGate>
  );
}
