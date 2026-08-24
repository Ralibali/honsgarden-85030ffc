import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowDownRight, ArrowUpRight, ChevronDown, ChevronUp, Minus, Package, ShoppingBasket, TrendingUp, Wallet } from 'lucide-react';

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
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function formatKr(value: number) {
  return `${Math.round(value).toLocaleString('sv-SE')} kr`;
}

function formatShortDate(date: Date) {
  return date.toLocaleDateString('sv-SE', { day: 'numeric', month: 'short' });
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Du behöver vara inloggad.');
  return data.user.id;
}

function comparisonSentence(current: number, previous: number, noun: string) {
  if (current === 0 && previous === 0) return `Inga ${noun} ännu – här börjar historiken när första bokningen kommer.`;
  if (previous === 0 && current > 0) return `Första ${noun} har börjat komma in. Fin start.`;
  const diff = current - previous;
  if (diff > 0) return `${diff} fler ${noun} än under de 30 dagarna innan.`;
  if (diff < 0) return `${Math.abs(diff)} färre ${noun} än under de 30 dagarna innan.`;
  return `Samma nivå som de 30 dagarna innan.`;
}

export default function EggSalesOverview() {
  const [showChart, setShowChart] = useState(false);

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
      since.setDate(since.getDate() - RANGE_DAYS * 2);
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
    listings.forEach((listing) => map.set(listing.id, Number(listing.price_per_pack || 0)));
    return (listingId: string) => map.get(listingId) ?? 0;
  }, [listings]);

  const { series, current, previous } = useMemo(() => {
    const today = startOfDay(new Date());
    const days: { date: Date; key: string; label: string }[] = [];

    for (let i = RANGE_DAYS - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      days.push({ date, key: date.toISOString().slice(0, 10), label: formatShortDate(date) });
    }

    const buckets = new Map<string, { bookings: number; packs: number; value: number }>();
    days.forEach((day) => buckets.set(day.key, { bookings: 0, packs: 0, value: 0 }));

    const periodStart = days[0].date;
    const previousStart = new Date(periodStart);
    previousStart.setDate(previousStart.getDate() - RANGE_DAYS);

    const currentPeriod = { bookings: 0, packs: 0, value: 0 };
    const previousPeriod = { bookings: 0, packs: 0, value: 0 };

    bookings.forEach((booking) => {
      if (!booking.created_at || booking.status === 'cancelled') return;

      const created = startOfDay(new Date(booking.created_at));
      const packs = Number(booking.packs || 0);
      const value = packs * priceFor(booking.listing_id);

      if (created >= periodStart) {
        const key = created.toISOString().slice(0, 10);
        const bucket = buckets.get(key);
        if (bucket) {
          bucket.bookings += 1;
          bucket.packs += packs;
          bucket.value += value;
        }
        currentPeriod.bookings += 1;
        currentPeriod.packs += packs;
        currentPeriod.value += value;
      } else if (created >= previousStart && created < periodStart) {
        previousPeriod.bookings += 1;
        previousPeriod.packs += packs;
        previousPeriod.value += value;
      }
    });

    return {
      series: days.map((day) => ({
        label: day.label,
        bookings: buckets.get(day.key)?.bookings ?? 0,
        value: buckets.get(day.key)?.value ?? 0,
        packs: buckets.get(day.key)?.packs ?? 0,
      })),
      current: currentPeriod,
      previous: previousPeriod,
    };
  }, [bookings, priceFor]);

  const averageOrder = current.bookings > 0 ? current.value / current.bookings : 0;
  const previousAverage = previous.bookings > 0 ? previous.value / previous.bookings : 0;
  const valueChange = current.value - previous.value;

  return (
    <Card className="egg-shop-story border-primary/20 overflow-hidden">
      <CardContent className="p-5 sm:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="max-w-2xl">
            <p className="data-label">Så går det i Äggboden</p>
            <h1 className="font-serif text-2xl sm:text-3xl text-foreground mt-1">Din lilla äggförsäljning, på ett ställe</h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed mt-2">
              De senaste 30 dagarna har du haft <strong className="text-foreground">{current.bookings} bokningar</strong> och sålt <strong className="text-foreground">{current.packs} kartor</strong> till ett värde av <strong className="text-foreground">{formatKr(current.value)}</strong>.
            </p>
          </div>
          <div className={`egg-shop-change ${valueChange > 0 ? 'is-up' : valueChange < 0 ? 'is-down' : ''}`}>
            {valueChange > 0 ? <ArrowUpRight className="h-4 w-4" /> : valueChange < 0 ? <ArrowDownRight className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            <span>{valueChange === 0 ? 'Stabilt' : `${valueChange > 0 ? '+' : ''}${formatKr(valueChange)}`}</span>
            <small>mot perioden innan</small>
          </div>
        </div>

        <div className="egg-shop-readable-grid grid grid-cols-1 sm:grid-cols-3 gap-3">
          <ReadableStat
            icon={ShoppingBasket}
            value={current.bookings}
            label="bokningar"
            sentence={comparisonSentence(current.bookings, previous.bookings, 'bokningar')}
          />
          <ReadableStat
            icon={Package}
            value={current.packs}
            label="kartor sålda"
            sentence={comparisonSentence(current.packs, previous.packs, 'kartor')}
          />
          <ReadableStat
            icon={Wallet}
            value={formatKr(averageOrder)}
            label="per bokning i snitt"
            sentence={previousAverage > 0 ? `Tidigare låg snittet på ${formatKr(previousAverage)}.` : 'Snittordern växer fram när fler bokningar kommer in.'}
          />
        </div>

        <div className="egg-shop-chart-shell">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setShowChart((value) => !value)}
            className="w-full justify-between h-11 px-1 sm:px-2 hover:bg-transparent"
          >
            <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
              <TrendingUp className="h-4 w-4 text-primary" />
              Försäljningen dag för dag
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              {showChart ? 'Dölj kurvan' : 'Visa kurvan'}
              {showChart ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </span>
          </Button>

          {showChart && (
            <div className="pt-3 border-t border-border/40 animate-fade-in">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="shopValueFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
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
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      tickFormatter={(value) => (value >= 1000 ? `${Math.round(value / 1000)}k` : `${value}`)}
                    />
                    <Tooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: 14,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                      formatter={(value: number) => [formatKr(value), 'Värde']}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#shopValueFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReadableStat({
  icon: Icon,
  value,
  label,
  sentence,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  sentence: string;
}) {
  return (
    <div className="egg-shop-readable-stat">
      <div className="egg-shop-readable-stat__icon"><Icon className="h-4 w-4" /></div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
        <p>{sentence}</p>
      </div>
    </div>
  );
}
