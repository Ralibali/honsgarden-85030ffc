import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingUp, TrendingDown, Minus, Bird } from 'lucide-react';
import { api } from '@/lib/api';
import { getBreedLayingRate, BreedLayingRate } from '@/data/breedLayingRates';
import { isRooster } from '@/lib/henHelpers';

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(n: number): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

interface HenRow {
  id: string;
  breed?: string | null;
  hen_type?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  death_date?: string | null;
}

interface EggRow {
  date: string;
  count: number | null;
  hen_id?: string | null;
}

/**
 * Antal "höns-dagar" där en höna räknas som värpande (ej tupp) och var
 * vid liv/aktiv någon del av perioden [start, end).
 */
function layingHenDays(hens: HenRow[], start: Date, end: Date): number {
  let total = 0;
  for (const h of hens) {
    if (isRooster(h)) continue;
    const created = h.created_at ? new Date(h.created_at) : new Date(0);
    const died = h.death_date ? new Date(h.death_date) : null;
    // Aktiv-flaggan: om hönan är inaktiv och saknar death_date antar vi
    // att hon togs bort idag (konservativt – räknas hela perioden).
    const aliveStart = created < start ? start : created;
    const aliveEnd = died && died < end ? died : end;
    const days = Math.max(0, Math.floor((aliveEnd.getTime() - aliveStart.getTime()) / DAY_MS));
    total += days;
  }
  return total;
}

function sumEggs(eggs: EggRow[], start: Date, end: Date): number {
  let sum = 0;
  for (const e of eggs) {
    const d = new Date(e.date);
    if (d >= start && d < end) sum += e.count || 0;
  }
  return sum;
}

function rate(eggs: number, henDays: number): number | null {
  if (henDays <= 0) return null;
  return (eggs / henDays) * 100;
}

function trendMeta(diff: number) {
  if (diff > 0.5) return { Icon: TrendingUp, className: 'text-success', label: `+${diff.toFixed(1)} pp` };
  if (diff < -0.5) return { Icon: TrendingDown, className: 'text-destructive', label: `${diff.toFixed(1)} pp` };
  return { Icon: Minus, className: 'text-muted-foreground', label: '±0' };
}

interface BreedSummary {
  breed: string;
  hens: number;
  eggs: number;
  henDays: number;
  rate: number | null;
  benchmark: BreedLayingRate;
}

