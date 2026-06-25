import { useMemo, useState } from 'react';
import { todayLocal } from '@/lib/datetime';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Sparkles, ArrowRight, Egg, Bird, Package, CalendarCheck,
  TrendingUp, Heart, Bell, AlertTriangle, ThumbsUp, Lightbulb, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { api, type CoachAdvice, type CoachResponse } from '@/lib/api';

type CoachContext = {
  todayEggs: number;
  weekEggs: number;
  prevWeekEggs: number;
  activeHens: number;
  hasLoggedToday: boolean;
  streak: number;
  feedRecordsCount: number;
  totalFeedCost: number;
  upcomingChoresCount: number;
  pastDueChoresCount: number;
  hatchingsActive: number;
  recentHealthNotes: number;
  weather?: { temp?: number | null; code?: number | null; tip?: string | null } | null;
  season: string;
};

function getSeason(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'vår';
  if (m >= 6 && m <= 8) return 'sommar';
  if (m >= 9 && m <= 11) return 'höst';
  return 'vinter';
}

function todayStr() {
  return todayLocal();
}

function daysAgo(d: number) {
  const date = new Date();
  date.setDate(date.getDate() - d);
  return date;
}

function calcStreak(eggs: any[]): number {
  const today = new Date();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const hasEggs = eggs.some((e: any) => e.date === dateStr && e.count > 0);
    if (hasEggs) streak++;
    else if (i > 0) break;
  }
  return streak;
}

function buildContext(opts: {
  eggs: any[]; hens: any[]; feedRecords: any[]; chores: any[]; hatchings: any[]; healthLogs: any[];
}): CoachContext {
  const { eggs, hens, feedRecords, chores, hatchings, healthLogs } = opts;
  const today = todayStr();
  const todayEggs = eggs.filter((e) => e.date === today).reduce((s, e) => s + (e.count || 0), 0);

  const weekStart = daysAgo(7);
  const prevWeekStart = daysAgo(14);
  const weekEggs = eggs.filter((e) => new Date(e.date) >= weekStart).reduce((s, e) => s + (e.count || 0), 0);
  const prevWeekEggs = eggs
    .filter((e) => {
      const d = new Date(e.date);
      return d >= prevWeekStart && d < weekStart;
    })
    .reduce((s, e) => s + (e.count || 0), 0);

  const activeHens = hens.filter((h) => h.is_active && h.hen_type !== 'rooster').length;

  const totalFeedCost = feedRecords.reduce((s, f) => s + (f.cost || 0), 0);

  const now = new Date();
  const in24h = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const upcomingChoresCount = chores.filter((c) => c.next_due_at && !c.completed && new Date(c.next_due_at) <= in24h).length;
  const pastDueChoresCount = chores.filter((c) => c.next_due_at && !c.completed && new Date(c.next_due_at) < now).length;

  const hatchingsActive = hatchings.filter((h) => h.status === 'incubating' || h.status === 'active').length;

  const fourteenDaysAgo = daysAgo(14);
  const recentHealthNotes = healthLogs.filter((l) => l.type !== 'diary' && new Date(l.date) >= fourteenDaysAgo).length;

  return {
    todayEggs,
    weekEggs,
    prevWeekEggs,
    activeHens,
    hasLoggedToday: todayEggs > 0,
    streak: calcStreak(eggs),
    feedRecordsCount: feedRecords.length,
    totalFeedCost,
    upcomingChoresCount,
    pastDueChoresCount,
    hatchingsActive,
    recentHealthNotes,
    season: getSeason(),
  };
}

