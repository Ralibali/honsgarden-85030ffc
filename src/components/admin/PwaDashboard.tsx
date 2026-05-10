import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Smartphone, Download, Eye, CheckCircle2, TrendingUp, Apple } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  LineChart, Line,
} from 'recharts';

type Period = '24h' | '7d' | '30d' | '90d';

const PLATFORM_COLORS: Record<string, string> = {
  ios: 'hsl(var(--primary))',
  android: 'hsl(var(--accent))',
  other: 'hsl(var(--muted-foreground))',
};

const PWA_EVENTS = [
  'pwa_install_prompted',
  'pwa_installed',
  'pwa_standalone_session',
  'install_card_cta',
  'install_prompt_choice',
  'pwa_onboarding_shown',
  'pwa_onboarding_install',
  'pwa_onboarding_choice',
  'pwa_onboarding_dismissed',
  'pwa_onboarding_later',
] as const;

interface Evt {
  created_at: string;
  event_name: string;
  element_text: string | null;
  metadata: { platform?: string } | null;
}

function getDateSince(period: Period) {
  const d = new Date();
  if (period === '24h') d.setHours(d.getHours() - 24);
  else if (period === '7d') d.setDate(d.getDate() - 7);
  else if (period === '30d') d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d.toISOString();
}

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
};

