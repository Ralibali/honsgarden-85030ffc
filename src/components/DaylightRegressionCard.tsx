import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import { api, type DaylightScatterPoint, type RegressionResult } from '@/lib/api';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ZAxis,
} from 'recharts';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 });

function regressionLinePoints(reg: RegressionResult) {
  const pad = (reg.xMax - reg.xMin) * 0.02 || 0.1;
  const x1 = reg.xMin - pad;
  const x2 = reg.xMax + pad;
  return [
    { x: x1, y: Math.max(0, reg.intercept + reg.slope * x1) },
    { x: x2, y: Math.max(0, reg.intercept + reg.slope * x2) },
  ];
}

function ScatterWithRegression({
  points,
  reg,
  xKey,
  xLabel,
  xUnit,
}: {
  points: DaylightScatterPoint[];
  reg: RegressionResult;
  xKey: 'daylightHours' | 'temp';
  xLabel: string;
  xUnit: string;
}) {
  const data = points
    .map((p) => ({ x: p[xKey] as number, y: p.eggsPerHen, label: p.label }))
    .filter((p) => typeof p.x === 'number');
  const line = regressionLinePoints(reg);

  return (
    <div className="h-56 sm:h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 8, right: 12, left: -8, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            type="number"
            dataKey="x"
            name={xLabel}
            domain={['dataMin - 0.5', 'dataMax + 0.5']}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            label={{
              value: `${xLabel} (${xUnit})`,
              position: 'insideBottom',
              offset: -8,
              fill: 'hsl(var(--muted-foreground))',
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Ägg/höna"
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => nf.format(v)}
          />
          <ZAxis range={[40, 40]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              borderRadius: 12,
              fontSize: 12,
            }}
            formatter={(value: number, name: string) => {
              if (name === 'Ägg/höna') return [nf.format(value), name];
              if (name === xLabel) return [`${nf.format(value)} ${xUnit}`, name];
              return [value, name];
            }}
            labelFormatter={() => ''}
          />
          <Scatter
            name="Dag"
            data={data}
            fill="hsl(var(--primary))"
            fillOpacity={0.55}
          />
          <Line
            type="linear"
            data={line}
            dataKey="y"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
            legendType="none"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function StatRow({ reg }: { reg: RegressionResult }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>
        Lutning: <strong className="text-foreground">{nf.format(reg.slope)}</strong>
      </span>
      <span>
        R²: <strong className="text-foreground">{reg.r2.toFixed(2)}</strong>
      </span>
      <span>
        Dagar: <strong className="text-foreground">{reg.n}</strong>
      </span>
    </div>
  );
}

export default function DaylightRegressionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['daylight-temp-analysis'],
    queryFn: () => api.getDaylightTempAnalysis(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">☀️ Dagsljus & temperatur</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const hasDaylight = !!data.daylightRegression;
  const hasTemp = !!data.tempRegression;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6 flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="font-serif text-base sm:text-lg">☀️ Dagsljus & temperatur</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Hur ljus och värme påverkar din flocks värpning.
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal">Regression</Badge>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-6">
        {!hasDaylight ? (
          <EmptyState
            emoji="📊"
            title="För få dagar för analys"
            description={`Vi behöver minst 20 dagar med både äggloggar och aktiva hönor för att räkna ut sambanden. Du har ${data.daysWithData} ${data.daysWithData === 1 ? 'dag' : 'dagar'} hittills – fortsätt logga så börjar mönstret framträda.`}
          />
        ) : (
          <section className="space-y-3">
            <div>
              <h3 className="font-serif text-sm sm:text-base text-foreground">
                Ägg per höna vs. dagsljustimmar
              </h3>
              {data.daylightInsight && (
                <p className="text-sm text-foreground/90 leading-relaxed mt-1">
                  {data.daylightInsight}
                </p>
              )}
            </div>
            <ScatterWithRegression
              points={data.daylightPoints}
              reg={data.daylightRegression!}
              xKey="daylightHours"
              xLabel="Dagsljus"
              xUnit="h"
            />
            <StatRow reg={data.daylightRegression!} />
          </section>
        )}

        {hasTemp ? (
          <section className="space-y-3 pt-2 border-t border-border/60">
            <div>
              <h3 className="font-serif text-sm sm:text-base text-foreground">
                Ägg per höna vs. temperatur
              </h3>
              {data.tempInsight && (
                <p className="text-sm text-foreground/90 leading-relaxed mt-1">
                  {data.tempInsight}
                </p>
              )}
            </div>
            <ScatterWithRegression
              points={data.tempPoints}
              reg={data.tempRegression!}
              xKey="temp"
              xLabel="Temperatur"
              xUnit="°C"
            />
            <StatRow reg={data.tempRegression!} />
          </section>
        ) : hasDaylight ? (
          <section className="pt-2 border-t border-border/60">
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              När fler äggloggar har sparats med väderdata visas även sambandet med temperatur här.
            </p>
          </section>
        ) : null}

        {data.latitudeSource === 'fallback' && (
          <p className="text-[11px] text-muted-foreground italic leading-relaxed">
            Ange din plats i inställningar för exakt dagsljus – just nu används en svensk genomsnittlig latitud.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
