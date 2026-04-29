import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { TrendingUp, TrendingDown, Minus, Egg, Thermometer, CloudRain, Wind, Activity, Info } from 'lucide-react';

type Daily = {
  time: string[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  weathercode: number[];
  precipitation_sum: number[];
  wind_speed_10m_max: number[];
};

type Props = {
  daily: Daily | undefined;
  latitude: number;
  longitude: number;
};

// Bucket-grupper för väder
type Bucket = 'cold' | 'cool' | 'mild' | 'warm' | 'hot' | 'rainy' | 'windy';

function getBuckets(tMax: number, tMin: number, precip: number, wind: number): Bucket[] {
  const tAvg = (tMax + tMin) / 2;
  const buckets: Bucket[] = [];
  if (tAvg < -2) buckets.push('cold');
  else if (tAvg < 8) buckets.push('cool');
  else if (tAvg < 18) buckets.push('mild');
  else if (tAvg < 25) buckets.push('warm');
  else buckets.push('hot');
  if (precip >= 5) buckets.push('rainy');
  if (wind >= 10) buckets.push('windy');
  return buckets;
}

const BUCKET_LABEL: Record<Bucket, string> = {
  cold: 'Frost (under -2°)',
  cool: 'Kallt (–2 till 8°)',
  mild: 'Milt (8–18°)',
  warm: 'Varmt (18–25°)',
  hot: 'Hetta (över 25°)',
  rainy: 'Regn (≥5 mm)',
  windy: 'Blåsigt (≥10 m/s)',
};

const BUCKET_ICON: Record<Bucket, JSX.Element> = {
  cold: <Thermometer className="h-3.5 w-3.5 text-info" />,
  cool: <Thermometer className="h-3.5 w-3.5 text-info" />,
  mild: <Thermometer className="h-3.5 w-3.5 text-primary" />,
  warm: <Thermometer className="h-3.5 w-3.5 text-warning" />,
  hot: <Thermometer className="h-3.5 w-3.5 text-destructive" />,
  rainy: <CloudRain className="h-3.5 w-3.5 text-info" />,
  windy: <Wind className="h-3.5 w-3.5 text-muted-foreground" />,
};

function fmt(n: number, digits = 1) {
  return n.toFixed(digits).replace(/\.0$/, '');
}

export default function WeatherImpactCard({ daily, latitude, longitude }: Props) {
  const { user } = useAuth();

  // Hämta 60 dagars äggdata + cachad väderhistorik
  const { data, isLoading } = useQuery({
    queryKey: ['weather-impact', user?.id],
    queryFn: async () => {
      const since = new Date(Date.now() - 60 * 24 * 3600_000).toISOString().split('T')[0];
      const { data: farmIds } = await supabase.rpc('get_user_farm_ids', { _uid: user!.id });
      const ids = (farmIds ?? []).map((r: any) => r.get_user_farm_ids ?? r);
      if (!ids.length) return { eggsByDay: {} as Record<string, number>, weatherByDay: {} as Record<string, any> };

      const sb = supabase as any;
      const eggsRes = await sb
        .from('eggs')
        .select('date, count')
        .in('farm_id', ids)
        .gte('date', since);
      const weatherRes = await sb
        .from('weather_advice_cache')
        .select('cache_date, weather_snapshot')
        .eq('user_id', user!.id)
        .gte('cache_date', since);

      const eggsByDay: Record<string, number> = {};
      for (const e of (eggsRes.data ?? []) as Array<{ date: string; count: number | null }>) {
        eggsByDay[e.date] = (eggsByDay[e.date] ?? 0) + (e.count ?? 0);
      }

      // Hämta historiskt väder från Open-Meteo Archive för dagar utan cache
      const cachedDates = new Set((weatherRes.data ?? []).map((r) => r.cache_date));
      const weatherByDay: Record<string, { tMax: number; tMin: number; precip: number; wind: number; code: number }> = {};
      for (const row of weatherRes.data ?? []) {
        const snap: any = row.weather_snapshot;
        const cur = snap?.current ?? {};
        const dailyArr = snap?.daily;
        // försök plocka ut dagens värden från snapshot
        const idx = dailyArr?.time?.indexOf?.(row.cache_date);
        if (idx != null && idx >= 0) {
          weatherByDay[row.cache_date] = {
            tMax: dailyArr.temperature_2m_max[idx],
            tMin: dailyArr.temperature_2m_min[idx],
            precip: dailyArr.precipitation_sum[idx] ?? 0,
            wind: dailyArr.wind_speed_10m_max[idx] ?? 0,
            code: dailyArr.weathercode[idx] ?? 0,
          };
        } else if (cur.temperature_2m != null) {
          weatherByDay[row.cache_date] = {
            tMax: cur.temperature_2m,
            tMin: cur.temperature_2m,
            precip: 0,
            wind: cur.wind_speed_10m ?? 0,
            code: cur.weathercode ?? 0,
          };
        }
      }

      // Komplettera med Open-Meteo Archive för dagar utan cache (max 60d)
      const missingDates = Object.keys(eggsByDay).filter((d) => !cachedDates.has(d));
      if (missingDates.length > 0) {
        const start = missingDates.sort()[0];
        const end = missingDates.sort()[missingDates.length - 1];
        try {
          const res = await fetch(
            `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}&start_date=${start}&end_date=${end}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max,weathercode&timezone=auto`,
          );
          if (res.ok) {
            const arch = await res.json();
            const t: string[] = arch.daily?.time ?? [];
            t.forEach((d, i) => {
              if (!weatherByDay[d]) {
                weatherByDay[d] = {
                  tMax: arch.daily.temperature_2m_max[i],
                  tMin: arch.daily.temperature_2m_min[i],
                  precip: arch.daily.precipitation_sum[i] ?? 0,
                  wind: arch.daily.wind_speed_10m_max[i] ?? 0,
                  code: arch.daily.weathercode[i] ?? 0,
                };
              }
            });
          }
        } catch {
          // tyst fallback – vi visar bara det vi har
        }
      }

      return { eggsByDay, weatherByDay };
    },
    enabled: !!user?.id,
    staleTime: 30 * 60 * 1000,
  });

  const analysis = useMemo(() => {
    if (!data) return null;
    const { eggsByDay, weatherByDay } = data;
    const days = Object.keys(eggsByDay).sort();
    if (days.length < 7) return { matched: 0, days: days.length, baseline: 0, perBucket: [] as any[], forecast: [] as any[] };

    // Baseline: snitt av loggade dagar
    const all = days.map((d) => eggsByDay[d]);
    const baseline = all.reduce((a, b) => a + b, 0) / all.length;

    // Bucket → samla ägg
    const bucketStats: Record<Bucket, { sum: number; n: number }> = {
      cold: { sum: 0, n: 0 },
      cool: { sum: 0, n: 0 },
      mild: { sum: 0, n: 0 },
      warm: { sum: 0, n: 0 },
      hot: { sum: 0, n: 0 },
      rainy: { sum: 0, n: 0 },
      windy: { sum: 0, n: 0 },
    };
    let matched = 0;
    for (const d of days) {
      const w = weatherByDay[d];
      if (!w) continue;
      matched++;
      const buckets = getBuckets(w.tMax, w.tMin, w.precip, w.wind);
      for (const b of buckets) {
        bucketStats[b].sum += eggsByDay[d];
        bucketStats[b].n += 1;
      }
    }

    const perBucket = (Object.keys(bucketStats) as Bucket[])
      .filter((b) => bucketStats[b].n >= 3)
      .map((b) => {
        const avg = bucketStats[b].sum / bucketStats[b].n;
        const diff = avg - baseline;
        const pct = baseline > 0 ? (diff / baseline) * 100 : 0;
        return { bucket: b, avg, diff, pct, n: bucketStats[b].n };
      })
      .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

    // 7-dagars prognos: använd bucket-medel där vi har data, annars baseline
    const forecast: { date: string; predicted: number; confidence: 'low' | 'medium' | 'high'; buckets: Bucket[] }[] = [];
    if (daily?.time) {
      for (let i = 0; i < Math.min(7, daily.time.length); i++) {
        const buckets = getBuckets(
          daily.temperature_2m_max[i],
          daily.temperature_2m_min[i],
          daily.precipitation_sum[i] ?? 0,
          daily.wind_speed_10m_max[i] ?? 0,
        );
        const factors = buckets
          .map((b) => (bucketStats[b].n >= 3 ? bucketStats[b].sum / bucketStats[b].n / baseline : 1))
          .filter((f) => Number.isFinite(f));
        const factor = factors.length ? factors.reduce((a, b) => a * b, 1) ** (1 / factors.length) : 1;
        const predicted = baseline * factor;
        const minBucketN = Math.min(...buckets.map((b) => bucketStats[b].n));
        const confidence: 'low' | 'medium' | 'high' = matched < 14 ? 'low' : minBucketN >= 5 ? 'high' : 'medium';
        forecast.push({ date: daily.time[i], predicted, confidence, buckets });
      }
    }

    return { matched, days: days.length, baseline, perBucket, forecast };
  }, [data, daily]);

  if (isLoading) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-5">
          <div className="h-32 animate-pulse bg-muted/40 rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  if (!analysis || analysis.days < 7) {
    return (
      <Card className="border-border/60 shadow-sm">
        <CardContent className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <h2 className="font-serif text-lg">Väderpåverkan på dina höns</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Logga ägg i minst 7 dagar så analyserar vi hur vädret påverkar din specifika flock och visar
            en personlig produktionsprognos.
          </p>
        </CardContent>
      </Card>
    );
  }

  const { baseline, perBucket, forecast, matched } = analysis;
  const total7 = forecast.reduce((a, b) => a + b.predicted, 0);
  const baseline7 = baseline * forecast.length;
  const diff7 = total7 - baseline7;
  const pct7 = baseline7 > 0 ? (diff7 / baseline7) * 100 : 0;

  return (
    <Card className="border-border/60 shadow-sm">
      <CardContent className="p-5 space-y-5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h2 className="font-serif text-lg">Väderpåverkan på dina höns</h2>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            Baserat på {matched} dagar med matchande väder
          </Badge>
        </div>

        {/* Sammanfattning */}
        <div className="rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/15 p-4">
          <div className="flex items-start gap-3">
            <Egg className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm leading-relaxed">
                Förväntad äggläggning kommande {forecast.length} dagar:{' '}
                <strong className="font-semibold">{Math.round(total7)} ägg</strong>{' '}
                <span className="text-muted-foreground">
                  ({fmt(total7 / forecast.length)} ägg/dag i snitt)
                </span>
                .{' '}
                {Math.abs(pct7) < 3 ? (
                  <span className="text-muted-foreground">Det är i linje med din baslinje på {fmt(baseline)} ägg/dag.</span>
                ) : pct7 > 0 ? (
                  <span className="text-primary">
                    Det är cirka {fmt(pct7, 0)}% över din normala baslinje – vädret talar för dig.
                  </span>
                ) : (
                  <span className="text-warning-foreground">
                    Det är cirka {fmt(Math.abs(pct7), 0)}% under din baslinje – planera för en lugnare vecka.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Per-dag prognos */}
        {forecast.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-2">
              <TrendingUp className="h-3 w-3" /> Förväntad produktion per dag
            </div>
            <div className="space-y-1.5">
              {forecast.map((f, i) => {
                const dayDiff = f.predicted - baseline;
                const dayPct = baseline > 0 ? (dayDiff / baseline) * 100 : 0;
                const Trend =
                  Math.abs(dayPct) < 5 ? Minus : dayPct > 0 ? TrendingUp : TrendingDown;
                const trendColor =
                  Math.abs(dayPct) < 5
                    ? 'text-muted-foreground'
                    : dayPct > 0
                      ? 'text-primary'
                      : 'text-warning';
                const dayLabel =
                  i === 0
                    ? 'Idag'
                    : i === 1
                      ? 'Imorgon'
                      : new Date(f.date).toLocaleDateString('sv-SE', { weekday: 'short', day: 'numeric' });
                return (
                  <div
                    key={f.date}
                    className="flex items-center gap-3 py-1.5 text-sm border-b border-border/30 last:border-0"
                  >
                    <span className="w-20 text-muted-foreground capitalize shrink-0">{dayLabel}</span>
                    <div className="flex-1 flex items-center gap-1.5 flex-wrap">
                      {f.buckets.map((b) => (
                        <span key={b} className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                          {BUCKET_ICON[b]} {BUCKET_LABEL[b].split(' ')[0]}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                      <Trend className={`h-3.5 w-3.5 ${trendColor}`} />
                      <span className="font-medium">{Math.round(f.predicted)}</span>
                      <span className={`text-xs ${trendColor} w-12 text-right`}>
                        {dayPct > 0 ? '+' : ''}
                        {fmt(dayPct, 0)}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
              <Info className="h-3 w-3" /> Konfidensgrad:{' '}
              {forecast[0]?.confidence === 'high'
                ? 'hög – mycket matchande historik'
                : forecast[0]?.confidence === 'medium'
                  ? 'medel – fortsätt logga för bättre prognos'
                  : 'låg – behöver mer data'}
            </p>
          </div>
        )}

        {/* Vad vädret betytt historiskt */}
        {perBucket.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-2">
              <Thermometer className="h-3 w-3" /> Så har vädret påverkat dig
            </div>
            <div className="space-y-1.5">
              {perBucket.slice(0, 5).map((row) => {
                const Trend =
                  Math.abs(row.pct) < 5 ? Minus : row.pct > 0 ? TrendingUp : TrendingDown;
                const color =
                  Math.abs(row.pct) < 5
                    ? 'text-muted-foreground'
                    : row.pct > 0
                      ? 'text-primary'
                      : 'text-warning';
                return (
                  <div
                    key={row.bucket}
                    className="flex items-center gap-3 py-1.5 text-sm border-b border-border/30 last:border-0"
                  >
                    <span className="flex items-center gap-1.5 flex-1 text-foreground">
                      {BUCKET_ICON[row.bucket as Bucket]}
                      {BUCKET_LABEL[row.bucket as Bucket]}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                      {row.n} dagar
                    </span>
                    <span className="tabular-nums w-14 text-right text-muted-foreground">
                      {fmt(row.avg)} /dag
                    </span>
                    <span className={`tabular-nums w-16 text-right text-xs flex items-center justify-end gap-1 ${color}`}>
                      <Trend className="h-3 w-3" />
                      {row.pct > 0 ? '+' : ''}
                      {fmt(row.pct, 0)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Rekommendationer baserat på prognos */}
        <div>
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground mb-2">
            <Info className="h-3 w-3" /> Förbättringar att göra nu
          </div>
          <ul className="space-y-1.5 text-sm text-foreground">
            {buildRecommendations(forecast, perBucket).map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-[10px] text-muted-foreground">
          Beräkningen jämför dina egna äggloggar mot vädret samma dagar. Ju mer du loggar, desto
          säkrare blir prognosen.
        </p>
      </CardContent>
    </Card>
  );
}

function buildRecommendations(
  forecast: { date: string; predicted: number; buckets: Bucket[] }[],
  perBucket: { bucket: string; pct: number; avg: number; n: number }[],
): string[] {
  const tips: string[] = [];
  const upcoming = new Set<Bucket>();
  forecast.forEach((f) => f.buckets.forEach((b) => upcoming.add(b)));

  if (upcoming.has('hot')) {
    tips.push('Säkerställ skugga och flera vattenkällor – byt vatten oftare och frys in flaskor att lägga i hönsgården.');
  }
  if (upcoming.has('cold')) {
    tips.push('Kolla att vattnet inte fryser, förbered isolering och se till att hönsen har torrt strö i hönshuset.');
  }
  if (upcoming.has('rainy')) {
    tips.push('Stänk ut extra strö och kontrollera att rastgården dräneras – blöt mark ökar risken för parasiter.');
  }
  if (upcoming.has('windy')) {
    tips.push('Säkra lättare föremål i rastgården och kontrollera att hönshusets ventilation inte blir genomdrag.');
  }

  // Lyft fram bucket med störst negativ påverkan om kommande
  const worst = perBucket.find((b) => b.pct < -10 && upcoming.has(b.bucket as Bucket));
  if (worst) {
    tips.push(
      `Vid ${BUCKET_LABEL[worst.bucket as Bucket].toLowerCase()} brukar dina höns lägga ${fmt(Math.abs(worst.pct), 0)}% färre ägg – planera in extra protein och lugn omkring kupan.`,
    );
  }

  if (tips.length === 0) {
    tips.push('Vädret ser stabilt ut – håll bara koll på vatten och foder så fortsätter värphönsen som vanligt.');
  }

  return tips;
}
