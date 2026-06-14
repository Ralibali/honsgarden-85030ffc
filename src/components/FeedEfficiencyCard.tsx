import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
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
  BarChart,
  Bar,
} from 'recharts';

const krFmt = (n: number) =>
  new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 2 }).format(n);

export default function FeedEfficiencyCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['feed-efficiency-trend'],
    queryFn: () => api.getFeedEfficiencyTrend(),
  });

  const [typeMetric, setTypeMetric] = useState<'totalCost' | 'costPerKg'>('totalCost');

  const costSeries = useMemo(
    () => (data?.months || []).filter((m) => m.costPerEgg != null),
    [data],
  );
  const kgSeries = useMemo(
    () => (data?.months || []).filter((m) => m.kgPerDozen != null),
    [data],
  );

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🌾 Foder &amp; effektivitet</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  if (!data.hasFeedRecords) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🌾 Foder &amp; effektivitet</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <EmptyState
            emoji="🌾"
            title="Ingen foderdata ännu"
            description="Logga foder för att se kostnad per ägg och hitta det billigaste fodret över tid."
            actionLabel="Logga foder"
            onAction={() => window.location.assign('/app/feed')}
          />
        </CardContent>
      </Card>
    );
  }

  const typeData = (data.feedTypes || [])
    .filter((t) => (typeMetric === 'totalCost' ? t.totalCost > 0 : t.costPerKg != null))
    .map((t) => ({
      type: t.type,
      value: typeMetric === 'totalCost' ? t.totalCost : (t.costPerKg ?? 0),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">🌾 Foder &amp; effektivitet</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-6">
        {/* Kostnad per ägg */}
        <section className="space-y-2">
          <h3 className="font-serif text-sm sm:text-base text-foreground">Kostnad per ägg över tid</h3>
          <p className="text-xs text-muted-foreground">Kronor per ägg, månad för månad</p>
          {costSeries.length < 2 ? (
            <p className="text-sm text-muted-foreground italic">
              Logga både foder och ägg under ett par månader så syns trenden här.
            </p>
          ) : (
            <div className="h-52 sm:h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={costSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${krFmt(v)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${krFmt(v)} kr/ägg`, 'Kostnad']}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="costPerEgg"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Foderåtgång */}
        <section className="space-y-2">
          <h3 className="font-serif text-sm sm:text-base text-foreground">Foderåtgång per dussin ägg</h3>
          <p className="text-xs text-muted-foreground">Kg foder per 12 ägg, månad för månad</p>
          {kgSeries.length < 2 ? (
            <p className="text-sm text-muted-foreground italic">
              Statistiken blir tydlig efter ett par månader med både foder- och ägglogg.
            </p>
          ) : (
            <div className="h-52 sm:h-60 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={kgSeries} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${krFmt(v)} kg`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number) => [`${krFmt(v)} kg/dussin`, 'Foder']}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="kgPerDozen"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Jämför fodertyper */}
        <section className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h3 className="font-serif text-sm sm:text-base text-foreground">Jämför fodertyper</h3>
              <p className="text-xs text-muted-foreground">
                {typeMetric === 'totalCost' ? 'Total kostnad per fodertyp' : 'Kronor per kg foder'}
              </p>
            </div>
            <div className="inline-flex gap-1 rounded-full bg-muted/40 p-1">
              <Button
                size="sm"
                variant={typeMetric === 'totalCost' ? 'default' : 'ghost'}
                className="rounded-full h-7 px-3 text-xs"
                onClick={() => setTypeMetric('totalCost')}
              >
                Totalt
              </Button>
              <Button
                size="sm"
                variant={typeMetric === 'costPerKg' ? 'default' : 'ghost'}
                className="rounded-full h-7 px-3 text-xs"
                onClick={() => setTypeMetric('costPerKg')}
              >
                Kr/kg
              </Button>
            </div>
          </div>
          {typeData.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Lägg in pris och vikt på fodret för att kunna jämföra typerna.
            </p>
          ) : (
            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={typeData}
                  layout="vertical"
                  margin={{ top: 4, right: 12, left: 8, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${krFmt(v)}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="type"
                    width={110}
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
                    formatter={(v: number) => [
                      `${krFmt(v)} ${typeMetric === 'totalCost' ? 'kr' : 'kr/kg'}`,
                      typeMetric === 'totalCost' ? 'Total kostnad' : 'Pris per kg',
                    ]}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
