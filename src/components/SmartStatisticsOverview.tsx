import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import { ArrowRight, BarChart3, Bird, Calculator, CalendarDays, Egg, Minus, Sparkles, Target, TrendingDown, TrendingUp, Wheat, AlertCircle } from 'lucide-react';

type Period = '7d' | '30d' | 'all';

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function formatDecimal(value: number, digits = 1) {
  return value.toFixed(digits).replace('.', ',');
}

function formatKr(value: number) {
  return `${value.toFixed(2).replace('.', ',')} kr`;
}

function trendMeta(diff: number) {
  if (diff > 0) return { label: `+${diff}`, text: 'uppåt', icon: TrendingUp, className: 'text-success', tone: 'good' as const };
  if (diff < 0) return { label: `${diff}`, text: 'nedåt', icon: TrendingDown, className: 'text-destructive', tone: 'warn' as const };
  return { label: '±0', text: 'stabilt', icon: Minus, className: 'text-muted-foreground', tone: 'info' as const };
}

export default function SmartStatisticsOverview() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('7d');

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs().catch(() => []) });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens().catch(() => []) });
  const { data: feedStats } = useQuery({ queryKey: ['smart-feed-stats'], queryFn: () => api.getFeedStatistics().catch(() => null) });
  const { data: hensWithEggs = [] } = useQuery({ queryKey: ['smart-hens-with-eggs'], queryFn: () => api.getHensWithEggTotals().catch(() => []) });

  const activeHens = useMemo(() => (hens as any[]).filter((h) => h.is_active && h.hen_type !== 'rooster'), [hens]);

  const stats = useMemo(() => {
    const now = new Date();
    const currentStart = period === '7d' ? daysAgo(7) : period === '30d' ? daysAgo(30) : new Date('1970-01-01');
    const previousStart = period === '7d' ? daysAgo(14) : period === '30d' ? daysAgo(60) : null;
    const previousEnd = period === '7d' ? daysAgo(7) : period === '30d' ? daysAgo(30) : null;

    const currentEggs = (eggs as any[]).filter((e) => new Date(e.date) >= currentStart);
    const previousEggs = previousStart && previousEnd
      ? (eggs as any[]).filter((e) => {
          const date = new Date(e.date);
          return date >= previousStart && date < previousEnd;
        })
      : [];

    const currentTotal = currentEggs.reduce((sum, e) => sum + (e.count || 0), 0);
    const previousTotal = previousEggs.reduce((sum, e) => sum + (e.count || 0), 0);
    const diff = period === 'all' ? 0 : currentTotal - previousTotal;
    const daysInPeriod = period === '7d' ? 7 : period === '30d' ? 30 : Math.max(1, Math.ceil((now.getTime() - currentStart.getTime()) / 86400000));
    const avgPerDay = currentTotal / Math.max(1, daysInPeriod);
    const avgPerHen = activeHens.length > 0 ? avgPerDay / activeHens.length : 0;

    const dayTotals: Record<string, number> = {};
    currentEggs.forEach((e) => { dayTotals[e.date] = (dayTotals[e.date] || 0) + (e.count || 0); });
    const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0] || null;

    return { currentTotal, previousTotal, diff, avgPerDay, avgPerHen, daysWithLogs: Object.keys(dayTotals).length, bestDay };
  }, [eggs, period, activeHens.length]);

  const trend = trendMeta(stats.diff);
  const TrendIcon = trend.icon;
  const costPerEgg = feedStats?.cost_per_egg || 0;

  const topHen = useMemo(() => {
    return [...(hensWithEggs as any[])]
      .filter((h) => h.hen_type !== 'rooster' && Number(h.total_eggs || 0) > 0)
      .sort((a, b) => Number(b.total_eggs || 0) - Number(a.total_eggs || 0))[0] || null;
  }, [hensWithEggs]);

  const insights = useMemo(() => {
    const items: { title: string; text: string; icon: any; path?: string; cta?: string; tone?: 'good' | 'warn' | 'info' }[] = [];

    if (stats.currentTotal === 0) {
      items.push({ title: 'Statistiken behöver mer data', text: 'Logga ägg några dagar till så kan Hönsgården visa trender, snitt och jämförelser som faktiskt betyder något.', icon: Egg, path: '/app/eggs', cta: 'Logga ägg', tone: 'info' });
    } else if (stats.diff > 0 && period !== 'all') {
      items.push({ title: 'Produktionen är uppåt', text: `Du ligger ${stats.diff} ägg över föregående period. Det är värt att fortsätta med samma rutiner och foder.`, icon: TrendingUp, path: '/app/weekly-report', cta: 'Se veckorapport', tone: 'good' });
    } else if (stats.diff < 0 && period !== 'all') {
      items.push({ title: 'Produktionen är lägre', text: `Du ligger ${Math.abs(stats.diff)} ägg under föregående period. Det kan vara normalt, men håll koll på ruggning, väder, foderbyte och stress. Öppna en höna och lägg en hälsonotering så har du historiken kvar.`, icon: AlertCircle, path: '/app/hens', cta: 'Öppna hönor', tone: 'warn' });
    } else if (period !== 'all') {
      items.push({ title: 'Stabil värpning', text: 'Produktionen ligger ungefär på samma nivå som föregående period. Stabilitet är också en bra signal.', icon: Minus, tone: 'info' });
    }

    if (activeHens.length > 0 && stats.avgPerHen > 0) {
      items.push({ title: 'Snitt per höna', text: `Snittet är ungefär ${formatDecimal(stats.avgPerHen, 2)} ägg per höna och dag. Det gör statistiken mer rättvis när flocken växer eller minskar.`, icon: Bird, tone: 'info' });
    }

    if (!costPerEgg) {
      items.push({ title: 'Räkna kostnad per ägg', text: 'Lägg till senaste foderinköpet så kan Hönsgården börja visa ungefärlig kostnad per ägg.', icon: Wheat, path: '/app/feed', cta: 'Lägg till foder', tone: 'info' });
    } else {
      items.push({ title: 'Foderkostnad synlig', text: `Foderkostnaden ligger runt ${formatKr(costPerEgg)} per ägg. Det är stark data om du säljer ägg eller jämför foder.`, icon: Calculator, path: '/app/feed', cta: 'Se foder', tone: 'info' });
    }

    if (!topHen && activeHens.length > 0) {
      items.push({ title: 'Koppla ägg till hönor', text: 'Logga ägg på enskilda hönor om du vill se vem som värper mest och vem som behöver extra koll.', icon: Target, path: '/app/hens', cta: 'Se hönor', tone: 'info' });
    } else if (topHen) {
      items.push({ title: `${topHen.name} leder topplistan`, text: `${topHen.name} har ${Number(topHen.total_eggs || 0)} ägg loggade totalt. Det här gör hönsprofilerna mer levande och användbara.`, icon: Target, path: `/app/hens/${topHen.id}`, cta: 'Öppna profil', tone: 'good' });
    }

    return items;
  }, [stats, period, activeHens.length, costPerEgg, topHen]);

  const [showAllInsights, setShowAllInsights] = useState(false);
  const visibleInsights = showAllInsights ? insights : insights.slice(0, 2);

  return (
    <section className="space-y-3 sm:space-y-4" aria-label="Smart statistiköversikt">
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-muted/50 p-1 w-full sm:w-fit">
        {[
          { key: '7d', label: '7 dagar' },
          { key: '30d', label: '30 dagar' },
          { key: 'all', label: 'Totalt' },
        ].map((p) => (
          <button key={p.key} onClick={() => setPeriod(p.key as Period)} className={`min-h-11 rounded-xl px-3 text-xs font-medium transition-colors ${period === p.key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      <Card className="bg-gradient-to-br from-primary/10 via-card to-accent/5 border-primary/20 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0"><Sparkles className="h-5 w-5 text-primary" /></div>
            <div className="min-w-0">
              <p className="data-label mb-1">Hönsgården tolkar statistiken</p>
              <h2 className="font-serif text-lg sm:text-xl text-foreground leading-tight">
                {stats.currentTotal} ägg {period === '7d' ? 'senaste 7 dagarna' : period === '30d' ? 'senaste 30 dagarna' : 'totalt'}
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed mt-1">
                Snittet är {formatDecimal(stats.avgPerDay)} ägg per dag. {period !== 'all' ? `Trenden är ${trend.text} jämfört med perioden innan.` : 'Totalläget visar hur hönsgården utvecklats över tid.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Perioden', value: stats.currentTotal, icon: Egg },
          { label: 'Trend', value: period === 'all' ? '–' : trend.label, icon: TrendIcon, className: trend.className },
          { label: 'Snitt/dag', value: formatDecimal(stats.avgPerDay), icon: BarChart3 },
          { label: 'Per höna/dag', value: activeHens.length ? formatDecimal(stats.avgPerHen, 2) : '–', icon: Bird },
          { label: 'Loggdagar', value: stats.daysWithLogs, icon: CalendarDays },
        ].map((s) => (
          <Card key={s.label} className="bg-card border-border shadow-sm">
            <CardContent className="p-3 sm:p-4 text-center">
              <s.icon className={`h-4 w-4 mx-auto mb-1 ${s.className || 'text-primary'}`} />
              <p className={`stat-number text-xl sm:text-2xl break-words ${s.className || 'text-foreground'}`}>{s.value}</p>
              <p className="data-label mt-1 text-[10px] sm:text-xs">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6 pb-2">
          <CardTitle className="font-serif text-base sm:text-lg flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Smarta insikter</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {visibleInsights.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className={`rounded-2xl border p-4 ${item.tone === 'good' ? 'bg-success/5 border-success/20' : item.tone === 'warn' ? 'bg-warning/5 border-warning/20' : 'bg-muted/20 border-border/50'}`}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-background/80 border border-border/40 flex items-center justify-center shrink-0"><Icon className="h-4 w-4 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        {item.tone === 'good' && <Badge variant="secondary" className="text-[10px] bg-success/10 text-success border-success/20">Bra</Badge>}
                        {item.tone === 'warn' && <Badge variant="secondary" className="text-[10px] bg-warning/10 text-warning border-warning/20">Håll koll</Badge>}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">{item.text}</p>
                      {item.path && item.cta && (
                        <Button size="sm" variant="outline" className="mt-3 rounded-xl h-9 gap-1.5" onClick={() => navigate(item.path!)}>
                          {item.cta}<ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {insights.length > 2 && (
            <button
              onClick={() => setShowAllInsights((v) => !v)}
              className="w-full mt-3 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-2 rounded-xl hover:bg-muted/40"
            >
              {showAllInsights ? 'Visa mindre' : `Visa ${insights.length - 2} insikter till`}
            </button>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
