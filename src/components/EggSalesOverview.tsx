import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, Minus, Package, ShoppingBasket, TrendingUp, Wallet } from 'lucide-react';

type Booking = {
  id: string;
  listing_id: string;
  packs: number | null;
  status: string | null;
  created_at: string | null;
};

type Listing = {
  id: string;
  price_per_pack: number | null;
};

const RANGE_DAYS = 30;

function startOfDay(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatKr(value: number) {
  return `${Math.round(value).toLocaleString('sv-SE')} kr`;
}

function formatShortDate(d: Date) {
  return d.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Du behöver vara inloggad.');
  return data.user.id;
}

export default function EggSalesOverview() {
  const { data: listings = [] } = useQuery({
    queryKey: ['egg-sales-overview-listings'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .select('id, price_per_pack')
        .eq('user_id', userId);
      if (error) throw error;
      return (data || []) as Listing[];
    },
    refetchInterval: 60_000,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['egg-sales-overview-bookings'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const since = new Date();
      since.setDate(since.getDate() - (RANGE_DAYS * 2)); // hämta 60 dagar för jämförelse
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings')
        .select('id, listing_id, packs, status, created_at')
        .eq('seller_user_id', userId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Booking[];
    },
    refetchInterval: 30_000,
  });

  const priceFor = useMemo(() => {
    const map = new Map<string, number>();
    listings.forEach((l) => map.set(l.id, Number(l.price_per_pack || 0)));
    return (listingId: string) => map.get(listingId) ?? 0;
  }, [listings]);

  const { series, current, previous } = useMemo(() => {
    const today = startOfDay(new Date());
    const days: { date: Date; key: string; label: string }[] = [];
    for (let i = RANGE_DAYS - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({ date: d, key: d.toISOString().slice(0, 10), label: formatShortDate(d) });
    }

    const buckets = new Map<string, { bookings: number; packs: number; value: number }>();
    days.forEach((d) => buckets.set(d.key, { bookings: 0, packs: 0, value: 0 }));

    const periodStart = days[0].date;
    const prevStart = new Date(periodStart);
    prevStart.setDate(prevStart.getDate() - RANGE_DAYS);

    const curr = { bookings: 0, packs: 0, value: 0 };
    const prev = { bookings: 0, packs: 0, value: 0 };

    bookings.forEach((b) => {
      if (!b.created_at || b.status === 'cancelled') return;
      const created = new Date(b.created_at);
      const day = startOfDay(created);
      const value = Number(b.packs || 0) * priceFor(b.listing_id);
      const packs = Number(b.packs || 0);

      if (day >= periodStart) {
        const key = day.toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.bookings += 1;
          bucket.packs += packs;
          bucket.value += value;
        }
        curr.bookings += 1;
        curr.packs += packs;
        curr.value += value;
      } else if (day >= prevStart && day < periodStart) {
        prev.bookings += 1;
        prev.packs += packs;
        prev.value += value;
      }
    });

    const series = days.map((d) => ({
      label: d.label,
      bookings: buckets.get(d.key)?.bookings ?? 0,
      value: buckets.get(d.key)?.value ?? 0,
      packs: buckets.get(d.key)?.packs ?? 0,
    }));

    return { series, current: curr, previous: prev };
  }, [bookings, priceFor]);

  const avgOrder = current.bookings > 0 ? current.value / current.bookings : 0;
  const prevAvg = previous.bookings > 0 ? previous.value / previous.bookings : 0;

  return (
    <Card className="border-primary/25 bg-card shadow-sm">
      <CardContent className="p-4 sm:p-5 space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                <TrendingUp className="h-3 w-3 mr-1" /> Översikt
              </Badge>
              <span className="text-xs text-muted-foreground">Senaste 30 dagarna</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-serif text-foreground">Försäljningstrender</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Följ utvecklingen jämfört med föregående period.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard icon={ShoppingBasket} label="Bokningar" value={current.bookings} prev={previous.bookings} />
          <KpiCard icon={Package} label="Kartor sålda" value={current.packs} prev={previous.packs} />
          <KpiCard icon={Wallet} label="Värde" value={current.value} prev={previous.value} format={formatKr} />
          <KpiCard icon={TrendingUp} label="Snittorder" value={avgOrder} prev={prevAvg} format={formatKr} />
        </div>

        <div className="rounded-2xl border bg-background/60 p-3 pt-4">
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="valueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="bookingsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                />
                <YAxis
                  yAxisId="left"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={48}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  formatter={(value: number, name: string) => {
                    if (name === 'value') return [formatKr(value), 'Värde'];
                    if (name === 'bookings') return [`${value} st`, 'Bokningar'];
                    return [value, name];
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#valueFill)"
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="bookings"
                  stroke="hsl(var(--accent-foreground))"
                  strokeWidth={1.5}
                  fill="url(#bookingsFill)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-4 mt-2 px-1 text-xs text-muted-foreground">
            <LegendDot color="hsl(var(--primary))" label="Värde (kr)" />
            <LegendDot color="hsl(var(--accent-foreground))" label="Bokningar (st)" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  prev,
  format,
}: {
  icon: any;
  label: string;
  value: number;
  prev: number;
  format?: (n: number) => string;
}) {
  const display = format ? format(value) : Math.round(value).toLocaleString('sv-SE');
  const diff = value - prev;
  const pct = prev > 0 ? (diff / prev) * 100 : value > 0 ? 100 : 0;
  const trend: 'up' | 'down' | 'flat' = Math.abs(pct) < 1 ? 'flat' : diff > 0 ? 'up' : 'down';

  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : Minus;
  const trendColor =
    trend === 'up'
      ? 'text-primary bg-primary/10 border-primary/20'
      : trend === 'down'
      ? 'text-destructive bg-destructive/10 border-destructive/20'
      : 'text-muted-foreground bg-muted border-border';

  return (
    <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <Icon className="h-4 w-4 text-primary" />
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${trendColor}`}>
          <TrendIcon className="h-3 w-3" />
          {trend === 'flat' ? '0%' : `${pct > 0 ? '+' : ''}${pct.toFixed(0)}%`}
        </span>
      </div>
      <p className="text-2xl font-bold text-foreground tabular-nums leading-tight">{display}</p>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">
        Föreg: {format ? format(prev) : Math.round(prev).toLocaleString('sv-SE')}
      </p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}
