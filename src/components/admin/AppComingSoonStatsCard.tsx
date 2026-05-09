import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type Period = '24h' | '7d' | '30d' | '90d';
type EventKey = 'shown' | 'dismissed';

const EVENT_NAMES: Record<EventKey, string> = {
  shown: 'app_coming_soon_shown',
  dismissed: 'app_coming_soon_dismissed',
};

const PLATFORM_COLORS: Record<string, string> = {
  ios: 'hsl(var(--primary))',
  android: 'hsl(var(--accent))',
  other: '#94a3b8',
};

const PLATFORM_LABELS: Record<string, string> = {
  ios: 'iOS',
  android: 'Android',
  other: 'Övrigt',
};

const tooltipStyle = {
  background: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  fontSize: '12px',
};

function getDateSince(period: Period) {
  const d = new Date();
  if (period === '24h') d.setHours(d.getHours() - 24);
  else if (period === '7d') d.setDate(d.getDate() - 7);
  else if (period === '30d') d.setDate(d.getDate() - 30);
  else d.setDate(d.getDate() - 90);
  return d.toISOString();
}

interface Evt {
  created_at: string;
  event_name: string;
  metadata: { platform?: string } | null;
}

export default function AppComingSoonStatsCard({ period }: { period: Period }) {
  const since = getDateSince(period);
  const [view, setView] = useState<EventKey>('shown');

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['app-coming-soon-stats', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('click_events')
        .select('created_at, event_name, metadata')
        .in('event_name', [EVENT_NAMES.shown, EVENT_NAMES.dismissed])
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      return (data || []) as Evt[];
    },
  });

  const { totals, chartByEvent } = useMemo(() => {
    const result: Record<EventKey, { byDay: Map<string, Record<string, number>>; total: number; perPlatform: Record<string, number> }> = {
      shown: { byDay: new Map(), total: 0, perPlatform: { ios: 0, android: 0, other: 0 } },
      dismissed: { byDay: new Map(), total: 0, perPlatform: { ios: 0, android: 0, other: 0 } },
    };

    events.forEach((e) => {
      const key: EventKey = e.event_name === EVENT_NAMES.shown ? 'shown' : 'dismissed';
      const day = new Date(e.created_at).toISOString().slice(0, 10);
      const raw = (e.metadata?.platform || 'other').toLowerCase();
      const platform = ['ios', 'android', 'other'].includes(raw) ? raw : 'other';

      if (!result[key].byDay.has(day)) {
        result[key].byDay.set(day, { ios: 0, android: 0, other: 0 });
      }
      result[key].byDay.get(day)![platform] += 1;
      result[key].perPlatform[platform] += 1;
      result[key].total += 1;
    });

    const buildChart = (key: EventKey) =>
      Array.from(result[key].byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, counts]) => ({ date: date.slice(5), ...counts }));

    return {
      totals: {
        shown: result.shown,
        dismissed: result.dismissed,
        dismissRate: result.shown.total > 0 ? Math.round((result.dismissed.total / result.shown.total) * 100) : 0,
      },
      chartByEvent: { shown: buildChart('shown'), dismissed: buildChart('dismissed') },
    };
  }, [events]);

  const chartData = chartByEvent[view];
  const current = totals[view];

  return (
    <Card className="border-border/50">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-serif text-sm flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> "Kommer som app"-popup
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : totals.shown.total === 0 && totals.dismissed.total === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            Inga händelser registrerade under perioden.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile label="Visningar" value={totals.shown.total} />
              <StatTile label="Avstängningar" value={totals.dismissed.total} />
              <StatTile label="Avstängningsgrad" value={`${totals.dismissRate}%`} />
              <StatTile
                label="Topp-plattform"
                value={topPlatform(totals.shown.perPlatform)}
              />
            </div>

            <Tabs value={view} onValueChange={(v) => setView(v as EventKey)}>
              <TabsList className="bg-muted/50 p-1 rounded-xl">
                <TabsTrigger value="shown" className="text-xs rounded-lg">Visningar</TabsTrigger>
                <TabsTrigger value="dismissed" className="text-xs rounded-lg">Avstängningar</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-3 gap-2 text-[11px]">
              {(['ios', 'android', 'other'] as const).map((p) => (
                <div key={p} className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-muted/30 px-2 py-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: PLATFORM_COLORS[p] }} />
                  <span className="text-muted-foreground">{PLATFORM_LABELS[p]}</span>
                  <span className="ml-auto font-medium text-foreground">{current.perPlatform[p]}</span>
                </div>
              ))}
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ios" stackId="a" name={PLATFORM_LABELS.ios} fill={PLATFORM_COLORS.ios} />
                  <Bar dataKey="android" stackId="a" name={PLATFORM_LABELS.android} fill={PLATFORM_COLORS.android} />
                  <Bar dataKey="other" stackId="a" name={PLATFORM_LABELS.other} fill={PLATFORM_COLORS.other} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Baserat på <Badge variant="secondary" className="font-mono text-[10px]">app_coming_soon_shown</Badge> och <Badge variant="secondary" className="font-mono text-[10px]">app_coming_soon_dismissed</Badge> i click_events.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function topPlatform(perPlatform: Record<string, number>) {
  const entries = Object.entries(perPlatform).sort(([, a], [, b]) => b - a);
  if (!entries.length || entries[0][1] === 0) return '—';
  return PLATFORM_LABELS[entries[0][0]] || entries[0][0];
}

function StatTile({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="font-serif text-2xl text-foreground mt-1">{value}</div>
    </div>
  );
}
