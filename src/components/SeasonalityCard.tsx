import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { api } from '@/lib/api';
import { useIsMobile } from '@/hooks/use-mobile';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Maj', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
const MONTHS_LONG = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];
const WEEKDAYS = ['Mån', 'Tis', 'Ons', 'Tor', 'Fre', 'Lör', 'Sön'];

interface EggRow {
  date: string;
  count: number | null;
}

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

// ISO weekday: Mon=0 ... Sun=6
function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export default function SeasonalityCard() {
  const isMobile = useIsMobile();
  const [tab, setTab] = useState<'yoy' | 'cal'>('yoy');

  const { data: eggs = [] } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs().catch(() => [] as EggRow[]),
  });

  // -------- Year over year --------
  const yoy = useMemo(() => {
    const list = eggs as EggRow[];
    const years = new Set<number>();
    // map year -> month-index -> sum
    const byYearMonth = new Map<number, number[]>();
    for (const e of list) {
      const d = new Date(e.date);
      if (isNaN(d.getTime())) continue;
      const y = d.getFullYear();
      const m = d.getMonth();
      years.add(y);
      if (!byYearMonth.has(y)) byYearMonth.set(y, new Array(12).fill(0));
      byYearMonth.get(y)![m] += e.count || 0;
    }
    const sortedYears = Array.from(years).sort();
    const chartData = MONTHS_SHORT.map((label, i) => {
      const row: Record<string, number | string> = { month: label };
      for (const y of sortedYears) row[String(y)] = byYearMonth.get(y)?.[i] || 0;
      return row;
    });

    // Insight: current month this year vs same month last year
    const now = new Date();
    const currentY = now.getFullYear();
    const currentM = now.getMonth();
    const thisYearVal = byYearMonth.get(currentY)?.[currentM] || 0;
    const lastYearVal = byYearMonth.get(currentY - 1)?.[currentM];
    let insight = '';
    if (sortedYears.length <= 1) {
      insight = 'Nästa år kan du jämföra mot i år – vi sparar all historik.';
    } else if (lastYearVal == null || lastYearVal === 0) {
      insight = `${MONTHS_LONG[currentM].charAt(0).toUpperCase() + MONTHS_LONG[currentM].slice(1)} i år: ${thisYearVal} ägg – ingen data från förra året att jämföra mot.`;
    } else {
      const pct = Math.round(((thisYearVal - lastYearVal) / lastYearVal) * 100);
      const arrow = pct > 0 ? '📈' : pct < 0 ? '📉' : '➖';
      const word = pct > 0 ? 'mer' : pct < 0 ? 'mindre' : 'lika mycket';
      insight = `${MONTHS_LONG[currentM].charAt(0).toUpperCase() + MONTHS_LONG[currentM].slice(1)} i år: ${thisYearVal} ägg – ${Math.abs(pct)} % ${word} än ${MONTHS_LONG[currentM]} förra året ${arrow}`;
    }
    return { chartData, years: sortedYears, insight };
  }, [eggs]);

  // -------- Calendar heatmap --------
  const heatmap = useMemo(() => {
    const list = eggs as EggRow[];
    const totalsByDay = new Map<string, number>();
    for (const e of list) {
      totalsByDay.set(e.date, (totalsByDay.get(e.date) || 0) + (e.count || 0));
    }

    const today = startOfDay(new Date());
    const monthsBack = isMobile ? 6 : 12;
    const start = new Date(today);
    start.setMonth(start.getMonth() - monthsBack);
    start.setDate(1);
    // Align to Monday
    const alignOffset = isoWeekday(start);
    start.setDate(start.getDate() - alignOffset);

    // Build weeks
    const weeks: { date: Date; key: string; count: number }[][] = [];
    const cursor = new Date(start);
    while (cursor <= today) {
      const week: { date: Date; key: string; count: number }[] = [];
      for (let i = 0; i < 7; i++) {
        const key = ymd(cursor);
        week.push({
          date: new Date(cursor),
          key,
          count: cursor > today ? -1 : (totalsByDay.get(key) || 0),
        });
        cursor.setDate(cursor.getDate() + 1);
      }
      weeks.push(week);
    }

    const maxCount = Math.max(1, ...Array.from(totalsByDay.values()));

    // Best day across all history
    let bestKey: string | null = null;
    let bestCount = 0;
    for (const [k, v] of totalsByDay) {
      if (v > bestCount) {
        bestCount = v;
        bestKey = k;
      }
    }
    let bestLabel = '';
    if (bestKey && bestCount > 0) {
      const d = new Date(bestKey);
      bestLabel = `Din bästa dag: ${bestCount} ägg den ${d.getDate()} ${MONTHS_LONG[d.getMonth()]} ${d.getFullYear()}`;
    }

    // Month labels: position above the first week of each month
    const monthLabels: { col: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((w, col) => {
      // Use the first day of the week that is on or after the month boundary
      const firstReal = w.find((c) => c.count >= 0) || w[0];
      const m = firstReal.date.getMonth();
      if (m !== lastMonth) {
        monthLabels.push({ col, label: MONTHS_SHORT[m] });
        lastMonth = m;
      }
    });

    return { weeks, maxCount, bestLabel, monthLabels };
  }, [eggs, isMobile]);

  function intensityClass(count: number, max: number): string {
    if (count < 0) return 'bg-transparent';
    if (count === 0) return 'bg-muted';
    const ratio = count / max;
    if (ratio < 0.25) return 'bg-primary/25';
    if (ratio < 0.5) return 'bg-primary/45';
    if (ratio < 0.75) return 'bg-primary/65';
    return 'bg-primary';
  }

  // recharts series colors – cycle through theme tokens
  const seriesColors = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--warning))', 'hsl(var(--muted-foreground))'];

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">📅 Säsong &amp; mönster</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as 'yoy' | 'cal')}>
          <TabsList className="grid grid-cols-2 w-full sm:w-auto mb-4">
            <TabsTrigger value="yoy">År mot år</TabsTrigger>
            <TabsTrigger value="cal">Kalender</TabsTrigger>
          </TabsList>

          <TabsContent value="yoy" className="mt-0 space-y-3">
            <div className="w-full h-[260px] sm:h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yoy.chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value: number, name: string) => [`${value} ägg`, name]}
                  />
                  {!isMobile && <Legend wrapperStyle={{ fontSize: 12 }} />}
                  {yoy.years.map((y, i) => (
                    <Bar
                      key={y}
                      dataKey={String(y)}
                      fill={seriesColors[i % seriesColors.length]}
                      radius={[4, 4, 0, 0]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm text-foreground/80 leading-relaxed">{yoy.insight}</p>
          </TabsContent>

          <TabsContent value="cal" className="mt-0 space-y-3">
            <div className="overflow-x-auto -mx-1 px-1">
              <div className="inline-block min-w-full">
                {/* Month labels */}
                <div className="flex pl-8 mb-1">
                  {heatmap.weeks.map((_, col) => {
                    const label = heatmap.monthLabels.find((m) => m.col === col)?.label;
                    return (
                      <div key={col} className="w-[14px] sm:w-[16px] text-[10px] text-muted-foreground shrink-0">
                        {label || ''}
                      </div>
                    );
                  })}
                </div>
                {/* Grid */}
                <div className="flex">
                  {/* Weekday labels */}
                  <div className="flex flex-col mr-1 w-7 shrink-0">
                    {WEEKDAYS.map((wd, i) => (
                      <div
                        key={wd}
                        className="h-[14px] sm:h-[16px] text-[10px] text-muted-foreground flex items-center"
                        style={{ visibility: i % 2 === 0 ? 'visible' : 'hidden' }}
                      >
                        {wd}
                      </div>
                    ))}
                  </div>
                  {/* Cells */}
                  <div className="flex gap-[2px]">
                    {heatmap.weeks.map((week, col) => (
                      <div key={col} className="flex flex-col gap-[2px]">
                        {week.map((cell) => {
                          const cls = intensityClass(cell.count, heatmap.maxCount);
                          const tooltip = cell.count >= 0
                            ? `${cell.date.getDate()} ${MONTHS_LONG[cell.date.getMonth()]} ${cell.date.getFullYear()}: ${cell.count} ägg`
                            : '';
                          return (
                            <div
                              key={cell.key}
                              title={tooltip}
                              className={`w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] rounded-[3px] ${cls} ${cell.count >= 0 ? 'border border-border/30' : ''}`}
                              aria-label={tooltip}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                {/* Legend */}
                <div className="flex items-center gap-2 mt-3 pl-8 text-[10px] text-muted-foreground">
                  <span>Mindre</span>
                  <div className="w-3 h-3 rounded-[3px] bg-muted border border-border/30" />
                  <div className="w-3 h-3 rounded-[3px] bg-primary/25 border border-border/30" />
                  <div className="w-3 h-3 rounded-[3px] bg-primary/45 border border-border/30" />
                  <div className="w-3 h-3 rounded-[3px] bg-primary/65 border border-border/30" />
                  <div className="w-3 h-3 rounded-[3px] bg-primary border border-border/30" />
                  <span>Mer</span>
                </div>
              </div>
            </div>
            {heatmap.bestLabel && (
              <p className="text-sm text-foreground/80 leading-relaxed">{heatmap.bestLabel}</p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
