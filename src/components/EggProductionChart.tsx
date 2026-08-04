import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  ComposedChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { useIsMobile } from '@/hooks/use-mobile';

type Period = '30d' | '90d' | '12m' | 'all';

const PERIODS: { key: Period; label: string }[] = [
  { key: '30d', label: '30 dagar' },
  { key: '90d', label: '90 dagar' },
  { key: '12m', label: '12 månader' },
  { key: 'all', label: 'Allt' },
];

type EggEvent = {
  date: string; // YYYY-MM-DD (eller bucket-startdatum)
  kind: 'feed' | 'hen' | 'health';
  label: string;
};

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfISOWeek(d: Date): Date {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay() || 7; // söndag = 7
  if (day !== 1) date.setDate(date.getDate() - (day - 1));
  return date;
}

function formatShort(dateStr: string, weekly: boolean): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  if (weekly) {
    return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

function formatLong(dateStr: string, weekly: boolean): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  if (weekly) {
    const end = new Date(d);
    end.setDate(end.getDate() + 6);
    return `Vecka ${d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}–${end.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' })}`;
  }
  return d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function EggProductionChart() {
  const [period, setPeriod] = useState<Period>('30d');
  const isMobile = useIsMobile();

  const { data: eggs = [] } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs().catch(() => []),
  });

  const { data: feedRecords = [] } = useQuery({
    queryKey: ['feed-records-for-chart'],
    queryFn: () => api.getFeedRecords().catch(() => []),
  });

  const { data: hens = [] } = useQuery({
    queryKey: ['hens-for-chart'],
    queryFn: () => api.getHens().catch(() => []),
  });

  const { data: healthLogs = [] } = useQuery({
    queryKey: ['health-logs-for-chart'],
    queryFn: () => api.getHealthLogs().catch(() => []),
  });

  const distinctEggDays = useMemo(() => {
    const set = new Set<string>();
    for (const e of eggs as any[]) {
      if (e?.date) set.add(String(e.date).slice(0, 10));
    }
    return set.size;
  }, [eggs]);

  const weekly = period === '12m' || period === 'all';

  const { chartData, events } = useMemo(() => {
    if (!eggs || eggs.length === 0) {
      return { chartData: [] as any[], events: [] as (EggEvent & { bucket: string })[] };
    }

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let start: Date | null = null;
    if (period === '30d') {
      start = new Date(now);
      start.setDate(start.getDate() - 29);
    } else if (period === '90d') {
      start = new Date(now);
      start.setDate(start.getDate() - 89);
    } else if (period === '12m') {
      start = new Date(now);
      start.setDate(start.getDate() - 7 * 51); // 52 veckor
      start = startOfISOWeek(start);
    } else {
      // hela perioden: hitta tidigaste äggdatum
      const earliest = (eggs as any[]).reduce<string | null>((min, e) => {
        const d = String(e.date).slice(0, 10);
        return !min || d < min ? d : min;
      }, null);
      if (earliest) {
        start = startOfISOWeek(new Date(earliest));
      } else {
        start = new Date(now);
      }
    }

    const buckets = new Map<string, number>();

    if (weekly) {
      let cursor = startOfISOWeek(start);
      const endBucket = startOfISOWeek(now);
      while (cursor <= endBucket) {
        buckets.set(toDateKey(cursor), 0);
        cursor = new Date(cursor);
        cursor.setDate(cursor.getDate() + 7);
      }
    } else {
      const cursor = new Date(start);
      while (cursor <= now) {
        buckets.set(toDateKey(cursor), 0);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const e of eggs as any[]) {
      const dStr = String(e.date).slice(0, 10);
      const d = new Date(dStr);
      if (Number.isNaN(d.getTime())) continue;
      if (start && d < start) continue;
      if (d > now) continue;
      const key = weekly ? toDateKey(startOfISOWeek(d)) : dStr;
      if (!buckets.has(key)) continue;
      buckets.set(key, (buckets.get(key) || 0) + (e.count || 0));
    }

    const sortedKeys = Array.from(buckets.keys()).sort();
    const values = sortedKeys.map((k) => buckets.get(k) || 0);

    // 7-perioders rullande snitt (7 dagar i daglig vy, 7 veckor i veckovy)
    const window = 7;
    const rolling: (number | null)[] = values.map((_, i) => {
      const from = Math.max(0, i - window + 1);
      const slice = values.slice(from, i + 1);
      if (slice.length === 0) return null;
      const sum = slice.reduce((a, b) => a + b, 0);
      return Number((sum / slice.length).toFixed(1));
    });

    const data = sortedKeys.map((k, i) => ({
      date: k,
      eggs: values[i],
      avg: rolling[i],
      forecast: null as number | null,
    }));

    // Prognos: 7 dagar framåt i daglig vy, baserat på snittet av de
    // 14 senaste dagarna. Streckad linje som kopplar till sista punkten.
    if (!weekly && data.length >= 3) {
      const tail = values.slice(-14);
      const dailyMean = tail.reduce((a, b) => a + b, 0) / tail.length;
      const forecastVal = Number(dailyMean.toFixed(1));
      data[data.length - 1].forecast = forecastVal;
      const lastDate = new Date(sortedKeys[sortedKeys.length - 1]);
      for (let i = 1; i <= 7; i++) {
        const fd = new Date(lastDate);
        fd.setDate(fd.getDate() + i);
        data.push({ date: toDateKey(fd), eggs: null as unknown as number, avg: null, forecast: forecastVal });
      }
    }

    // Bygg event-listan
    const bucketKeys = new Set(sortedKeys);
    const bucketOf = (dStr: string): string | null => {
      const d = new Date(dStr);
      if (Number.isNaN(d.getTime())) return null;
      if (start && d < start) return null;
      if (d > now) return null;
      const key = weekly ? toDateKey(startOfISOWeek(d)) : dStr;
      return bucketKeys.has(key) ? key : null;
    };

    const evts: (EggEvent & { bucket: string })[] = [];

    for (const f of feedRecords as any[]) {
      if (!f?.date) continue;
      const bucket = bucketOf(String(f.date).slice(0, 10));
      if (!bucket) continue;
      const name = f.feed_type || f.name || 'Foder';
      const kg = f.amount_kg ? ` ${f.amount_kg} kg` : '';
      evts.push({ date: String(f.date).slice(0, 10), bucket, kind: 'feed', label: `Foderköp: ${name}${kg}` });
    }

    for (const h of hens as any[]) {
      const added = h?.acquired_at || h?.created_at;
      if (!added) continue;
      const bucket = bucketOf(String(added).slice(0, 10));
      if (!bucket) continue;
      evts.push({ date: String(added).slice(0, 10), bucket, kind: 'hen', label: `Ny höna: ${h.name || 'okänd'}` });
    }

    for (const hl of healthLogs as any[]) {
      if (!hl?.date) continue;
      const bucket = bucketOf(String(hl.date).slice(0, 10));
      if (!bucket) continue;
      const title = hl.title || hl.symptoms || hl.note || 'Hälsologg';
      evts.push({ date: String(hl.date).slice(0, 10), bucket, kind: 'health', label: `Hälsa: ${String(title).slice(0, 40)}` });
    }

    return { chartData: data, events: evts };
  }, [eggs, feedRecords, hens, healthLogs, period, weekly]);

  // Gruppera events per bucket för tooltip
  const eventsByBucket = useMemo(() => {
    const map = new Map<string, EggEvent[]>();
    for (const e of events) {
      const list = map.get(e.bucket) || [];
      list.push(e);
      map.set(e.bucket, list);
    }
    return map;
  }, [events]);

  const yMax = useMemo(() => {
    if (chartData.length === 0) return 0;
    return Math.max(...chartData.map((d) => d.eggs), 1);
  }, [chartData]);

  const eventDotsByKind: Record<EggEvent['kind'], { y: number; color: string; symbol: string }> = {
    feed: { y: Math.max(yMax * 0.92, 1), color: 'hsl(var(--accent-foreground))', symbol: '🌾' },
    hen: { y: Math.max(yMax * 0.84, 1), color: 'hsl(var(--primary))', symbol: '🐔' },
    health: { y: Math.max(yMax * 0.76, 1), color: 'hsl(var(--destructive))', symbol: '＋' },
  };

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;
    const eggsVal = payload.find((p: any) => p.dataKey === 'eggs')?.value ?? 0;
    const avgVal = payload.find((p: any) => p.dataKey === 'avg')?.value;
    const evts = eventsByBucket.get(label) || [];
    return (
      <div className="rounded-xl border border-border bg-popover/95 backdrop-blur px-3 py-2 shadow-md text-xs">
        <p className="font-medium text-foreground">{formatLong(label, weekly)}</p>
        <p className="mt-1 text-foreground">
          {weekly ? 'Ägg den veckan: ' : 'Ägg den dagen: '}<strong>{eggsVal}</strong>
        </p>
        {avgVal != null && (
          <p className="text-muted-foreground">
            Rullande snitt: <strong className="text-primary">{avgVal}</strong>
          </p>
        )}
        {evts.length > 0 && (
          <ul className="mt-1.5 pt-1.5 border-t border-border space-y-0.5">
            {evts.slice(0, 4).map((e, i) => (
              <li key={i} className="text-muted-foreground">• {e.label}</li>
            ))}
            {evts.length > 4 && (
              <li className="text-muted-foreground/70">+{evts.length - 4} till</li>
            )}
          </ul>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6 pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <CardTitle className="font-serif text-base sm:text-lg">📈 Produktion över tid</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {PERIODS.map((p) => (
              <Button
                key={p.key}
                size="sm"
                variant={period === p.key ? 'default' : 'outline'}
                className="h-7 px-2.5 text-[11px] rounded-full"
                onClick={() => setPeriod(p.key)}
              >
                {p.label}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:px-4 pb-4">
        {distinctEggDays < 7 ? (
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Logga ägg i minst en vecka så ritar vi din första kurva 📈
            </p>
          </div>
        ) : (
          <div className="w-full" style={{ height: isMobile ? 220 : 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="eggArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v) => formatShort(v, weekly)}
                  minTickGap={isMobile ? 24 : 16}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  width={28}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={renderTooltip} cursor={{ stroke: 'hsl(var(--border))' }} />
                {!isMobile && (
                  <Legend
                    verticalAlign="top"
                    height={24}
                    iconType="plainline"
                    wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="eggs"
                  name={weekly ? 'Ägg/vecka' : 'Ägg/dag'}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={1}
                  fill="url(#eggArea)"
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  name="7-dagars snitt"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                {!weekly && (
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    name="Prognos"
                    stroke="hsl(var(--primary) / 0.55)"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={false}
                    connectNulls
                  />
                )}
                {events.map((e, i) => {
                  const cfg = eventDotsByKind[e.kind];
                  return (
                    <ReferenceDot
                      key={`${e.kind}-${i}-${e.bucket}`}
                      x={e.bucket}
                      y={cfg.y}
                      r={4}
                      fill={cfg.color}
                      stroke="hsl(var(--background))"
                      strokeWidth={1.5}
                      ifOverflow="extendDomain"
                    />
                  );
                })}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
        {distinctEggDays >= 7 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 px-2 text-[10px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'hsl(var(--accent-foreground))' }} />
              Foderköp
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'hsl(var(--primary))' }} />
              Ny höna
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'hsl(var(--destructive))' }} />
              Hälsologg
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
