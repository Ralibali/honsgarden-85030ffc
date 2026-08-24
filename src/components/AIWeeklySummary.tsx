import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format, startOfWeek, endOfWeek, subDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import {
  Sparkles, ArrowRight, Loader2, Egg, Bird, Wheat, Bell, TrendingUp,
  Heart, Calendar,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { api } from '@/lib/api';

type NextStep = { title: string; text: string; cta?: { label: string; path: string } };
type WeeklyReport = {
  summary: string;
  insights: string[];
  next_steps: NextStep[];
  closing?: string | null;
};

function getSeason(): string {
  const m = new Date().getMonth();
  if (m >= 2 && m <= 4) return 'vår';
  if (m >= 5 && m <= 7) return 'sommar';
  if (m >= 8 && m <= 10) return 'höst';
  return 'vinter';
}

function pickIcon(path?: string) {
  if (!path) return Sparkles;
  if (path.includes('/eggs')) return Egg;
  if (path.includes('/hens')) return Bird;
  if (path.includes('/feed')) return Wheat;
  if (path.includes('/tasks')) return Bell;
  if (path.includes('/statistics') || path.includes('/weekly-report')) return TrendingUp;
  if (path.includes('/hatching')) return Heart;
  return Sparkles;
}

export default function AIWeeklySummary() {
  const navigate = useNavigate();
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
  const prevWeekStart = subDays(weekStart, 7);
  const prevWeekEnd = subDays(weekStart, 1);
  const weekLabel = `${format(weekStart, 'd MMM', { locale: sv })} – ${format(weekEnd, 'd MMM yyyy', { locale: sv })}`;

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs(), staleTime: 60_000 });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000 });
  const { data: feedStats } = useQuery({ queryKey: ['feed-stats'], queryFn: () => api.getFeedStatistics().catch(() => null), staleTime: 60_000 });
  const { data: chores = [] } = useQuery({ queryKey: ['daily-chores'], queryFn: () => api.getDailyChores().catch(() => []), staleTime: 60_000 });
  const { data: hatchings = [] } = useQuery({ queryKey: ['hatchings'], queryFn: () => api.getHatchings().catch(() => []), staleTime: 60_000 });
  const { data: healthLogs = [] } = useQuery({ queryKey: ['health-logs'], queryFn: () => api.getHealthLogs().catch(() => []), staleTime: 60_000 });
  const { data: streakData } = useQuery({ queryKey: ['streak'], queryFn: () => api.getStreak().catch(() => null), staleTime: 60_000 });

  const weekData = useMemo(() => {
    const ws = format(weekStart, 'yyyy-MM-dd');
    const we = format(weekEnd, 'yyyy-MM-dd');
    const pws = format(prevWeekStart, 'yyyy-MM-dd');
    const pwe = format(prevWeekEnd, 'yyyy-MM-dd');

    const inWeek = (eggs as any[]).filter((e) => e.date >= ws && e.date <= we);
    const inPrev = (eggs as any[]).filter((e) => e.date >= pws && e.date <= pwe);
    const weekEggs = inWeek.reduce((s, e) => s + (e.count || 0), 0);
    const prevWeekEggs = inPrev.reduce((s, e) => s + (e.count || 0), 0);

    const dayMap: Record<string, number> = {};
    inWeek.forEach((e) => { dayMap[e.date] = (dayMap[e.date] || 0) + (e.count || 0); });
    const bestEntry = Object.entries(dayMap).sort((a, b) => b[1] - a[1])[0];
    const bestDay = bestEntry ? format(new Date(bestEntry[0]), 'EEEE', { locale: sv }) : '—';

    const henCount = (hens as any[]).filter((h) => h.is_active && h.hen_type !== 'rooster').length;
    const daysInWeek = Math.min(7, Math.ceil((now.getTime() - weekStart.getTime()) / 86400000) + 1);
    const avgPerDay = daysInWeek > 0 ? weekEggs / daysInWeek : 0;

    const completedChores = (chores as any[]).filter((c: any) => c.completed).length;
    const missedChores = (chores as any[]).filter((c: any) => c.next_due_at && !c.completed && new Date(c.next_due_at) < now).length;

    const activeHatchings = (hatchings as any[]).filter((h: any) => h.status === 'incubating' || h.status === 'active').length;
    const healthNotes = (healthLogs as any[]).filter((l: any) => l.type !== 'diary' && l.date >= ws && l.date <= we).length;

    return {
      weekLabel,
      season: getSeason(),
      weekEggs,
      prevWeekEggs,
      avgPerDay,
      henCount,
      bestDay,
      feedCost: (feedStats as any)?.total_cost ?? 0,
      costPerEgg: (feedStats as any)?.cost_per_egg ?? null,
      streak: (streakData as any)?.current_streak ?? 0,
      completedChores,
      missedChores,
      activeHatchings,
      healthNotes,
    };
  }, [eggs, hens, feedStats, chores, hatchings, healthLogs, streakData, weekLabel]);

  const fallback: WeeklyReport = useMemo(() => {
    const diff = weekData.weekEggs - weekData.prevWeekEggs;
    const insights: string[] = [];
    let summary = '';
    const nextSteps: NextStep[] = [];

    if (weekData.henCount === 0) {
      summary = 'Rapporten väntar på att du lägger in din första höna. När flocken är registrerad börjar Hönsgården följa veckans rytm med dig.';
      insights.push('Logga ägg i några dagar så blir rapporten mer användbar.');
      nextSteps.push({
        title: 'Lägg till din första höna',
        text: 'Då kan rapporten börja koppla ägg och historik till flocken.',
        cta: { label: 'Lägg till höna', path: '/app/hens' },
      });
    } else if (weekData.weekEggs === 0) {
      summary = 'Inga ägg är loggade den här veckan ännu. Logga några dagar så börjar mönstren visa sig.';
      insights.push('Logga ägg i några dagar så blir rapporten mer användbar.');
      nextSteps.push({
        title: 'Logga veckans första ägg',
        text: 'Det tar några sekunder och gör hela rapporten betydligt smartare.',
        cta: { label: 'Logga ägg', path: '/app/eggs' },
      });
    } else {
      const trend =
        diff > 0
          ? `${diff} fler ägg än förra veckan`
          : diff < 0
          ? `${Math.abs(diff)} färre ägg än förra veckan`
          : 'samma nivå som förra veckan';
      summary = `Den här veckan har du loggat ${weekData.weekEggs} ägg, ${trend}. Bästa värpdagen var ${weekData.bestDay.toLowerCase()} och snittet ligger på ${weekData.avgPerDay.toFixed(1)} ägg per dag.`;

      if (diff > 0) insights.push('Produktionen är uppåt – fortsätt med samma rutiner och foder.');
      else if (diff < 0) insights.push('Produktionen är lägre än förra veckan. Håll lite extra koll på ruggning, foder, väder och stress.');
      else insights.push('Produktionen ligger stabilt jämfört med förra veckan. Stabilitet är också ett bra tecken.');

      insights.push(`Snittet är ${weekData.avgPerDay.toFixed(1)} ägg per dag på ${weekData.henCount} aktiva hönor.`);
    }

    if (weekData.costPerEgg) {
      insights.push(`Foderkostnaden ligger ungefär ${weekData.costPerEgg.toFixed(2)} kr per ägg.`);
    } else if (weekData.henCount > 0) {
      insights.push('Inga foderposter loggade ännu – med dem kan rapporten visa kostnad per ägg.');
      nextSteps.push({
        title: 'Lägg till foderkostnad',
        text: 'Då kan Hönsgården räkna ut vad varje ägg faktiskt kostar.',
        cta: { label: 'Lägg till foder', path: '/app/feed' },
      });
    }

    if (weekData.missedChores > 0) {
      insights.push(`Du har ${weekData.missedChores} missad${weekData.missedChores === 1 ? '' : 'a'} rutin${weekData.missedChores === 1 ? '' : 'er'} – små sysslor gör störst skillnad i vardagen.`);
      nextSteps.push({
        title: 'Bocka av sysslor',
        text: 'Börja med vatten och rengöring av reden – det gör störst nytta direkt.',
        cta: { label: 'Öppna sysslor', path: '/app/tasks' },
      });
    } else if ((chores as any[]).length === 0 && weekData.henCount > 0) {
      insights.push('Inga återkommande rutiner är upplagda – en enkel rutin räcker långt.');
      nextSteps.push({
        title: 'Skapa en rutin',
        text: 'Till exempel vatten, foder, rengöring eller kvalsterkoll.',
        cta: { label: 'Skapa rutin', path: '/app/tasks' },
      });
    }

    if (weekData.streak >= 7) {
      insights.push(`Du har loggat ${weekData.streak} dagar i rad – fantastiskt jobbat.`);
    }

    return {
      summary,
      insights: insights.slice(0, 5),
      next_steps: nextSteps.slice(0, 3),
      closing: weekData.weekEggs > 0
        ? 'Fortsätt så – små steg varje dag bygger en riktigt fin hönsvardag.'
        : 'En liten loggning idag räcker långt. Hönsgården hänger med dig hela vägen.',
    };
  }, [weekData, chores]);

  const cacheKey = useMemo(() => [
    'weekly-insights-v2',
    weekLabel,
    weekData.weekEggs,
    weekData.prevWeekEggs,
    weekData.henCount,
    weekData.missedChores,
    weekData.completedChores,
    weekData.costPerEgg ?? -1,
    weekData.streak,
  ], [weekLabel, weekData]);

  const { data: aiReport, isLoading, isError } = useQuery<WeeklyReport>({
    queryKey: cacheKey,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('weekly-insights', { body: { weekData } });
      if (error) throw new Error(error.message);
      if (!data || (!data.summary && !Array.isArray(data.insights))) {
        throw new Error('Empty response');
      }
      // Tolerate legacy { insights: [...] }
      return {
        summary: data.summary ?? fallback.summary,
        insights: Array.isArray(data.insights) && data.insights.length > 0 ? data.insights : fallback.insights,
        next_steps: Array.isArray(data.next_steps) ? data.next_steps : fallback.next_steps,
        closing: data.closing ?? fallback.closing,
      };
    },
    staleTime: 12 * 60 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
    retry: 0,
    enabled: weekData.henCount > 0 || weekData.weekEggs > 0,
  });

  const report: WeeklyReport = !isLoading && !isError && aiReport ? aiReport : fallback;

  return (
    <motion.section
      aria-label="AI-veckorapport"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="border-primary/15 bg-gradient-to-br from-primary/8 via-accent/5 to-background shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/12 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="data-label">Hönsgården märkte den här veckan</p>
              <p className="font-serif text-base sm:text-lg text-foreground leading-snug mt-0.5 flex items-center gap-2 flex-wrap">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {weekLabel}
              </p>
            </div>
          </div>

          {/* Summary */}
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Hönsgården skriver ihop din veckosammanfattning…
            </div>
          ) : (
            <p className="text-sm sm:text-[15px] text-foreground leading-relaxed">{report.summary}</p>
          )}

          {/* Insights */}
          {!isLoading && report.insights.length > 0 && (
            <div className="rounded-2xl bg-background/70 border border-border/40 p-3 sm:p-4">
              <p className="data-label mb-2">Veckans insikter</p>
              <ul className="space-y-1.5">
                {report.insights.map((insight, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                    className="text-sm text-foreground leading-relaxed flex gap-2"
                  >
                    <span className="text-primary mt-1 shrink-0">•</span>
                    <span>{insight}</span>
                  </motion.li>
                ))}
              </ul>
            </div>
          )}

          {/* Next steps */}
          {!isLoading && report.next_steps.length > 0 && (
            <div>
              <p className="data-label mb-2">Nästa bästa steg</p>
              <div className="space-y-2">
                {report.next_steps.map((step, idx) => {
                  const Icon = pickIcon(step.cta?.path);
                  return (
                    <motion.div
                      key={`${step.title}-${idx}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.05 * idx, duration: 0.25 }}
                      className="rounded-2xl border border-border/40 bg-background/70 p-3 flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-tight">{step.title}</p>
                        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{step.text}</p>
                        {step.cta && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 mt-2 rounded-xl gap-1.5 text-xs active:scale-95"
                            onClick={() => navigate(step.cta!.path)}
                          >
                            {step.cta.label}
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Closing */}
          {!isLoading && report.closing && (
            <p className="text-sm text-foreground/90 italic leading-relaxed border-l-2 border-primary/40 pl-3">
              {report.closing}
            </p>
          )}

          <p className="text-[10px] text-muted-foreground/70 leading-relaxed">
            Hönsgården håller koll tillsammans med dig. Insikterna bygger på din egen data och ersätter inte veterinärbedömning.
          </p>
        </CardContent>
      </Card>
    </motion.section>
  );
}
