import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';

const MIN_ATTRIBUTED_EGGS = 20;

export default function AgeProductionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['age-analytics'],
    queryFn: () => api.getAgeAnalytics(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🐣 Ålder &amp; värpkurva</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.totalActive === 0) return null;

  const overPct = Math.round(data.over3yPct);
  const over3Bucket = data.ageBuckets.find((b) => b.key === '3y+');
  const pullets = data.ageBuckets.find((b) => b.key === '0-6m');

  let ageInsight = '';
  if (over3Bucket && over3Bucket.count > 0) {
    ageInsight = `${overPct}% av flocken är över 3 år – produktionen avtar naturligt vid den åldern.`;
  } else if (pullets && pullets.count > 0) {
    ageInsight = `Du har ${pullets.count} unghöns under 6 månader som snart kommer igång med värpningen.`;
  } else {
    ageInsight = 'Flocken är i sina mest produktiva år – fina förutsättningar för bra äggproduktion.';
  }

  const showCurve = data.attributedEggs >= MIN_ATTRIBUTED_EGGS && data.curve.length >= 3;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">🐣 Ålder &amp; värpkurva</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-6">
        {/* A) Åldersstruktur */}
        <section className="space-y-2">
          <h3 className="font-serif text-sm sm:text-base text-foreground">Åldersstruktur</h3>
          <p className="text-xs text-muted-foreground">
            Antal aktiva värphönor per åldersintervall
          </p>
          <div className="h-52 sm:h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.ageBuckets} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v.toLocaleString('sv-SE')} st`, 'Hönor']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">{ageInsight}</p>
        </section>

        {/* B) Värpkurva efter ålder */}
        <section className="space-y-2">
          <h3 className="font-serif text-sm sm:text-base text-foreground">Värpkurva efter ålder</h3>
          <p className="text-xs text-muted-foreground">
            Snittlig värpprocent per åldersmånad, baserat på ägg som loggats per höna
          </p>
          {!showCurve ? (
            <EmptyState
              emoji="🥚"
              title="För få ägg kopplade till enskilda hönor"
              description="Koppla ägg till specifika hönor när du loggar – då kan vi visa hur värpprocenten utvecklas med åldern."
              actionLabel="Logga ägg per höna"
              onAction={() => window.location.assign('/app/eggs')}
            />
          ) : (
            <div className="h-52 sm:h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.curve} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="ageMonths"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    label={{
                      value: 'Ålder (månader)',
                      position: 'insideBottom',
                      offset: -2,
                      style: { fill: 'hsl(var(--muted-foreground))', fontSize: 11 },
                    }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${v.toFixed(1)} %`, 'Värpprocent']}
                    labelFormatter={(m) => `${m} mån gammal`}
                  />
                  <Line
                    type="monotone"
                    dataKey="layingRatePct"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
