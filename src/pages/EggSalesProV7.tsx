import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { BarChart3, Copy, Crown, PackageCheck, Repeat, ShoppingBasket, Sparkles, TrendingUp, Users, Wallet } from 'lucide-react';
import EggSalesProV6 from './EggSalesProV6';

type Booking = any;
type Listing = any;

function kr(value: unknown) {
  return `${Math.round(Number(value || 0))} kr`;
}

function copyText(text: string, label = 'Texten') {
  navigator.clipboard?.writeText(text);
  toast({ title: `${label} är kopierad` });
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Du behöver vara inloggad.');
  return data.user.id;
}

function startOfWeek() {
  const date = new Date();
  const day = date.getDay() || 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - day + 1);
  return date;
}

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

export default function EggSalesProV7() {
  useEffect(() => {
    document.title = 'Agdas Bod | Hönsgården';
  }, []);

  const { data: listings = [] } = useQuery({
    queryKey: ['agda-pro-listings'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60_000,
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ['agda-pro-bookings'],
    queryFn: async () => {
      const userId = await getCurrentUserId();
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings')
        .select('*')
        .eq('seller_user_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const listingById = useMemo(() => {
    const map: Record<string, Listing> = {};
    (listings as Listing[]).forEach((l) => { map[l.id] = l; });
    return map;
  }, [listings]);

  const activeBookings = useMemo(() => (bookings as Booking[]).filter((b) => b.status !== 'cancelled'), [bookings]);
  const paidBookings = useMemo(() => activeBookings.filter((b) => b.status === 'paid' || b.status === 'picked_up'), [activeBookings]);
  const pickedUpBookings = useMemo(() => activeBookings.filter((b) => b.status === 'picked_up'), [activeBookings]);

  const amountFor = (rows: Booking[]) => rows.reduce((sum, b) => {
    const listing = listingById[b.listing_id];
    return sum + Number(b.packs || 0) * Number(listing?.price_per_pack || 0);
  }, 0);

  const weekStart = startOfWeek();
  const monthStart = startOfMonth();
  const weekBookings = activeBookings.filter((b) => b.created_at && new Date(b.created_at) >= weekStart);
  const monthBookings = activeBookings.filter((b) => b.created_at && new Date(b.created_at) >= monthStart);

  const customerStats = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; packs: number; amount: number }>();
    activeBookings.forEach((b) => {
      const name = String(b.customer_name || '').trim();
      const phone = String(b.customer_phone || '').replace(/\s+/g, '');
      const key = phone || name.toLowerCase();
      if (!key) return;
      const listing = listingById[b.listing_id];
      const amount = Number(b.packs || 0) * Number(listing?.price_per_pack || 0);
      const row = map.get(key) || { name: name || 'Kund', orders: 0, packs: 0, amount: 0 };
      row.orders += 1;
      row.packs += Number(b.packs || 0);
      row.amount += amount;
      map.set(key, row);
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders || b.amount - a.amount);
  }, [activeBookings, listingById]);

  const regularCustomers = customerStats.filter((c) => c.orders >= 2 || c.packs >= 3);
  const conversionRate = activeBookings.length > 0 ? Math.round((pickedUpBookings.length / activeBookings.length) * 100) : 0;
  const avgOrder = activeBookings.length > 0 ? amountFor(activeBookings) / activeBookings.length : 0;
  const activeListings = (listings as Listing[]).filter((l) => l.is_active !== false && !l.sold_out_manually).length;

  const weeklyReport = `Agdas veckorapport\n\nBokningar denna vecka: ${weekBookings.length}\nKartor denna vecka: ${weekBookings.reduce((s, b) => s + Number(b.packs || 0), 0)}\nVärde denna vecka: ${kr(amountFor(weekBookings))}\nMånadens värde: ${kr(amountFor(monthBookings))}\nÅterkommande kunder: ${regularCustomers.length}\nAktiva säljsidor: ${activeListings}\nBekräftat värde totalt: ${kr(amountFor(paidBookings))}`;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8">
      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-primary text-primary-foreground">Agda Pro</Badge>
                <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Försäljningscenter</Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Mer SaaS. Mer koll. Mindre Excel.</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Agda samlar nu säljsidor, bokningar, kunder, återköp och rapporter på samma plats.
              </p>
            </div>
            <Button variant="outline" className="rounded-xl gap-2" onClick={() => copyText(weeklyReport, 'Veckorapporten')}>
              <Copy className="h-4 w-4" /> Kopiera veckorapport
            </Button>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={ShoppingBasket} label="Denna vecka" value={weekBookings.length} sub={`${weekBookings.reduce((s, b) => s + Number(b.packs || 0), 0)} kartor · ${kr(amountFor(weekBookings))}`} />
            <KpiCard icon={Wallet} label="Månadens värde" value={kr(amountFor(monthBookings))} sub={`${monthBookings.length} bokningar`} />
            <KpiCard icon={Repeat} label="Återkommande kunder" value={regularCustomers.length} sub={`${customerStats.length} kunder totalt`} />
            <KpiCard icon={PackageCheck} label="Slutförande" value={`${conversionRate}%`} sub={`Snittorder ${kr(avgOrder)}`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <Card className="xl:col-span-2 border-border/60 bg-background/70 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Kundöversikt</h2>
                    <p className="text-xs text-muted-foreground">Bygg återkommande försäljning av kunderna som redan bokar.</p>
                  </div>
                  <Badge variant="secondary">{customerStats.length} kunder</Badge>
                </div>

                {customerStats.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-center">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="font-medium">Inga kunder ännu</p>
                    <p className="text-sm text-muted-foreground mt-1">När någon bokar via en säljsida byggs översikten automatiskt.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customerStats.slice(0, 4).map((customer) => (
                      <div key={customer.name} className="rounded-2xl border bg-card p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-sm truncate">{customer.name}</p>
                            <p className="text-xs text-muted-foreground">{customer.orders} köp · {customer.packs} kartor</p>
                          </div>
                          {customer.orders >= 2 || customer.packs >= 3 ? <Badge className="bg-warning/15 text-warning border-warning/20"><Crown className="h-3 w-3 mr-1" /> Stammis</Badge> : <Badge variant="secondary">Ny</Badge>}
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <MiniStat label="Köp" value={customer.orders} />
                          <MiniStat label="Kartor" value={customer.packs} />
                          <MiniStat label="Värde" value={kr(customer.amount)} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-background/70 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <h2 className="font-serif text-lg text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> SaaS-insikter</h2>
                <Insight icon={TrendingUp} title="Veckotakt" text={weekBookings.length > 0 ? `Denna vecka ligger på ${kr(amountFor(weekBookings))}. Följ takten och jämför vecka för vecka.` : 'När bokningar kommer in får du veckotakt och värde här.'} />
                <Insight icon={BarChart3} title="Kundbas" text={regularCustomers.length > 0 ? `Du har ${regularCustomers.length} återkommande kunder. Det är början på en riktig kundbas.` : 'Återkommande kunder markeras automatiskt när de bokar flera gånger.'} />
                <Insight icon={Sparkles} title="Nästa nivå" text="Nästa steg blir smarta utskick, kundnoteringar och återkommande beställningar." />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      <EggSalesProV6 />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string | number; sub: string }) {
  return (
    <div className="rounded-2xl border bg-card/80 p-4 shadow-sm">
      <Icon className="h-4 w-4 text-primary mb-2" />
      <p className="text-2xl font-bold text-foreground tabular-nums">{value}</p>
      <p className="data-label text-[10px] mt-1">{label}</p>
      <p className="text-xs text-muted-foreground mt-1">{sub}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-muted/30 border p-2.5">
      <p className="font-bold text-foreground tabular-nums truncate">{value}</p>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function Insight({ icon: Icon, title, text }: { icon: any; title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3 flex gap-3">
      <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <div>
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{text}</p>
      </div>
    </div>
  );
}
