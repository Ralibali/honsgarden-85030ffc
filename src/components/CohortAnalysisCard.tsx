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
  Legend,
} from 'recharts';

const nf = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 1 });

export default function CohortAnalysisCard() {
  const { data, isLoading } = useQuery({
    queryKey: ['cohort-analysis'],
    queryFn: () => api.getCohortAnalysis(),
  });

  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="px-4 sm:px-6">
          <CardTitle className="font-serif text-base sm:text-lg">👶 Kohortanalys</CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-6 pb-4">
          <Skeleton className="h-72 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;
  const cohorts = data.cohorts ?? [];

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">👶 Kohortanalys</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Hur värper olika kullar i takt med åldern? "Vårkullen -24 toppade vid 28 veckor."
        </p>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-4">
        {cohorts.length === 0 ? (
          <EmptyState
            emoji="🌱"
            title="Inga kvalificerade kohorter ännu"
            description="Ange födelsedatum och koppla ägg till hönor för kohortkurvor. Vi behöver minst 2 hönor per kohort med några loggade ägg."
            actionLabel="Gå till hönor"
            onAction={() => window.location.assign('/app/hens')}
          />
        ) : (
          <>
            <div className="flex flex-wrap gap-2">
              {cohorts.map((c) => (
                <Badge
                  key={c.key}
                  variant="secondary"
                  className="text-[10px] font-normal flex items-center gap-1.5"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ background: c.color }}
                  />
                  {c.label} ({c.henCount})
                </Badge>
              ))}
            </div>

            <div className="h-72 sm:h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.series} margin={{ top: 8, right: 12, left: -8, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="week"
                    type="number"
                    domain={[0, data.maxWeek]}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: 'hsl(var(--border))' }}
                    label={{
                      value: 'Ålder (veckor)',
                      position: 'insideBottom',
                      offset: -8,
                      fill: 'hsl(var(--muted-foreground))',
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => nf.format(v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelFormatter={(w) => `Vecka ${w}`}
                    formatter={(v: number | null, name: string) => {
                      if (v == null) return ['', ''];
                      const cohort = cohorts.find((c) => c.key === name);
                      return [`${nf.format(v)} ägg/höna`, cohort?.label ?? name];
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: 11, color: 'hsl(var(--muted-foreground))' }}
                    iconType="line"
                    formatter={(value) => {
                      const cohort = cohorts.find((c) => c.key === value);
                      return cohort?.label ?? value;
                    }}
                  />
                  {cohorts.map((c) => (
                    <Line
                      key={c.key}
                      type="monotone"
                      dataKey={c.key}
                      name={c.key}
                      stroke={c.color}
                      strokeWidth={2}
                      dot={false}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[11px] text-muted-foreground italic leading-relaxed">
              Y-axeln visar genomsnittligt antal ägg per höna och vecka vid varje ålder. Kohorter
              skapas från kläckningar – eller från födelsemånad om kläckningssession saknas.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