export default function LayingRateCard() {
  const { data: hens = [] } = useQuery({
    queryKey: ['hens'],
    queryFn: () => api.getHens().catch(() => [] as HenRow[]),
  });

  const { data: eggs = [] } = useQuery({
    queryKey: ['eggs'],
    queryFn: () => api.getEggs().catch(() => [] as EggRow[]),
  });

  const stats = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const end = new Date(now.getTime() + DAY_MS); // inkl. idag
    const start30 = daysAgo(29);
    const start7 = daysAgo(6);
    const startPrev7 = daysAgo(13);

    const henList = hens as HenRow[];
    const eggList = eggs as EggRow[];

    const layingHens = henList.filter((h) => !isRooster(h));
    const has14d = (() => {
      const start14 = daysAgo(13);
      return sumEggs(eggList, start14, end) > 0 &&
        eggList.some((e) => new Date(e.date) < start14);
    })();

    const rate30 = rate(sumEggs(eggList, start30, end), layingHenDays(henList, start30, end));
    const rate7 = rate(sumEggs(eggList, start7, end), layingHenDays(henList, start7, end));
    const ratePrev7 = rate(sumEggs(eggList, startPrev7, start7), layingHenDays(henList, startPrev7, start7));
    const diff = rate7 != null && ratePrev7 != null ? rate7 - ratePrev7 : 0;

    // Per ras: använd ägg med hen_id för att fördela korrekt på de
    // senaste 30 dagarna. Hens utan ras grupperas som "Okänd ras".
    const henById = new Map(henList.map((h) => [h.id, h]));
    const eggsByBreed = new Map<string, number>();
    let attributed = 0;
    for (const e of eggList) {
      if (!e.hen_id) continue;
      const d = new Date(e.date);
      if (d < start30 || d >= end) continue;
      const h = henById.get(e.hen_id);
      if (!h || isRooster(h)) continue;
      const breed = (h.breed || '').trim() || 'Okänd ras';
      eggsByBreed.set(breed, (eggsByBreed.get(breed) || 0) + (e.count || 0));
      attributed += e.count || 0;
    }

    const hensByBreed = new Map<string, HenRow[]>();
    for (const h of layingHens) {
      const breed = (h.breed || '').trim() || 'Okänd ras';
      const arr = hensByBreed.get(breed) || [];
      arr.push(h);
      hensByBreed.set(breed, arr);
    }

    const breeds: BreedSummary[] = Array.from(hensByBreed.entries())
      .map(([breed, list]) => {
        const henDays = layingHenDays(list, start30, end);
        const eggCount = eggsByBreed.get(breed) || 0;
        return {
          breed,
          hens: list.length,
          eggs: eggCount,
          henDays,
          rate: rate(eggCount, henDays),
          benchmark: getBreedLayingRate(breed === 'Okänd ras' ? null : breed),
        };
      })
      .sort((a, b) => b.hens - a.hens);

    const hasAnyBreed = layingHens.some((h) => (h.breed || '').trim().length > 0);

    return {
      rate30,
      rate7,
      ratePrev7,
      diff,
      breeds,
      attributed,
      hasAnyBreed,
      has14d,
      layingHensCount: layingHens.length,
    };
  }, [hens, eggs]);

  const trend = trendMeta(stats.diff);
  const TrendIcon = trend.Icon;

  if (stats.layingHensCount === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="px-4 sm:px-6">
        <CardTitle className="font-serif text-base sm:text-lg">🥚 Värpprocent &amp; rasjämförelse</CardTitle>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 space-y-5">
        {/* Stor siffra + trend */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 rounded-2xl bg-muted/20 border border-border/40 p-4">
          <div>
            <p className="data-label">Värpprocent senaste 30 dagarna</p>
            <p className="stat-number text-4xl sm:text-5xl text-foreground mt-1">
              {stats.rate30 != null ? `${stats.rate30.toFixed(1)}%` : '–'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Beräknas som ägg / (värphöns × dagar).
            </p>
          </div>
          {stats.rate7 != null && stats.ratePrev7 != null && (
            <div className={`flex items-center gap-2 text-sm font-medium ${trend.className}`}>
              <TrendIcon className="h-4 w-4" />
              <span>7d: {stats.rate7.toFixed(1)}% ({trend.label} mot förra veckan)</span>
            </div>
          )}
        </div>

        {!stats.has14d && (
          <p className="text-sm text-muted-foreground italic">
            Värpprocent blir tillförlitlig efter ett par veckors loggning.
          </p>
        )}

        {/* Rasjämförelse */}
        {!stats.hasAnyBreed ? (
          <div className="rounded-2xl border border-dashed border-border bg-muted/15 p-4 text-center space-y-2">
            <Bird className="h-6 w-6 text-muted-foreground mx-auto" />
            <p className="text-sm text-foreground">
              Sätt ras på dina hönor för att jämföra med typiska värpprocent för rasen.
            </p>
            <Button variant="outline" size="sm" onClick={() => window.location.assign('/app/hens')}>
              Gå till hönor
            </Button>
          </div>
        ) : stats.attributed === 0 ? (
          <p className="text-sm text-muted-foreground">
            Koppla ägg till specifika hönor när du loggar för att se rasjämförelse.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="data-label">Per ras – senaste 30 dagarna</p>
            {stats.breeds.filter((b) => b.eggs > 0 || b.rate != null).map((b) => {
              const bm = b.benchmark;
              const r = b.rate;
              const within = r != null && r >= bm.min && r <= bm.max;
              const below = r != null && r < bm.min;
              const above = r != null && r > bm.max;
              const markerColor = within
                ? 'bg-success'
                : above
                  ? 'bg-primary'
                  : 'bg-warning';
              // Bar-skala: 0–100% värpprocent
              const markerPos = r != null ? Math.max(0, Math.min(100, r)) : null;
              const rangeLeft = Math.max(0, Math.min(100, bm.min));
              const rangeWidth = Math.max(2, Math.min(100, bm.max) - rangeLeft);

              let verdict = '';
              if (r == null) {
                verdict = `Inga ägg kopplade till ${b.breed} senaste 30 dagarna.`;
              } else if (within) {
                verdict = `Dina ${b.breed} ligger på ${r.toFixed(0)} % – det är inom typiskt intervall för rasen (${bm.min}–${bm.max} %).`;
              } else if (above) {
                verdict = `Dina ${b.breed} ligger på ${r.toFixed(0)} % – det är i topp för rasen (${bm.min}–${bm.max} %) 🎉`;
              } else if (below) {
                verdict = `Dina ${b.breed} ligger på ${r.toFixed(0)} % – under typiskt (${bm.min}–${bm.max} %). Kolla foder, ljus och eventuell ruggning.`;
              }

              return (
                <div key={b.breed} className="space-y-1.5 rounded-2xl border border-border/40 bg-muted/10 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-foreground truncate">{b.breed}</span>
                      <span className="text-[11px] text-muted-foreground shrink-0">
                        {b.hens} {b.hens === 1 ? 'höna' : 'hönor'}
                      </span>
                    </div>
                    <span className={`stat-number text-sm shrink-0 ${within ? 'text-success' : above ? 'text-primary' : below ? 'text-warning' : 'text-muted-foreground'}`}>
                      {r != null ? `${r.toFixed(1)}%` : '–'}
                    </span>
                  </div>
                  {/* Skala 0–100 % med typiskt intervall + markör */}
                  <div className="relative h-3 w-full rounded-full bg-secondary overflow-hidden">
                    <div
                      className="absolute top-0 h-full bg-primary/15 border-x border-primary/30"
                      style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
                    />
                    {markerPos != null && (
                      <div
                        className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full border-2 border-background ${markerColor}`}
                        style={{ left: `${markerPos}%` }}
                        aria-label={`Din ${b.breed}: ${r?.toFixed(1)}%`}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>Typiskt {bm.min}–{bm.max}%</span>
                    <span>100%</span>
                  </div>
                  <p className="text-xs text-foreground/80 leading-relaxed">{verdict}</p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
