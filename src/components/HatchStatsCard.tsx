import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

const pct = (n: number | null) => (n == null ? '–' : `${n.toFixed(0)}%`);

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 text-center">
      <p className="stat-number text-lg sm:text-xl text-foreground">{value}</p>
      <p className="data-label mt-1 text-[10px] leading-tight">{label}</p>
    </div>
  );
}

export default function HatchStatsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['hatch-statistics'],
    queryFn: () => api.getHatchStatistics(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🐣 Kläckningsstatistik</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  if (data.totalCompleted === 0) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🐣 Kläckningsstatistik</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <EmptyState
            emoji="🐣"
            title="Inga avslutade kläckningar ännu"
            description="När du registrerat en avslutad kläckning ser du befruktnings- och kläckningsgrad här."
            actionLabel="Till kläckningar"
            onAction={() => window.location.assign('/app/breeding')}
          />
        </CardContent>
      </Card>
    );
  }

  const chartData = data.sessions.filter((s) => s.hatchRatePct != null);

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">🐣 Kläckningsstatistik</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
          <StatTile label="Befruktningsgrad" value={pct(data.fertilityRatePct)} />
          <StatTile label="Kläckningsprocent" value={pct(data.hatchRatePct)} />
          <StatTile label="Av befruktade" value={pct(data.hatchOfFertilePct)} />
          <StatTile label="7-dagars överlevnad" value={pct(data.survival7dPct)} />
        </div>

        <p className="text-xs text-muted-foreground">
          Snittvärden över {data.totalCompleted} avslutade {data.totalCompleted === 1 ? 'kläckning' : 'kläckningar'}.
          Sessioner utan registrerade siffror räknas inte med i respektive snitt.
        </p>

        <section className="space-y-2">
          <h3 className="font-serif text-sm sm:text-base text-foreground">Kläckningsprocent per session</h3>
          <p className="text-xs text-muted-foreground">Sorterat efter startdatum – se om utvecklingen går åt rätt håll</p>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Lägg in antal ägg som kläckts i varje session för att se utvecklingen.
            </p>
          ) : (
            <div className="h-56 sm:h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: -12, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    interval={0}
                    angle={-25}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, 100]}
                    tickFormatter={(v) => `${v}%`}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    formatter={(v: number, _n, item: any) => {
                      const p = item?.payload;
                      return [
                        `${v.toFixed(0)}% (${p?.eggsHatched ?? 0}/${p?.eggsSet ?? 0} ägg)`,
                        'Kläckt',
                      ];
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="hatchRatePct" radius={[6, 6, 0, 0]}>
                    {chartData.map((s) => (
                      <Cell
                        key={s.id}
                        fill={
                          (s.hatchRatePct ?? 0) >= 70
                            ? 'hsl(var(--primary))'
                            : (s.hatchRatePct ?? 0) >= 50
                              ? 'hsl(var(--primary) / 0.7)'
                              : 'hsl(var(--muted-foreground) / 0.5)'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
