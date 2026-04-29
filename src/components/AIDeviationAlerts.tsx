import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, AlertTriangle, Lightbulb, Info, X, ArrowRight, Eye, Egg, Bird,
  Package, CalendarCheck, Heart, TrendingDown, Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api, type DeviationAlert, type DeviationAlertResponse, type DeviationAlertLevel } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { readScoped, writeScoped } from '@/lib/userScopedStorage';

type Signal = { key: string; data?: Record<string, unknown> };

type AlertContext = {
  signals: Signal[];
  todayEggs: number;
  weekEggs: number;
  prevWeekEggs: number;
  activeHens: number;
  daysSinceLastEgg: number | null;
  daysSinceLastFeed: number | null;
  pastDueChores: { title: string; days: number }[];
  hatchingsNearby: { day: number; status: string }[];
  recentHealthHens: { name: string; count: number }[];
  avgPerHen: number | null;
  avgPerHenHistorical: number | null;
  season: string;
};

function todayStr() {
  return new Date().toISOString().split('T')[0];
}

function getSeason(): string {
  const m = new Date().getMonth() + 1;
  if (m >= 3 && m <= 5) return 'vår';
  if (m >= 6 && m <= 8) return 'sommar';
  if (m >= 9 && m <= 11) return 'höst';
  return 'vinter';
}

function daysBetween(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / (24 * 60 * 60 * 1000));
}

