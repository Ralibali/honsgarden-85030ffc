import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend,
} from 'recharts';

function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-muted/20 border border-border/40 p-3">
      <p className="data-label text-[10px]">{label}</p>
      <p className="stat-number text-xl sm:text-2xl text-foreground mt-1">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
    </div>
  );
}

export default function ProductionForecastCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['production-forecast'],
    queryFn: () => api.getProductionForecast(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🔮 Produktionsprognos</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-56 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  if (!data.hasEnoughData) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🔮 Produktionsprognos</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <EmptyState
            emoji="🌱"
            title="För få dagar med data"
            description={`Logga ägg i minst två veckor så kan Hönsgården börja förutse produktionen. Du har ${data.daysWithData} ${data.daysWithData === 1 ? 'dag' : 'dagar'} loggat hittills.`}
            actionLabel="Logga dagens ägg"
            onAction={() => window.location.assign('/app/eggs')}
          />
        </CardContent>
      </Card>
    );
  }

  const slope = data.slopePerDay ?? 0;
  const trendLabel =
    slope > 0.05 ? 'svagt stigande' : slope < -0.05 ? 'svagt fallande' : 'stabil';

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6 flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="font-serif text-base sm:text-lg">🔮 Produktionsprognos</CardTitle>
        <Badge variant="secondary" className="text-[10px] font-normal">Uppskattning</Badge>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-5">
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <StatTile
            label="Kommande 7 dagar"
            value={`${data.next7Total ?? '–'} ägg`}
            hint={data.avgPerDay != null ? `≈ ${data.avgPerDay.toFixed(1)} ägg/dag` : undefined}
          />
          <StatTile
            label="Kommande 30 dagar"
            value={`${data.next30Total ?? '–'} ägg`}
            hint={`Trend: ${trendLabel}`}
          />
        </div>

        {data.goal && (
          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3 text-sm text-foreground/90 leading-relaxed">
            {data.goal.reachOnLabel ? (
              <>
                Med nuvarande takt når du ditt mål på <strong>{data.goal.targetCount} ägg</strong>{' '}
                omkring <strong>{data.goal.reachOnLabel}</strong>
                {data.goal.daysToReach != null && data.goal.daysToReach > 0 && (
                  <> (om {data.goal.daysToReach} {data.goal.daysToReach === 1 ? 'dag' : 'dagar'})</>
                )}.
                <span className="block text-xs text-muted-foreground mt-1">
                  {data.goal.progressEggs} av {data.goal.targetCount} ägg loggade i nuvarande period.
                </span>
              </>
            ) : (
              <>
                Du behöver fler ägg per dag för att nå målet på {data.goal.targetCount} ägg –
                fortsätt logga så uppdaterar vi prognosen.
              </>
            )}
          </div>
        )}

        <div className="h-60 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.series} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                interval="preserveStartEnd"
                minTickGap={20}
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
                formatter={(v: number | null, name: string) =>
                  v == null ? ['', ''] : [`${v} ägg`, name]
                }
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
                iconType="line"
              />
              <ReferenceLine
                x={data.series.find((s) => s.date === data.todayKey)?.label}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="2 3"
                label={{ value: 'Idag', position: 'top', fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="actual"
                name="Faktiskt"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="forecast"
                name="Prognos"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                strokeDasharray="5 4"
                dot={false}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <p className="text-xs text-muted-foreground italic leading-relaxed">
          Prognosen är en enkel uppskattning baserad på de senaste fyra veckornas snitt och trend.
          Den blir mer pålitlig ju mer du loggar – och påverkas naturligt av säsong, ruggning och nya hönor.
        </p>
      </CardContent>
    </Card>
  );
}
