import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });

function statusText(latest: { z: number | null; direction: 'above' | 'below' | null; outOf2: boolean } | null) {
  if (!latest || latest.z == null) return 'Inte tillräckligt med data för senaste dagen ännu.';
  const absZ = Math.abs(latest.z);
  if (latest.outOf2) {
    if (latest.direction === 'below') {
      return `Senaste dagen: ${nf.format(absZ)}σ under det normala – värt att kolla foder, ljus och eventuell stress.`;
    }
    return `Senaste dagen: ${nf.format(absZ)}σ över det normala – ovanligt fin värpdag!`;
  }
  return `Inom normal variation (${nf.format(latest.z)}σ).`;
}

export default function ProductionControlChart() {
  const [windowSize, setWindowSize] = useState<14 | 28>(28);
  const { data, isLoading } = useQuery({
    queryKey: ['production-control', windowSize],
    queryFn: () => api.getProductionControlData(windowSize),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">📈 Avvikelsediagram</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const outliers = (data.series ?? []).filter((p) => p.outOf2);
  const above = outliers.filter((p) => p.direction === 'above');
  const below = outliers.filter((p) => p.direction === 'below');

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6 flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="font-serif text-base sm:text-lg">📈 Avvikelsediagram</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Statistisk kontroll – upptäck verkliga avvikelser, inte brus.
          </p>
        </div>
        <div className="flex items-center gap-1">
          {([14, 28] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setWindowSize(n)}
              className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                windowSize === n
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:bg-muted/40'
              }`}
              aria-pressed={windowSize === n}
            >
              {n} d
            </button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
        {!data.hasEnoughData ? (
          <EmptyState
            emoji="📊"
            title="För få dagar för kontrollkarta"
            description={`Vi behöver minst 21 dagar med loggade ägg för att räkna ut rullande snitt och kontrollgränser. Du har ${data.daysWithData} ${data.daysWithData === 1 ? 'dag' : 'dagar'} hittills – fortsätt logga så börjar mönstret framträda.`}
            actionLabel="Logga dagens ägg"
            onAction={() => window.location.assign('/app/eggs')}
          />
        ) : (
          <>
            <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3 text-sm text-foreground/90 leading-relaxed">
              <span className="font-medium">{data.yesterdayLabel ?? 'Senaste dagen'}:</span>{' '}
              {statusText(data.latest)}
            </div>

            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={data.series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    interval="preserveStartEnd"
                    minTickGap={24}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number | null, name: string) => {
                      if (v == null) return ['', ''];
                      return [nf.format(v as number), name];
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }} iconType="line" />

                  <Line
                    type="monotone"
                    dataKey="ucl3"
                    name="+3σ"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.4}
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    dot={false}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="lcl3"
                    name="-3σ"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.4}
                    strokeWidth={1}
                    strokeDasharray="2 4"
                    dot={false}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="ucl2"
                    name="±2σ"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="lcl2"
                    name="-2σ"
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                    dot={false}
                    legendType="none"
                  />
                  <Line
                    type="monotone"
                    dataKey="mean"
                    name="Snitt"
                    stroke="hsl(var(--primary))"
                    strokeOpacity={0.6}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    name="Ägg/dag"
                    stroke="hsl(var(--foreground))"
                    strokeWidth={2}
                    dot={false}
                  />

                  <Scatter
                    name="Över +2σ"
                    data={above}
                    dataKey="count"
                    fill="hsl(142 60% 40%)"
                  />
                  <Scatter
                    name="Under -2σ"
                    data={below}
                    dataKey="count"
                    fill="hsl(0 70% 50%)"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="text-[10px] font-normal">
                Fönster: {windowSize} dagar
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-normal">
                {outliers.length} avvikande {outliers.length === 1 ? 'dag' : 'dagar'}
              </Badge>
            </div>

            <p className="text-xs text-muted-foreground italic leading-relaxed">
              Linjen visar daglig produktion. Skuggan mellan kontrollgränserna är "normal variation" –
              ungefär 95% av dagarna borde landa innanför ±2σ. Punkter utanför är värda att titta närmare på.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