function ruleBasedFallback(ctx: CoachContext): CoachResponse {
  const advices: CoachAdvice[] = [];

  if (ctx.activeHens === 0) {
    advices.push({
      title: 'Lägg till din första höna',
      text: 'Börja med att lägga in flocken så kan Hönsgården hjälpa dig följa ägg, hälsa och historik.',
      type: 'tips',
      cta: { label: 'Lägg till höna', path: '/app/hens' },
    });
  } else if (!ctx.hasLoggedToday) {
    advices.push({
      title: 'Logga dagens ägg',
      text: 'Du har inte loggat några ägg idag ännu. Gör det medan du minns – det tar bara några sekunder.',
      type: 'påminnelse',
      cta: { label: 'Logga ägg', path: '/app/eggs' },
    });
  } else if (ctx.streak >= 3) {
    advices.push({
      title: 'Bra jobbat!',
      text: `Du har loggat ägg ${ctx.streak} dagar i rad. Det är precis så du bygger riktigt bra koll på hönsgården.`,
      type: 'pepp',
      cta: { label: 'Se veckorapport', path: '/app/weekly-report' },
    });
  }

  if (ctx.pastDueChoresCount > 0) {
    advices.push({
      title: 'Försenade sysslor',
      text: `Du har ${ctx.pastDueChoresCount} syssla${ctx.pastDueChoresCount === 1 ? '' : 'r'} som behöver göras. Bocka av de som är klara så håller du koll lättare.`,
      type: 'påminnelse',
      cta: { label: 'Öppna sysslor', path: '/app/tasks' },
    });
  }

  if (ctx.weekEggs > 0 && ctx.prevWeekEggs > 0 && ctx.weekEggs < ctx.prevWeekEggs * 0.7) {
    advices.push({
      title: 'Lite lägre produktion',
      text: 'Den här veckan ligger äggproduktionen lägre än förra veckan. Det kan vara helt normalt, men håll gärna koll på ruggning, foder och stress i flocken.',
      type: 'varning',
      cta: { label: 'Se statistik', path: '/app/statistics' },
    });
  } else if (ctx.weekEggs > ctx.prevWeekEggs && ctx.prevWeekEggs > 0) {
    advices.push({
      title: 'Produktionen är uppåt',
      text: `Den här veckan har du loggat ${ctx.weekEggs} ägg, ${ctx.weekEggs - ctx.prevWeekEggs} fler än förra veckan. Snyggt!`,
      type: 'pepp',
      cta: { label: 'Se statistik', path: '/app/statistics' },
    });
  }

  if (ctx.feedRecordsCount === 0 && ctx.activeHens > 0) {
    advices.push({
      title: 'Lägg in foderkostnad',
      text: 'Vill du veta vad varje ägg faktiskt kostar? Lägg in senaste foderinköpet så börjar Hönsgården räkna.',
      type: 'tips',
      cta: { label: 'Lägg till foder', path: '/app/feed' },
    });
  }

  if (ctx.upcomingChoresCount === 0 && ctx.pastDueChoresCount === 0 && ctx.activeHens > 0) {
    advices.push({
      title: 'Skapa en enkel rutin',
      text: 'Lägg upp en återkommande syssla – till exempel vatten, foder eller rengöring. Det är skönt att slippa hålla allt i huvudet.',
      type: 'tips',
      cta: { label: 'Skapa syssla', path: '/app/tasks' },
    });
  }

  if (advices.length === 0) {
    advices.push({
      title: 'Du har bra koll',
      text: 'Allt ser fint ut just nu. Fortsätt logga ägg dagligen så får du ännu tydligare insikter över tid.',
      type: 'pepp',
      cta: { label: 'Se veckorapport', path: '/app/weekly-report' },
    });
  }

  return { intro: null, advices: advices.slice(0, 3) };
}

const TYPE_META: Record<CoachAdvice['type'], { icon: any; bg: string; text: string; label: string }> = {
  pepp: { icon: ThumbsUp, bg: 'bg-primary/10', text: 'text-primary', label: 'Pepp' },
  påminnelse: { icon: Bell, bg: 'bg-warning/10', text: 'text-warning', label: 'Påminnelse' },
  varning: { icon: AlertTriangle, bg: 'bg-destructive/10', text: 'text-destructive', label: 'Att hålla koll på' },
  tips: { icon: Lightbulb, bg: 'bg-accent/15', text: 'text-accent-foreground', label: 'Tips' },
};

function pickIcon(advice: CoachAdvice) {
  const path = advice.cta?.path || '';
  if (path.includes('/eggs')) return Egg;
  if (path.includes('/hens')) return Bird;
  if (path.includes('/feed')) return Package;
  if (path.includes('/tasks')) return CalendarCheck;
  if (path.includes('/statistics') || path.includes('/weekly-report')) return TrendingUp;
  if (path.includes('/hatching')) return Heart;
  return TYPE_META[advice.type]?.icon ?? Sparkles;
}

