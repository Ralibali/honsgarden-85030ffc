import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Share2, Egg, Bird, Flame, Calendar as CalendarIcon } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

const MONTHS_SV = [
  'januari', 'februari', 'mars', 'april', 'maj', 'juni',
  'juli', 'augusti', 'september', 'oktober', 'november', 'december',
];

/** Längsta streak i kalenderåret (sammanhängande dagar med minst ett ägg). */
function longestStreakInYear(eggsByDate: Record<string, number>, year: number): number {
  const start = new Date(year, 0, 1);
  const end = new Date(year, 11, 31);
  let best = 0;
  let cur = 0;
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = d.toISOString().split('T')[0];
    if ((eggsByDate[key] || 0) > 0) {
      cur++;
      if (cur > best) best = cur;
    } else {
      cur = 0;
    }
  }
  return best;
}

function drawYearCard(
  canvas: HTMLCanvasElement,
  data: {
    year: number;
    totalEggs: number;
    bestMonthLabel: string;
    bestDayLabel: string;
    avgPerHen: number;
    longestStreak: number;
    pancakes: number;
    cakes: number;
    userName?: string;
  },
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const w = 1080;
  const h = 1920;
  canvas.width = w;
  canvas.height = h;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#f5f0e8');
  grad.addColorStop(0.5, '#efe7d6');
  grad.addColorStop(1, '#e3d5b8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  const barGrad = ctx.createLinearGradient(0, 0, w, 0);
  barGrad.addColorStop(0, '#3d7a4a');
  barGrad.addColorStop(1, '#8b6e3b');
  ctx.fillStyle = barGrad;
  ctx.fillRect(0, 0, w, 12);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#3d7a4a';
  ctx.font = 'bold 44px system-ui, -apple-system, sans-serif';
  ctx.fillText('🐔 Hönsgården', w / 2, 130);

  ctx.fillStyle = '#2a2a2a';
  ctx.font = 'bold 96px Georgia, serif';
  ctx.fillText(`Mitt hönsår ${data.year}`, w / 2, 270);

  if (data.userName) {
    ctx.fillStyle = '#8b7a68';
    ctx.font = '32px system-ui, -apple-system, sans-serif';
    ctx.fillText(`— ${data.userName} —`, w / 2, 330);
  }

  const stats: { value: string; label: string }[] = [
    { value: `${data.totalEggs.toLocaleString('sv-SE')}`, label: 'ägg på ett år 🥚' },
    { value: data.bestMonthLabel, label: 'bästa månaden' },
    { value: data.bestDayLabel, label: 'bästa enskilda dagen' },
    { value: `${data.avgPerHen.toFixed(0)}`, label: 'snitt per höna' },
    { value: `${data.longestStreak} dagar`, label: 'längsta streak 🔥' },
  ].filter((s) => s.value && s.value !== '0' && s.value !== '—');

  const y = 470;
  const blockH = 220;
  stats.slice(0, 5).forEach((s, i) => {
    const cy = y + i * blockH;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    const radius = 32;
    const x = 80;
    const ww = w - 160;
    const hh = 180;
    ctx.beginPath();
    ctx.moveTo(x + radius, cy);
    ctx.arcTo(x + ww, cy, x + ww, cy + hh, radius);
    ctx.arcTo(x + ww, cy + hh, x, cy + hh, radius);
    ctx.arcTo(x, cy + hh, x, cy, radius);
    ctx.arcTo(x, cy, x + ww, cy, radius);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#3d7a4a';
    ctx.font = 'bold 96px Georgia, serif';
    ctx.fillText(s.value, w / 2, cy + 100);
    ctx.fillStyle = '#6b5e4d';
    ctx.font = '28px system-ui, -apple-system, sans-serif';
    ctx.fillText(s.label, w / 2, cy + 150);
  });

  const footerY = h - 240;
  ctx.fillStyle = '#3d7a4a';
  ctx.font = 'italic 36px Georgia, serif';
  ctx.fillText(
    `Det räcker till ${data.pancakes.toLocaleString('sv-SE')} pannkaksomgångar`,
    w / 2,
    footerY,
  );
  ctx.fillText(
    `eller ${data.cakes.toLocaleString('sv-SE')} sockerkakor 🍰`,
    w / 2,
    footerY + 50,
  );

  ctx.fillStyle = '#8b7a68';
  ctx.font = '28px system-ui, -apple-system, sans-serif';
  ctx.fillText('Tack för ett fantastiskt hönsår 🐔💛', w / 2, footerY + 130);
  ctx.fillText('honsgarden.se', w / 2, footerY + 175);
}

export default function YearReport() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { data: eggs = [] } = useQuery({ queryKey: ['eggs'], queryFn: () => api.getEggs() });
  const { data: hens = [] } = useQuery({ queryKey: ['hens'], queryFn: () => api.getHens() });
  const { data: feedStats } = useQuery({
    queryKey: ['feed-stats'],
    queryFn: () => api.getFeedStatistics().catch(() => null),
  });

  const stats = useMemo(() => {
    const yearEggs = eggs.filter((e) => e.date >= yearStart && e.date <= yearEnd);
    const totalEggs = yearEggs.reduce((s, e) => s + (e.count || 0), 0);

    const byDate: Record<string, number> = {};
    const byMonth: number[] = Array(12).fill(0);
    for (const e of yearEggs) {
      byDate[e.date] = (byDate[e.date] || 0) + (e.count || 0);
      const m = Number(String(e.date).slice(5, 7)) - 1;
      if (m >= 0 && m < 12) byMonth[m] += e.count || 0;
    }
    const bestMonthIdx = byMonth.indexOf(Math.max(...byMonth));
    const bestMonthCount = byMonth[bestMonthIdx];
    const bestMonthLabel = bestMonthCount > 0 ? MONTHS_SV[bestMonthIdx] : '—';

    const bestDayEntry = Object.entries(byDate).sort((a, b) => b[1] - a[1])[0];
    const bestDayLabel = bestDayEntry
      ? `${format(new Date(bestDayEntry[0]), 'd MMM', { locale: sv })} (${bestDayEntry[1]} st)`
      : '—';

    const activeHens = hens.filter((h) => h.is_active).length || hens.length;
    const avgPerHen = activeHens > 0 ? totalEggs / activeHens : 0;
    const longestStreak = longestStreakInYear(byDate, year);

    const pancakes = Math.floor(totalEggs / 4);
    const cakes = Math.floor(totalEggs / 5);

    return {
      totalEggs,
      bestMonthLabel,
      bestMonthCount,
      bestDayLabel,
      bestDayCount: bestDayEntry ? bestDayEntry[1] : 0,
      avgPerHen,
      longestStreak,
      pancakes,
      cakes,
      activeHens,
      feedCost: feedStats?.total_cost || 0,
      costPerEgg: feedStats?.cost_per_egg || 0,
    };
  }, [eggs, hens, feedStats, year, yearStart, yearEnd]);

  const render = useCallback(() => {
    if (!canvasRef.current) return;
    drawYearCard(canvasRef.current, {
      year,
      totalEggs: stats.totalEggs,
      bestMonthLabel: stats.bestMonthLabel,
      bestDayLabel: stats.bestDayLabel,
      avgPerHen: stats.avgPerHen,
      longestStreak: stats.longestStreak,
      pancakes: stats.pancakes,
      cakes: stats.cakes,
      userName: user?.name,
    });
  }, [stats, year, user]);

  useEffect(() => { render(); }, [render]);

  const handleDownload = () => {
    if (!canvasRef.current) return;
    const a = document.createElement('a');
    a.download = `honsar-${year}.png`;
    a.href = canvasRef.current.toDataURL('image/png');
    a.click();
    toast({ title: 'Bilden är nedladdad 📥' });
  };

  const handleShare = async () => {
    if (!canvasRef.current) return;
    try {
      const blob = await new Promise<Blob>((resolve) =>
        canvasRef.current!.toBlob((b) => resolve(b!), 'image/png'),
      );
      const file = new File([blob], `honsar-${year}.png`, { type: 'image/png' });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: `Mitt hönsår ${year}`,
          text: `Mina höns värpte ${stats.totalEggs} ägg i år! 🥚🐔`,
          files: [file],
        });
      } else {
        handleDownload();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch {
      /* avbruten delning */
    }
  };

  const hasData = stats.totalEggs > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-fade-in pb-8">
      <div>
        <p className="data-label mb-1">Året i sammandrag</p>
        <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Mitt hönsår {year} 🎉</h1>
        <p className="text-sm text-muted-foreground mt-1">
          En delbar sammanfattning av dina höns år. Ladda ned bilden eller dela direkt.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            <Egg className="h-5 w-5 text-primary" />
            <span className="text-xl font-bold">{stats.totalEggs}</span>
            <span className="text-[11px] text-muted-foreground">Ägg i år</span>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            <CalendarIcon className="h-5 w-5 text-primary" />
            <span className="text-base font-bold capitalize">{stats.bestMonthLabel}</span>
            <span className="text-[11px] text-muted-foreground">Bästa månaden</span>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            <Bird className="h-5 w-5 text-primary" />
            <span className="text-xl font-bold">{stats.avgPerHen.toFixed(0)}</span>
            <span className="text-[11px] text-muted-foreground">Snitt/höna</span>
          </CardContent>
        </Card>
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-3 flex flex-col items-center gap-1">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="text-xl font-bold">{stats.longestStreak}d</span>
            <span className="text-[11px] text-muted-foreground">Längsta streak</span>
          </CardContent>
        </Card>
      </div>

      {hasData && (
        <Card className="border-primary/20 shadow-sm">
          <CardContent className="p-4 space-y-2 text-sm">
            <p>🥞 Det räcker till ungefär <strong>{stats.pancakes.toLocaleString('sv-SE')}</strong> pannkaksomgångar (4 ägg/sats).</p>
            <p>🍰 Eller <strong>{stats.cakes.toLocaleString('sv-SE')}</strong> sockerkakor (5 ägg/sats).</p>
            {stats.costPerEgg > 0 && (
              <p>💰 Foderkostnad: cirka <strong>{stats.costPerEgg.toFixed(2)} kr/ägg</strong>.</p>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <Share2 className="h-5 w-5 text-primary" />Dela ditt hönsår
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl overflow-hidden border border-border/30 bg-muted/10">
            <canvas
              ref={canvasRef}
              className="w-full h-auto"
              style={{ maxHeight: '70vh', objectFit: 'contain' }}
            />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1 rounded-xl h-10 gap-2 text-sm" onClick={handleShare}>
              <Share2 className="h-4 w-4" />{copied ? 'Sparad' : 'Dela'}
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-10 gap-2 text-sm"
              onClick={handleDownload}
            >
              <Download className="h-4 w-4" />Ladda ned bild
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
