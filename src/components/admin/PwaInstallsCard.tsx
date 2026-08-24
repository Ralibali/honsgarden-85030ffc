import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Smartphone, Download } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type Period = '24h' | '7d' | '30d' | '90d';

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

interface PwaEvent {
  created_at: string;
  metadata: { platform?: string } | null;
}

export default function PwaInstallsCard({ period }: { period: Period }) {
  const since = getDateSince(period);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['pwa-installs', period],
    queryFn: async () => {
      const { data } = await supabase
        .from('click_events')
        .select('created_at, metadata')
        .eq('event_name', 'pwa_installed')
        .gte('created_at', since)
        .order('created_at', { ascending: true });
      return (data || []) as PwaEvent[];
    },
  });

  const { chartData, totals, total } = useMemo(() => {
    const byDay = new Map<string, Record<string, number>>();
    const platformTotals: Record<string, number> = { ios: 0, android: 0, other: 0 };

    events.forEach((e) => {
      const day = new Date(e.created_at).toISOString().slice(0, 10);
      const platform = (e.metadata?.platform || 'other').toLowerCase();
      const key = ['ios', 'android', 'other'].includes(platform) ? platform : 'other';

      if (!byDay.has(day)) byDay.set(day, { ios: 0, android: 0, other: 0 });
      byDay.get(day)![key] += 1;
      platformTotals[key] += 1;
    });

    const chart = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, counts]) => ({
        date: date.slice(5),
        ...counts,
      }));

    return {
      chartData: chart,
      totals: platformTotals,
      total: events.length,
    };
  }, [events]);

  return (
    <Card className="border-border/50">
      <CardHeader className="px-4 py-3">
        <CardTitle className="font-serif text-sm flex items-center gap-2">
          <Download className="h-4 w-4 text-primary" /> PWA-installationer
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : total === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            <Smartphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Inga installationer registrerade under perioden.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatTile label="Totalt" value={total} />
              <StatTile label="iOS" value={totals.ios} color={PLATFORM_COLORS.ios} />
              <StatTile label="Android" value={totals.android} color={PLATFORM_COLORS.android} />
              <StatTile label="Övrigt" value={totals.other} color={PLATFORM_COLORS.other} />
            </div>

            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="ios" stackId="a" name={PLATFORM_LABELS.ios} fill={PLATFORM_COLORS.ios} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="android" stackId="a" name={PLATFORM_LABELS.android} fill={PLATFORM_COLORS.android} />
                  <Bar dataKey="other" stackId="a" name={PLATFORM_LABELS.other} fill={PLATFORM_COLORS.other} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Baserat på <Badge variant="secondary" className="font-mono text-[10px]">pwa_installed</Badge> i click_events. iOS saknar installationsevent i webbläsaren – iOS-siffran kan kompletteras med <Badge variant="secondary" className="font-mono text-[10px]">pwa_standalone_session</Badge>.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} />}
        {label}
      </div>
      <div className="font-serif text-2xl text-foreground mt-1">{value}</div>
    </div>
  );
}
