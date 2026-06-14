import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });

function barColor(v: number) {
  if (v > 0.25) return 'hsl(142 60% 40%)';
  if (v < -0.25) return 'hsl(0 70% 50%)';
  return 'hsl(var(--muted-foreground))';
}

export default function SeasonDecompositionCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['decomposition'],
    queryFn: () => api.getDecomposition(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🔬 Trend, säsong & brus</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  if (!data.hasEnoughData) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🔬 Trend, säsong & brus</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <EmptyState
            emoji="🌱"
            title="För få dagar för dekomposition"
            description={`Vi behöver minst 60 dagar med loggade ägg för att skilja trend från säsong. Du har ${data.daysWithData} ${data.daysWithData === 1 ? 'dag' : 'dagar'} hittills – fortsätt logga så blir analysen tydligare.`}
            actionLabel="Logga dagens ägg"
            onAction={() => window.location.assign('/app/eggs')}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6 flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="font-serif text-base sm:text-lg">🔬 Trend, säsong & brus</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Minskar din flock på riktigt – eller är det bara vintern?
          </p>
        </div>
        <Badge variant="secondary" className="text-[10px] font-normal">Additiv modell</Badge>
      </CardHeader>

      <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-3 text-sm text-foreground/90 leading-relaxed">
          {data.verdict}
        </div>

        <Tabs defaultValue="trend" className="w-full">
          <TabsList className="grid w-full grid-cols-3 h-9">
            <TabsTrigger value="trend" className="text-xs">Trend</TabsTrigger>
            <TabsTrigger value="season" className="text-xs">Säsong</TabsTrigger>
            <TabsTrigger value="residual" className="text-xs">Brus</TabsTrigger>
          </TabsList>

          <TabsContent value="trend" className="mt-3">
            <div className="h-60 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
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
                    formatter={(v: number | null, name: string) =>
                      v == null ? ['', ''] : [nf.format(v), name]
                    }
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    name="Faktiskt"
                    stroke="hsl(var(--muted-foreground))"
                    strokeOpacity={0.5}
                    strokeWidth={1.5}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="trend"
                    name="Trend"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground italic leading-relaxed mt-2">
              Den gröna linjen är ett 30-dagars centrerat snitt – så ser den underliggande nivån ut.
            </p>
          </TabsContent>

          <TabsContent value="season" className="mt-3 space-y-5">
            {data.hasMonthSeason ? (
              <div className="space-y-2">
                <h3 className="font-serif text-sm text-foreground">Månadssäsong</h3>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthSeasonal} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                        tickLine={false}
                        axisLine={{ stroke: 'hsl(var(--border))' }}
                      />
                      <YAxis
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
                        formatter={(v: number) => [`${v > 0 ? '+' : ''}${nf.format(v)} ägg`, 'Avvikelse']}
                      />
                      <ReferenceLine y={0} stroke="hsl(var(--border))" />
                      <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                        {data.monthSeasonal.map((p) => (
                          <Cell key={p.month} fill={barColor(p.value)} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic leading-relaxed">
                Månadssäsong kräver minst två års data för att bli pålitlig. Den dyker upp här när du loggat tillräckligt länge.
              </p>
            )}

            <div className="space-y-2">
              <h3 className="font-serif text-sm text-foreground">Veckodagssäsong</h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.weekdaySeasonal} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
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
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v: number) => [`${v > 0 ? '+' : ''}${nf.format(v)} ägg`, 'Avvikelse']}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {data.weekdaySeasonal.map((p) => (
                        <Cell key={p.weekday} fill={barColor(p.value)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <p className="text-xs text-muted-foreground italic leading-relaxed">
              Staplarna visar hur mycket varje månad/veckodag avviker från snittet, efter att trenden räknats bort.
            </p>
          </TabsContent>

          <TabsContent value="residual" className="mt-3">
            <div className="h-60 sm:h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
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
                    formatter={(v: number | null) =>
                      v == null ? ['', ''] : [`${v > 0 ? '+' : ''}${nf.format(v)}`, 'Brus']
                    }
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Line
                    type="monotone"
                    dataKey="residual"
                    name="Brus"
                    stroke="hsl(var(--primary))"
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-muted-foreground italic leading-relaxed mt-2">
              Det som blir kvar när trend och säsong räknats bort. Stora utslag är dagar som verkligen sticker ut.
            </p>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
