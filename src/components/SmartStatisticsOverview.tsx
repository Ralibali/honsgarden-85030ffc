import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/api';
import {
  ArrowRight,
  Bird,
  Calculator,
  CalendarDays,
  Egg,
  Minus,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Wheat,
  AlertCircle,
} from 'lucide-react';

type Period = '7d' | '30d' | 'all';

type InsightItem = {
  title: string;
  text: string;
  icon: React.ComponentType<{ className?: string }>;
  path?: string;
  cta?: string;
  tone?: 'good' | 'warn' | 'info';
};

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
  if (diff > 0) return { label: `+${diff}`, text: 'uppåt', sentence: `${diff} fler ägg än perioden innan`, icon: TrendingUp, className: 'text-success', tone: 'good' as const };
  if (diff < 0) return { label: `${diff}`, text: 'nedåt', sentence: `${Math.abs(diff)} färre ägg än perioden innan`, icon: TrendingDown, className: 'text-warning', tone: 'warn' as const };
  return { label: '±0', text: 'stabilt', sentence: 'ungefär samma nivå som perioden innan', icon: Minus, className: 'text-muted-foreground', tone: 'info' as const };
}

export default function SmartStatisticsOverview() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState<Period>('7d');
  const [showAllInsights, setShowAllInsights] = useState(false);

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs().catch(() => []) });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens().catch(() => []) });
  const { data: feedStats } = useQuery({ queryKey: ['smart-feed-stats'], queryFn: () => api.getFeedStatistics().catch(() => null) });
  const { data: hensWithEggs = [] } = useQuery({ queryKey: ['smart-hens-with-eggs'], queryFn: () => api.getHensWithEggTotals().catch(() => []) });

  const activeHens = useMemo(
    () => hens.filter((hen) => hen.is_active && hen.hen_type !== 'rooster'),
    [hens],
  );

  const stats = useMemo(() => {
    const now = new Date();
    const currentStart = period === '7d' ? daysAgo(7) : period === '30d' ? daysAgo(30) : new Date('1970-01-01');
    const previousStart = period === '7d' ? daysAgo(14) : period === '30d' ? daysAgo(60) : null;
    const previousEnd = period === '7d' ? daysAgo(7) : period === '30d' ? daysAgo(30) : null;

    const currentEggs = eggs.filter((egg) => new Date(egg.date) >= currentStart);
    const previousEggs = previousStart && previousEnd
      ? eggs.filter((egg) => {
          const date = new Date(egg.date);
          return date >= previousStart && date < previousEnd;
        })
      : [];

    const currentTotal = currentEggs.reduce((sum, egg) => sum + (egg.count || 0), 0);
    const previousTotal = previousEggs.reduce((sum, egg) => sum + (egg.count || 0), 0);
    const diff = period === 'all' ? 0 : currentTotal - previousTotal;
    const daysInPeriod = period === '7d'
      ? 7
      : period === '30d'
        ? 30
        : Math.max(1, Math.ceil((now.getTime() - currentStart.getTime()) / 86400000));
    const avgPerDay = currentTotal / Math.max(1, daysInPeriod);
    const avgPerHen = activeHens.length > 0 ? avgPerDay / activeHens.length : 0;

    const dayTotals: Record<string, number> = {};
    currentEggs.forEach((egg) => {
      dayTotals[egg.date] = (dayTotals[egg.date] || 0) + (egg.count || 0);
    });
    const bestDay = Object.entries(dayTotals).sort((a, b) => b[1] - a[1])[0] || null;

    return {
      currentTotal,
      previousTotal,
      diff,
      avgPerDay,
      avgPerHen,
      daysWithLogs: Object.keys(dayTotals).length,
      bestDay,
    };
  }, [eggs, period, activeHens.length]);

  const trend = trendMeta(stats.diff);
  const TrendIcon = trend.icon;
  const costPerEgg = feedStats?.cost_per_egg || 0;

  const topHen = useMemo(() => {
    return [...hensWithEggs]
      .filter((hen) => hen.hen_type !== 'rooster' && Number(hen.total_eggs || 0) > 0)
      .sort((a, b) => Number(b.total_eggs || 0) - Number(a.total_eggs || 0))[0] || null;
  }, [hensWithEggs]);

  const insights = useMemo<InsightItem[]>(() => {
    const items: InsightItem[] = [];

    if (stats.currentTotal === 0) {
      items.push({
        title: 'Vi behöver några fler dagar',
        text: 'Logga äggen ett par dagar till. Sedan kan Hönsgården börja se mönster som faktiskt är värda att reagera på.',
        icon: Egg,
        path: '/app/eggs',
        cta: 'Logga dagens ägg',
        tone: 'info',
      });
    } else if (stats.diff > 0 && period !== 'all') {
      items.push({
        title: 'Flocken har en fin period',
        text: `Du ligger ${stats.diff} ägg över föregående period. Om rutiner, foder och väder varit ungefär desamma är det ett gott tecken.`,
        icon: TrendingUp,
        path: '/app/weekly-report',
        cta: 'Se veckan',
        tone: 'good',
      });
    } else if (stats.diff < 0 && period !== 'all') {
      items.push({
        title: 'Lite lugnare i redena',
        text: `Du ligger ${Math.abs(stats.diff)} ägg under perioden innan. Det behöver inte vara något konstigt – ruggning, väder, ålder och små förändringar i vardagen kan spela in.`,
        icon: AlertCircle,
        path: '/app/hens',
        cta: 'Titta på flocken',
        tone: 'warn',
      });
    } else if (period !== 'all') {
      items.push({
        title: 'Jämn och stabil värpning',
        text: 'Produktionen ligger ungefär på samma nivå som perioden innan. Stabilitet är ofta precis det man vill se.',
        icon: Minus,
        tone: 'info',
      });
    }

    if (activeHens.length > 0 && stats.avgPerHen > 0) {
      items.push({
        title: 'Så ser det ut per höna',
        text: `Flocken ligger på ungefär ${formatDecimal(stats.avgPerHen, 2)} ägg per höna och dag. Det gör jämförelsen rättvisare när flocken förändras.`,
        icon: Bird,
        tone: 'info',
      });
    }

    if (!costPerEgg) {
      items.push({
        title: 'Vill du veta vad äggen kostar?',
        text: 'Lägg in senaste foderinköpet så räknar Hönsgården ut en ungefärlig kostnad per ägg åt dig.',
        icon: Wheat,
        path: '/app/feed',
        cta: 'Lägg till foder',
        tone: 'info',
      });
    } else {
      items.push({
        title: 'Du har koll på kostnaden',
        text: `Fodret motsvarar just nu ungefär ${formatKr(costPerEgg)} per ägg. Det är särskilt användbart om du säljer från Äggboden.`,
        icon: Calculator,
        path: '/app/feed',
        cta: 'Se foder',
        tone: 'info',
      });
    }

    if (!topHen && activeHens.length > 0) {
      items.push({
        title: 'Gör hönsprofilerna ännu mer levande',
        text: 'Koppla ägg till enskilda hönor ibland. Då kan du se vem som värper mest och följa förändringar över tid.',
        icon: Target,
        path: '/app/hens',
        cta: 'Öppna flocken',
        tone: 'info',
      });
    } else if (topHen) {
      items.push({
        title: `${topHen.name} sticker ut`,
        text: `${topHen.name} har ${Number(topHen.total_eggs || 0)} ägg loggade totalt och leder just nu din egen lilla topplista.`,
        icon: Target,
        path: `/app/hens/${topHen.id}`,
        cta: 'Hälsa på',
        tone: 'good',
      });
    }

    return items;
  }, [stats, period, activeHens.length, costPerEgg, topHen]);

  const visibleInsights = showAllInsights ? insights : insights.slice(0, 2);
  const periodLabel = period === '7d' ? 'senaste sju dagarna' : period === '30d' ? 'senaste trettio dagarna' : 'sedan du började logga';

  return (
    <section className="farm-insights-overview space-y-4" aria-label="Din hönsgård i siffror">
      <div className="farm-period-switch grid grid-cols-3 gap-1 rounded-2xl bg-muted/40 p-1 w-full sm:w-fit">
        {[
          { key: '7d', label: '7 dagar' },
          { key: '30d', label: '30 dagar' },
          { key: 'all', label: 'All tid' },
        ].map((item) => (
          <button
            key={item.key}
            onClick={() => setPeriod(item.key as Period)}
            className={`min-h-11 rounded-xl px-3 text-xs font-medium transition-all ${
              period === item.key
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Card className="farm-story-card overflow-hidden border-primary/15">
        <CardContent className="p-5 sm:p-7">
          <div className="flex items-start gap-4">
            <div className="farm-story-icon w-12 h-12 rounded-2xl flex items-center justify-center shrink-0">
              <span className="text-2xl" aria-hidden="true">🥚</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="data-label mb-1">Så mår värpningen just nu</p>
              <h2 className="font-serif text-xl sm:text-2xl text-foreground leading-tight">
                {stats.currentTotal} ägg {periodLabel}
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mt-2 max-w-2xl">
                Det blir ungefär {formatDecimal(stats.avgPerDay)} ägg om dagen
                {activeHens.length > 0 ? ` från ${activeHens.length} aktiva hönor` : ''}.
                {period !== 'all' ? ` Jämfört med perioden innan är det ${trend.sentence}.` : ' Ju längre du loggar, desto tydligare blir din egen gårds historia.'}
              </p>

              {stats.bestDay && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-background/65 border border-border/40 px-3 py-1.5 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  Bästa dagen i perioden: <strong className="text-foreground">{stats.bestDay[1]} ägg</strong>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="farm-readable-metrics grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="farm-readable-metric">
          <Egg className="h-4 w-4" />
          <div>
            <span>{formatDecimal(stats.avgPerDay)}</span>
            <p>ägg per dag i snitt</p>
          </div>
        </div>
        <div className="farm-readable-metric">
          <TrendIcon className={`h-4 w-4 ${trend.className}`} />
          <div>
            <span>{period === 'all' ? 'Historik' : trend.label}</span>
            <p>{period === 'all' ? 'din samlade gårdsdata' : trend.sentence}</p>
          </div>
        </div>
        <div className="farm-readable-metric">
          <Bird className="h-4 w-4" />
          <div>
            <span>{activeHens.length ? formatDecimal(stats.avgPerHen, 2) : '–'}</span>
            <p>ägg per höna och dag</p>
          </div>
        </div>
      </div>

      <div className="farm-meaning-section">
        <div className="flex items-end justify-between gap-3 mb-3 px-1">
          <div>
            <p className="data-label">Det här betyder något</p>
            <h3 className="font-serif text-lg sm:text-xl text-foreground mt-1">Saker värda att lägga märke till</h3>
          </div>
          <Sparkles className="h-5 w-5 text-primary/60 shrink-0" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {visibleInsights.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className={`farm-meaning-card ${item.tone === 'good' ? 'is-good' : item.tone === 'warn' ? 'is-warn' : ''}`}
              >
                <div className="farm-meaning-card__icon"><Icon className="h-4 w-4" /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-serif text-base text-foreground">{item.title}</p>
                    {item.tone === 'good' && <Badge variant="secondary" className="text-[10px]">Fint tecken</Badge>}
                    {item.tone === 'warn' && <Badge variant="secondary" className="text-[10px]">Håll lite koll</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{item.text}</p>
                  {item.path && item.cta && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="mt-2 h-9 px-0 gap-1.5 text-primary hover:bg-transparent"
                      onClick={() => navigate(item.path!)}
                    >
                      {item.cta}<ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {insights.length > 2 && (
          <button
            onClick={() => setShowAllInsights((value) => !value)}
            className="w-full mt-3 text-xs font-medium text-primary hover:text-primary/80 transition-colors py-2.5 rounded-xl hover:bg-muted/30"
          >
            {showAllInsights ? 'Visa mindre' : `Visa ${insights.length - 2} saker till`}
          </button>
        )}
      </div>
    </section>
  );
}
