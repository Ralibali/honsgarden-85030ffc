import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import EmptyState from '@/components/EmptyState';
import { api } from '@/lib/api';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

function formatDays(days: number | null): string {
  if (days == null) return '–';
  if (days < 365) return `${Math.round(days)} d`;
  const years = days / 365;
  return `${years.toFixed(1)} år`;
}

export default function FlockSurvivalCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['flock-survival'],
    queryFn: () => api.getFlockSurvival(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">🌿 Flockens överlevnad</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-52 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const noDeaths = data.totalDeaths === 0;
  const maxCause = data.causes[0]?.count || 1;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">🌿 Flockens överlevnad</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-5">
        {/* Nyckeltal */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 text-center">
            <p className="stat-number text-lg sm:text-xl text-foreground">
              {data.mortalityPct12m != null ? `${data.mortalityPct12m.toFixed(1)}%` : '–'}
            </p>
            <p className="data-label mt-1 text-[10px]">Dödlighet 12 mån</p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 text-center">
            <p className="stat-number text-lg sm:text-xl text-foreground">
              {formatDays(data.avgLifespanDays)}
            </p>
            <p className="data-label mt-1 text-[10px]">Snittlivslängd</p>
          </div>
          <div className="rounded-2xl bg-muted/20 border border-border/40 p-3 text-center">
            <p className="stat-number text-lg sm:text-xl text-foreground">{data.lossesThisYear}</p>
            <p className="data-label mt-1 text-[10px]">Förluster i år</p>
          </div>
        </div>

        {/* Flockstorlek över tid */}
        <section className="space-y-2">
          <h3 className="font-serif text-sm sm:text-base text-foreground">Flockstorlek över tid</h3>
          <p className="text-xs text-muted-foreground">Antal levande hönor de senaste 12 månaderna</p>
          <div className="h-52 sm:h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="flockFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'hsl(var(--border))' }}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ stroke: 'hsl(var(--border))' }}
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [`${v} hönor`, 'Levande']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="alive"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#flockFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Dödsorsaker */}
        <section className="space-y-2">
          <h3 className="font-serif text-sm sm:text-base text-foreground">Dödsorsaker</h3>
          {noDeaths ? (
            <EmptyState
              emoji="🌱"
              title="Inga förluster registrerade"
              description="Fortsätt sköta flocken så bra! När en höna går bort kan du registrera datum och orsak i hennes profil – det hjälper dig se mönster över tid."
            />
          ) : (
            <ul className="space-y-2">
              {data.causes.map((c) => (
                <li key={c.cause} className="space-y-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-foreground truncate">{c.cause}</span>
                    <span className="stat-number text-muted-foreground shrink-0">
                      {c.count} st
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary/70 rounded-full"
                      style={{ width: `${Math.min(100, (c.count / maxCause) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