export default function DashboardAICoach() {
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs(), staleTime: 60_000 });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000 });
  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords(), staleTime: 60_000 });
  const { data: chores = [] } = useQuery({ queryKey: ['daily-chores'], queryFn: () => api.getDailyChores(), staleTime: 60_000 });
  const { data: hatchings = [] } = useQuery({ queryKey: ['hatchings'], queryFn: () => api.getHatchings(), staleTime: 60_000 });
  const { data: healthLogs = [] } = useQuery({ queryKey: ['health-logs'], queryFn: () => api.getHealthLogs(), staleTime: 60_000 });

  const ctx = useMemo(
    () => buildContext({
      eggs: eggs as any[],
      hens: hens as any[],
      feedRecords: feedRecords as any[],
      chores: chores as any[],
      hatchings: hatchings as any[],
      healthLogs: healthLogs as any[],
    }),
    [eggs, hens, feedRecords, chores, hatchings, healthLogs]
  );

  const fallback = useMemo(() => ruleBasedFallback(ctx), [ctx]);

  const cacheKey = useMemo(() => {
    return [
      'dashboard-coach',
      todayStr(),
      ctx.activeHens,
      ctx.hasLoggedToday ? 1 : 0,
      Math.round(ctx.weekEggs / 5),
      Math.round(ctx.prevWeekEggs / 5),
      ctx.feedRecordsCount > 0 ? 1 : 0,
      ctx.pastDueChoresCount > 0 ? 1 : 0,
      ctx.streak >= 7 ? 'long' : ctx.streak >= 3 ? 'mid' : 'short',
    ];
  }, [ctx]);

  const { data: aiResp, isLoading, isError } = useQuery({
    queryKey: cacheKey,
    queryFn: () => api.getDashboardCoach(ctx as unknown as Record<string, unknown>),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 12 * 60 * 60 * 1000,
    retry: 0,
    enabled: ctx.activeHens > 0 || eggs.length > 0,
  });

  const result: CoachResponse = !isLoading && !isError && aiResp?.advices?.length ? aiResp : fallback;
  const intro = result.intro || 'Hönsgården har märkt några saker idag.';
  const primary = result.advices[0];
  const extraCount = Math.max(0, result.advices.length - 1);

  const renderAdviceCard = (advice: CoachAdvice, idx: number, compact = false) => {
    const meta = TYPE_META[advice.type] ?? TYPE_META.tips;
    const Icon = pickIcon(advice);
    return (
      <motion.li
        key={`${advice.title}-${idx}`}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: idx * 0.05, duration: 0.25 }}
        className={`rounded-2xl border border-border/40 bg-background/70 ${compact ? 'p-3' : 'p-4'}`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-4.5 w-4.5 ${meta.text}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground leading-tight">{advice.title}</p>
              <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.text} font-medium`}>
                {meta.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed mt-1.5">{advice.text}</p>
            {advice.cta && (
              <div className="mt-3">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl gap-1.5 text-xs active:scale-95"
                  onClick={() => {
                    setSheetOpen(false);
                    navigate(advice.cta!.path);
                  }}
                >
                  {advice.cta.label}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </motion.li>
    );
  };

  return (
    <>
      <motion.section
        aria-label="Dagens råd från Hönsgården"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <Card className="border-primary/15 bg-gradient-to-br from-primary/8 via-accent/5 to-background shadow-sm overflow-hidden">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-9 h-9 rounded-2xl bg-primary/12 flex items-center justify-center shrink-0">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="data-label">Hönsgården har märkt…</p>
                <p className="font-serif text-sm sm:text-base text-foreground leading-snug mt-0.5 line-clamp-2">
                  {isLoading ? 'Tittar igenom dina senaste dagar…' : intro}
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Hönsgården funderar…
              </div>
            ) : primary ? (
              <ul className="space-y-2.5">
                {renderAdviceCard(primary, 0, true)}
              </ul>
            ) : null}

            {extraCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSheetOpen(true)}
                className="mt-3 w-full h-10 rounded-xl text-sm font-medium text-primary hover:bg-primary/8 active:scale-[0.98]"
              >
                Visa fler råd ({extraCount})
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.section>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-3xl max-h-[85vh] overflow-y-auto p-5 sm:max-w-lg sm:mx-auto"
        >
          <SheetHeader className="text-left mb-4">
            <SheetTitle className="font-serif text-xl flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Hönsgården har märkt…
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {intro}
            </SheetDescription>
          </SheetHeader>
          <ul className="space-y-3 pb-6">
            {result.advices.map((advice, idx) => renderAdviceCard(advice, idx, false))}
          </ul>
          <p className="text-[10px] text-muted-foreground/70 leading-relaxed pb-4">
            Råden bygger på din egen data och ersätter inte veterinärbedömning.
          </p>
        </SheetContent>
      </Sheet>
    </>
  );
}