function buildContextAndSignals(opts: {
  eggs: any[]; hens: any[]; feedRecords: any[]; chores: any[]; hatchings: any[]; healthLogs: any[];
}): AlertContext {
  const { eggs, hens, feedRecords, chores, hatchings, healthLogs } = opts;
  const now = new Date();
  const today = todayStr();

  const todayEggs = eggs.filter((e) => e.date === today).reduce((s, e) => s + (e.count || 0), 0);

  const weekStart = new Date(now); weekStart.setDate(weekStart.getDate() - 7);
  const prevWeekStart = new Date(now); prevWeekStart.setDate(prevWeekStart.getDate() - 14);
  const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);

  const weekEggs = eggs.filter((e) => new Date(e.date) >= weekStart).reduce((s, e) => s + (e.count || 0), 0);
  const prevWeekEggs = eggs
    .filter((e) => { const d = new Date(e.date); return d >= prevWeekStart && d < weekStart; })
    .reduce((s, e) => s + (e.count || 0), 0);

  const activeHens = hens.filter((h) => h.is_active && h.hen_type !== 'rooster').length;

  const lastEggDate = eggs
    .filter((e) => (e.count || 0) > 0)
    .map((e) => new Date(e.date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const daysSinceLastEgg = lastEggDate ? daysBetween(now, lastEggDate) : null;

  const lastFeed = feedRecords
    .map((f) => new Date(f.date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
  const daysSinceLastFeed = lastFeed ? daysBetween(now, lastFeed) : null;

  const pastDueChores = chores
    .filter((c) => c.next_due_at && !c.completed && new Date(c.next_due_at) < now)
    .map((c) => ({
      title: c.title as string,
      days: daysBetween(now, new Date(c.next_due_at)),
    }))
    .slice(0, 5);

  const hatchingsNearby: { day: number; status: string }[] = hatchings
    .filter((h) => h.status === 'incubating' && h.start_date)
    .map((h) => {
      const day = daysBetween(now, new Date(h.start_date)) + 1;
      return { day, status: h.status as string };
    })
    .filter((h) => h.day >= 17 && h.day <= 22);

  // Hens with multiple non-diary health notes in last 14 days
  const fourteenDaysAgo = new Date(now); fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
  const healthByHen = new Map<string, number>();
  healthLogs.forEach((l) => {
    if (l.type === 'diary' || !l.hen_id) return;
    if (new Date(l.date) < fourteenDaysAgo) return;
    healthByHen.set(l.hen_id, (healthByHen.get(l.hen_id) || 0) + 1);
  });
  const recentHealthHens = Array.from(healthByHen.entries())
    .filter(([, count]) => count >= 2)
    .map(([henId, count]) => {
      const hen = hens.find((h) => h.id === henId);
      return { name: hen?.name || 'Höna', count };
    })
    .slice(0, 3);

  const avgPerHen = activeHens > 0 ? +(weekEggs / activeHens / 7).toFixed(2) : null;
  const historicalEggs = eggs
    .filter((e) => { const d = new Date(e.date); return d >= fourWeeksAgo && d < weekStart; })
    .reduce((s, e) => s + (e.count || 0), 0);
  const avgPerHenHistorical = activeHens > 0 ? +(historicalEggs / activeHens / 21).toFixed(2) : null;

  // Build signals
  const signals: Signal[] = [];

  if (prevWeekEggs >= 3 && weekEggs < prevWeekEggs * 0.75) {
    signals.push({
      key: 'production_drop',
      data: { current: weekEggs, previous: prevWeekEggs, dropPct: Math.round((1 - weekEggs / prevWeekEggs) * 100) },
    });
  }

  if (activeHens > 0 && (daysSinceLastEgg == null || daysSinceLastEgg >= 3)) {
    signals.push({ key: 'no_egg_logging_recent', data: { days: daysSinceLastEgg ?? 'aldrig' } });
  }

  if (activeHens > 0 && feedRecords.length === 0) {
    signals.push({ key: 'no_feed_records' });
  } else if (daysSinceLastFeed != null && daysSinceLastFeed >= 30) {
    signals.push({ key: 'feed_not_recent', data: { days: daysSinceLastFeed } });
  }

  if (pastDueChores.length > 0) {
    signals.push({
      key: 'past_due_chores',
      data: { count: pastDueChores.length, examples: pastDueChores.slice(0, 2) },
    });
  }

  if (recentHealthHens.length > 0) {
    signals.push({ key: 'health_notes_concentrated', data: { hens: recentHealthHens } });
  }

  hatchingsNearby.forEach((h) => {
    if (h.day === 18) signals.push({ key: 'hatching_day_18', data: h });
    else if (h.day >= 20 && h.day <= 22) signals.push({ key: 'hatching_near_hatch', data: h });
  });

  if (
    avgPerHen != null && avgPerHenHistorical != null &&
    avgPerHenHistorical > 0.2 && avgPerHen < avgPerHenHistorical * 0.6
  ) {
    signals.push({
      key: 'low_eggs_per_hen',
      data: { current: avgPerHen, normal: avgPerHenHistorical },
    });
  }

  return {
    signals,
    todayEggs, weekEggs, prevWeekEggs, activeHens,
    daysSinceLastEgg, daysSinceLastFeed,
    pastDueChores, hatchingsNearby, recentHealthHens,
    avgPerHen, avgPerHenHistorical,
    season: getSeason(),
  };
}

function ruleBasedAlerts(ctx: AlertContext): DeviationAlertResponse {
  const out: DeviationAlert[] = [];

  for (const sig of ctx.signals) {
    switch (sig.key) {
      case 'production_drop': {
        const d: any = sig.data || {};
        out.push({
          key: sig.key,
          title: 'Lägre äggproduktion',
          text: `Den här veckan ligger äggen runt ${d.dropPct ?? 25}% lägre än veckan innan. Det behöver inte vara konstigt – håll gärna koll på ruggning, foderbyte, stress eller väder.`,
          level: 'tips',
          cta: { label: 'Se statistik', path: '/app/statistics' },
        });
        break;
      }
      case 'no_egg_logging_recent':
        out.push({
          key: sig.key,
          title: 'Ingen äggloggning på sistone',
          text: 'Du har inte loggat ägg på flera dagar. Vill du lägga in det nu medan du minns?',
          level: 'tips',
          cta: { label: 'Logga ägg', path: '/app/eggs' },
        });
        break;
      case 'no_feed_records':
        out.push({
          key: sig.key,
          title: 'Lägg in foderkostnad',
          text: 'Vill du veta vad varje ägg faktiskt kostar? Lägg in senaste foderinköpet så börjar Hönsgården räkna.',
          level: 'info',
          cta: { label: 'Lägg till foder', path: '/app/feed' },
        });
        break;
      case 'feed_not_recent':
        out.push({
          key: sig.key,
          title: 'Foder inte uppdaterat',
          text: 'Det var ett tag sen du registrerade foder. Lägg in det när du fyller på nästa gång så blir kostnad per ägg mer rätt.',
          level: 'info',
          cta: { label: 'Lägg till foder', path: '/app/feed' },
        });
        break;
      case 'past_due_chores': {
        const d: any = sig.data || {};
        const example = d?.examples?.[0]?.title;
        out.push({
          key: sig.key,
          title: 'Försenad påminnelse',
          text: example
            ? `Påminnelsen "${example}" är försenad. Det är en bra sak att ta tag i idag.`
            : `Du har ${d.count ?? ''} försenad${d.count === 1 ? '' : 'e'} syssla att ta tag i.`,
          level: 'viktigt',
          cta: { label: 'Öppna sysslor', path: '/app/tasks' },
        });
        break;
      }
      case 'health_notes_concentrated': {
        const d: any = sig.data || {};
        const first = d?.hens?.[0];
        out.push({
          key: sig.key,
          title: 'Håll koll på en höna',
          text: first
            ? `${first.name} har fått flera hälsonoteringar nyligen. Observera ${first.name} lite extra och kontakta veterinär vid försämring.`
            : 'Några hönor har flera hälsonoteringar nyligen. Observera dem lite extra och kontakta veterinär vid försämring.',
          level: 'viktigt',
          cta: { label: 'Öppna hönor', path: '/app/hens' },
        });
        break;
      }
      case 'hatching_day_18':
        out.push({
          key: sig.key,
          title: 'Kläckning närmar sig dag 18',
          text: 'Snart är det dags att sluta vända äggen och höja fukten något. Förbered ruvarens kläckläge.',
          level: 'tips',
          cta: { label: 'Öppna kläckning', path: '/app/hatching' },
        });
        break;
      case 'hatching_near_hatch':
        out.push({
          key: sig.key,
          title: 'Kläckdag närmar sig',
          text: 'Dina ägg är nära kläckning. Stör inte ruvaren i onödan och håll fukten uppe.',
          level: 'tips',
          cta: { label: 'Öppna kläckning', path: '/app/hatching' },
        });
        break;
      case 'low_eggs_per_hen': {
        const d: any = sig.data || {};
        out.push({
          key: sig.key,
          title: 'Lägre snitt per höna',
          text: `Snittet per höna ligger lägre än ditt vanliga (${d.current} jämfört med ~${d.normal}). Kolla foder, vatten och stress – ofta är det helt naturligt.`,
          level: 'tips',
          cta: { label: 'Se statistik', path: '/app/statistics' },
        });
        break;
      }
    }
  }

  // Prioritera viktigt > tips > info
  const order: Record<DeviationAlertLevel, number> = { viktigt: 0, tips: 1, info: 2 };
  out.sort((a, b) => order[a.level] - order[b.level]);
  return { intro: null, alerts: out.slice(0, 3) };
}

const LEVEL_META: Record<DeviationAlertLevel, { icon: any; bg: string; text: string; label: string; ring: string }> = {
  viktigt: { icon: AlertTriangle, bg: 'bg-destructive/10', text: 'text-destructive', label: 'Viktigt', ring: 'ring-destructive/20' },
  tips: { icon: Lightbulb, bg: 'bg-warning/10', text: 'text-warning', label: 'Tips', ring: 'ring-warning/15' },
  info: { icon: Info, bg: 'bg-primary/10', text: 'text-primary', label: 'Bra att veta', ring: 'ring-primary/15' },
};

function pickIcon(alert: DeviationAlert) {
  const path = alert.cta?.path || '';
  if (alert.key === 'production_drop' || alert.key === 'low_eggs_per_hen') return TrendingDown;
  if (path.includes('/eggs')) return Egg;
  if (path.includes('/hens')) return Bird;
  if (path.includes('/feed')) return Package;
  if (path.includes('/tasks') || path.includes('/reminders')) return CalendarCheck;
  if (path.includes('/hatching')) return Heart;
  return LEVEL_META[alert.level]?.icon ?? Bell;
}

const DISMISS_KEY = 'honsgarden-alerts-dismissed';

function getDismissed(userId: string | null | undefined): Record<string, string> {
  try {
    const raw = readScoped(userId, DISMISS_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function isDismissedToday(key: string, dismissed: Record<string, string>): boolean {
  return dismissed[key] === todayStr();
}

type Variant = 'card' | 'inline';

export default function AIDeviationAlerts({ variant = 'card' }: { variant?: Variant }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState<Record<string, string>>({});
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setDismissed(getDismissed(user?.id));
  }, [user?.id]);

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs(), staleTime: 60_000 });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens(), staleTime: 60_000 });
  const { data: feedRecords = [] } = useQuery({ queryKey: ['feed-records'], queryFn: () => api.getFeedRecords(), staleTime: 60_000 });
  const { data: chores = [] } = useQuery({ queryKey: ['daily-chores'], queryFn: () => api.getDailyChores(), staleTime: 60_000 });
  const { data: hatchings = [] } = useQuery({ queryKey: ['hatchings'], queryFn: () => api.getHatchings(), staleTime: 60_000 });
  const { data: healthLogs = [] } = useQuery({ queryKey: ['health-logs'], queryFn: () => api.getHealthLogs(), staleTime: 60_000 });

  const ctx = useMemo(
    () => buildContextAndSignals({
      eggs: eggs as any[],
      hens: hens as any[],
      feedRecords: feedRecords as any[],
      chores: chores as any[],
      hatchings: hatchings as any[],
      healthLogs: healthLogs as any[],
    }),
    [eggs, hens, feedRecords, chores, hatchings, healthLogs]
  );

  const fallback = useMemo(() => ruleBasedAlerts(ctx), [ctx]);

  const cacheKey = useMemo(
    () => [
      'dashboard-alerts',
      todayStr(),
      ctx.signals.map((s) => s.key).sort().join('|'),
    ],
    [ctx.signals]
  );

  const enabled = ctx.signals.length > 0;

  const { data: aiResp, isLoading, isError } = useQuery({
    queryKey: cacheKey,
    queryFn: () => api.getDashboardAlerts(ctx as unknown as Record<string, unknown>),
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 12 * 60 * 60 * 1000,
    retry: 0,
    enabled,
  });

  const result: DeviationAlertResponse =
    !isLoading && !isError && aiResp?.alerts?.length ? aiResp : fallback;

  const visibleAlerts = result.alerts.filter((a) => !isDismissedToday(a.key, dismissed)).slice(0, 3);

  const dismiss = (key: string) => {
    const next = { ...dismissed, [key]: todayStr() };
    setDismissed(next);
    writeScoped(user?.id, DISMISS_KEY, JSON.stringify(next));
  };

  if (hidden) return null;
  if (!enabled) return null;
  if (!isLoading && visibleAlerts.length === 0) return null;

  const intro = result.intro || 'Hönsgården har märkt något';

  const renderAlert = (alert: DeviationAlert, idx: number) => {
    const meta = LEVEL_META[alert.level] ?? LEVEL_META.info;
    const Icon = pickIcon(alert);
    return (
      <motion.li
        key={`${alert.key}-${idx}`}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: 30 }}
        transition={{ delay: idx * 0.05, duration: 0.25 }}
        className={`relative rounded-2xl border border-border/40 bg-background/70 p-3 sm:p-3.5 ring-1 ${meta.ring}`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-xl ${meta.bg} flex items-center justify-center shrink-0`}>
            <Icon className={`h-4 w-4 ${meta.text}`} />
          </div>
          <div className="min-w-0 flex-1 pr-6">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground leading-tight">{alert.title}</p>
              <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full ${meta.bg} ${meta.text} font-medium`}>
                {meta.label}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mt-1">{alert.text}</p>
            {alert.cta && (
              <div className="mt-2.5">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl gap-1.5 text-xs active:scale-95"
                  onClick={() => navigate(alert.cta!.path)}
                >
                  {alert.cta.label}
                  <ArrowRight className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(alert.key)}
            aria-label="Dölj denna varning för idag"
            className="absolute top-2 right-2 w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 active:scale-90 transition"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </motion.li>
    );
  };

  const wrapperClass = variant === 'inline'
    ? 'border-warning/15 bg-gradient-to-br from-warning/5 via-background to-background shadow-sm overflow-hidden'
    : 'border-warning/20 bg-gradient-to-br from-warning/8 via-background to-background shadow-sm overflow-hidden';

  return (
    <motion.section
      aria-label="Avvikelsevarningar från Hönsgården"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className={wrapperClass}>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-9 h-9 rounded-2xl bg-warning/12 flex items-center justify-center shrink-0">
              <Eye className="h-4 w-4 text-warning" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="data-label">Saker att hålla koll på</p>
              <p className="font-serif text-base text-foreground leading-snug mt-0.5">{intro}</p>
            </div>
            <button
              type="button"
              onClick={() => setHidden(true)}
              aria-label="Dölj sektionen"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted/50 active:scale-90 transition"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Hönsgården kollar igenom datan…
            </div>
          ) : (
            <ul className="space-y-2.5">
              <AnimatePresence initial={false}>
                {visibleAlerts.map((alert, idx) => renderAlert(alert, idx))}
              </AnimatePresence>
            </ul>
          )}

          <p className="text-[10px] text-muted-foreground/70 mt-3 leading-relaxed">
            Varningarna bygger på din egen data. De ersätter inte veterinärbedömning vid hälsofrågor.
          </p>
        </CardContent>
      </Card>
    </motion.section>
  );
}