export default function PwaDashboard() {
  const [period, setPeriod] = useState<Period>('30d');
  const since = getDateSince(period);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['pwa-dashboard-events', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('click_events')
        .select('created_at, event_name, element_text, metadata')
        .in('event_name', PWA_EVENTS as unknown as string[])
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      return (data || []) as Evt[];
    },
  });

  const stats = useMemo(() => {
    const counts: Record<string, number> = {};
    const byPlatform: Record<string, Record<string, number>> = {
      ios: {}, android: {}, other: {},
    };
    const byDay = new Map<string, Record<string, number>>();
    let promptAccepted = 0;
    let promptDismissed = 0;

    for (const e of events) {
      counts[e.event_name] = (counts[e.event_name] || 0) + 1;

      const platform = (e.metadata?.platform || 'other').toLowerCase();
      const pkey = ['ios', 'android', 'other'].includes(platform) ? platform : 'other';
      byPlatform[pkey][e.event_name] = (byPlatform[pkey][e.event_name] || 0) + 1;

      if (e.event_name === 'install_prompt_choice' || e.event_name === 'pwa_onboarding_choice') {
        if (e.element_text === 'accepted') promptAccepted += 1;
        else if (e.element_text === 'dismissed') promptDismissed += 1;
      }

      const day = new Date(e.created_at).toISOString().slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { prompted: 0, installed: 0, standalone: 0 });
      const bucket = byDay.get(day)!;
      if (e.event_name === 'pwa_install_prompted') bucket.prompted += 1;
      if (e.event_name === 'pwa_installed') bucket.installed += 1;
      if (e.event_name === 'pwa_standalone_session') bucket.standalone += 1;
    }

    const trend = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({ date: date.slice(5), ...v }));

    const prompted = counts['pwa_install_prompted'] || 0;
    const installed = counts['pwa_installed'] || 0;
    const standalone = counts['pwa_standalone_session'] || 0;
    const onboardingShown = counts['pwa_onboarding_shown'] || 0;
    const onboardingClicked = counts['pwa_onboarding_install'] || 0;
    const cardClicked = counts['install_card_cta'] || 0;

    const conversionRate = prompted > 0 ? (installed / prompted) * 100 : 0;
    const promptResolved = promptAccepted + promptDismissed;
    const acceptanceRate = promptResolved > 0 ? (promptAccepted / promptResolved) * 100 : 0;
    const onboardingCtr = onboardingShown > 0 ? (onboardingClicked / onboardingShown) * 100 : 0;

    const platformTotals = (['ios', 'android', 'other'] as const).map((p) => ({
      platform: p,
      prompted: byPlatform[p]['pwa_install_prompted'] || 0,
      installed: (byPlatform[p]['pwa_installed'] || 0) + (p === 'ios' ? byPlatform[p]['pwa_standalone_session'] || 0 : 0),
      standalone: byPlatform[p]['pwa_standalone_session'] || 0,
    }));

    return {
      counts,
      trend,
      prompted,
      installed,
      standalone,
      onboardingShown,
      onboardingClicked,
      cardClicked,
      promptAccepted,
      promptDismissed,
      conversionRate,
      acceptanceRate,
      onboardingCtr,
      platformTotals,
      totalInstalls: installed + standalone, // unika sessioner som standalone fångar iOS
    };
  }, [events]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period switcher */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="font-serif text-xl text-foreground">PWA-installationer</h2>
          <p className="text-xs text-muted-foreground">
            Tratt från install-prompt till installerad app
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList className="rounded-lg h-8">
            <TabsTrigger value="24h" className="text-xs h-6 px-2">24h</TabsTrigger>
            <TabsTrigger value="7d" className="text-xs h-6 px-2">7d</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs h-6 px-2">30d</TabsTrigger>
            <TabsTrigger value="90d" className="text-xs h-6 px-2">90d</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi
          icon={Eye}
          label="Prompts visade"
          value={stats.prompted}
          hint="beforeinstallprompt (Android)"
        />
        <Kpi
          icon={Download}
          label="Installerade"
          value={stats.totalInstalls}
          hint="appinstalled + iOS standalone"
        />
        <Kpi
          icon={TrendingUp}
          label="Konvertering"
          value={`${stats.conversionRate.toFixed(1)}%`}
          hint="installed / prompted"
          highlight
        />
        <Kpi
          icon={CheckCircle2}
          label="Accepterar prompt"
          value={`${stats.acceptanceRate.toFixed(1)}%`}
          hint={`${stats.promptAccepted} accepterade · ${stats.promptDismissed} avvisade`}
        />
      </div>

      {/* Funnel visualization */}
      <Card className="border-border/50">
        <CardHeader className="px-4 py-3">
          <CardTitle className="font-serif text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> Konverteringstratt
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <FunnelStep
            label="Onboarding visad"
            value={stats.onboardingShown}
            max={Math.max(stats.onboardingShown, 1)}
            color="hsl(var(--muted-foreground))"
          />
          <FunnelStep
            label="Klickade på install-CTA (kort + onboarding)"
            value={stats.onboardingClicked + stats.cardClicked}
            max={Math.max(stats.onboardingShown, 1)}
            color="hsl(var(--accent))"
          />
          <FunnelStep
            label="Webbläsarprompt visad"
            value={stats.prompted}
            max={Math.max(stats.onboardingShown, stats.prompted, 1)}
            color="hsl(var(--primary) / 0.6)"
          />
          <FunnelStep
            label="Installerade appen"
            value={stats.totalInstalls}
            max={Math.max(stats.onboardingShown, stats.prompted, stats.totalInstalls, 1)}
            color="hsl(var(--primary))"
            isLast
          />

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
            <MicroStat label="Onboarding → CTA" value={`${stats.onboardingCtr.toFixed(0)}%`} />
            <MicroStat label="CTA → Prompt" value={stats.cardClicked + stats.onboardingClicked > 0 ? `${((stats.prompted / (stats.cardClicked + stats.onboardingClicked)) * 100).toFixed(0)}%` : '–'} />
            <MicroStat label="Prompt → Installerad" value={`${stats.conversionRate.toFixed(0)}%`} />
          </div>
        </CardContent>
      </Card>

      {/* Daily trend */}
      <Card className="border-border/50">
        <CardHeader className="px-4 py-3">
          <CardTitle className="font-serif text-sm">Trend per dag</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {stats.trend.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
              Ingen PWA-aktivitet under perioden.
            </div>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="prompted" name="Prompts" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="installed" name="Installerade" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="standalone" name="iOS-sessions" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per platform */}
      <Card className="border-border/50">
        <CardHeader className="px-4 py-3">
          <CardTitle className="font-serif text-sm flex items-center gap-2">
            <Apple className="h-4 w-4 text-primary" /> Per plattform
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.platformTotals}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="platform" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="prompted" name="Prompts" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="installed" name="Installerade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[11px] text-muted-foreground mt-3">
            iOS saknar <Badge variant="secondary" className="font-mono text-[10px]">appinstalled</Badge>-event – iOS-installationer räknas via <Badge variant="secondary" className="font-mono text-[10px]">pwa_standalone_session</Badge> (en gång per enhet).
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, hint, highlight,
}: { icon: React.ElementType; label: string; value: number | string; hint?: string; highlight?: boolean }) {
  return (
    <Card className={`border-border/50 ${highlight ? 'bg-primary/5 border-primary/30' : ''}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
          <Icon className="h-3 w-3" /> {label}
        </div>
        <div className="font-serif text-2xl text-foreground">{value}</div>
        {hint && <div className="text-[10px] text-muted-foreground/80 mt-1 leading-tight">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function FunnelStep({
  label, value, max, color, isLast,
}: { label: string; value: number; max: number; color: string; isLast?: boolean }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={isLast ? '' : 'mb-2'}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-foreground">{label}</span>
        <span className="font-mono text-muted-foreground">{value} ({pct.toFixed(0)}%)</span>
      </div>
      <div className="h-7 rounded-md bg-muted/40 overflow-hidden">
        <div
          className="h-full rounded-md transition-all"
          style={{ width: `${Math.max(pct, 2)}%`, background: color }}
        />
      </div>
    </div>
  );
}

function MicroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 px-2 py-1.5">
      <div className="text-muted-foreground">{label}</div>
      <div className="font-serif text-sm text-foreground">{value}</div>
    </div>
  );
}
