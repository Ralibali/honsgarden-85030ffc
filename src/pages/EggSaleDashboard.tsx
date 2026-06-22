import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import PlusFeatureGate from '@/components/PlusFeatureGate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import BookingStatusActions from '@/components/egg-sales/BookingStatusActions';
import PriceTiersEditor from '@/components/egg-sales/PriceTiersEditor';
import { getOrderTotal, normalizeTiers } from '@/lib/eggSalePricing';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BellRing,
  Calendar,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  PackageCheck,
  Pause,
  Play,
  Plus,
  Repeat,
  Tag,
  Users,
  Wallet,
} from 'lucide-react';

type Row = Record<string, any>;

const STATUS_COLUMNS = [
  { key: 'reserved', label: 'Ny' },
  { key: 'confirmed', label: 'Bekräftad' },
  { key: 'paid', label: 'Betald' },
  { key: 'packed', label: 'Packad' },
  { key: 'picked_up', label: 'Hämtad' },
] as const;

const kr = (value: unknown) => `${Math.round(Number(value || 0))} kr`;
const dt = (value?: string | null) => value ? new Date(value).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' }) : 'Ingen tid vald';

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Inte inloggad');
  return data.user.id;
}

export default function EggSaleDashboardPage() {
  return (
    <PlusFeatureGate
      title="Säljarens kontrollrum"
      description="Hantera bokningar, tider, väntelista och abonnemang."
      featureName="Säljardashboard"
      featureKey="eggsales"
      benefits={['Bokningsflöde', 'Massåtgärder', 'Orderlänkar', 'Väntelista och abonnemang']}
    >
      <Dashboard />
    </PlusFeatureGate>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: listings = [], isLoading } = useQuery<Row[]>({
    queryKey: ['dashboard-listings'],
    queryFn: async () => {
      const userId = await currentUserId();
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!selectedId && listings[0]) setSelectedId(listings[0].id);
  }, [listings, selectedId]);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (!listings.length) return <Card><CardContent className="p-8 text-center"><p className="mb-3">Du har ingen säljsida ännu.</p><Button onClick={() => navigate('/app/egg-sales')}>Skapa säljsida</Button></CardContent></Card>;

  const listing = listings.find((item) => item.id === selectedId) || listings[0];

  return (
    <div className="mx-auto max-w-7xl space-y-4 pb-12">
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate('/app/egg-sales')}><ArrowLeft className="mr-1 h-4 w-4" />Tillbaka</Button>
        <h1 className="font-serif text-3xl">Säljarens kontrollrum</h1>
        <p className="text-sm text-muted-foreground">Från ny bokning till betald och hämtad.</p>
      </div>

      {listings.length > 1 && <Card><CardContent className="flex flex-wrap gap-2 p-3">{listings.map((item) => <Button key={item.id} size="sm" variant={item.id === listing.id ? 'default' : 'outline'} onClick={() => setSelectedId(item.id)}>{item.title || 'Säljsida'}</Button>)}</CardContent></Card>}

      <Tabs defaultValue="bookings">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="bookings"><PackageCheck className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Bokningar</span></TabsTrigger>
          <TabsTrigger value="slots"><Calendar className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Tider</span></TabsTrigger>
          <TabsTrigger value="prices"><Tag className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Priser</span></TabsTrigger>
          <TabsTrigger value="waitlist"><Users className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Väntelista</span></TabsTrigger>
          <TabsTrigger value="subscriptions"><Repeat className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Abonnemang</span></TabsTrigger>
          <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Statistik</span></TabsTrigger>
        </TabsList>
        <TabsContent value="bookings"><BookingsBoard listing={listing} /></TabsContent>
        <TabsContent value="slots"><SlotsPanel listing={listing} /></TabsContent>
        <TabsContent value="prices"><PriceTiersEditor listing={listing as any} /></TabsContent>
        <TabsContent value="waitlist"><WaitlistPanel listing={listing} /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsPanel listing={listing} /></TabsContent>
        <TabsContent value="stats"><StatsPanel listing={listing} /></TabsContent>
      </Tabs>
    </div>
  );
}

function BookingsBoard({ listing }: { listing: Row }) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { data: bookings = [], isLoading } = useQuery<Row[]>({
    queryKey: ['dash-bookings', listing.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings')
        .select('*, egg_sale_pickup_slots(starts_at, ends_at, label), egg_sale_booking_tokens(token)')
        .eq('listing_id', listing.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const update = useMutation({
    mutationFn: async ({ ids, status, paymentStatus }: { ids: string[]; status: string; paymentStatus?: string }) => {
      const now = new Date().toISOString();
      for (const id of ids) {
        const patch: Row = { status, updated_at: now };
        const stamp: Row = { confirmed: 'confirmed_at', paid: 'paid_at', packed: 'packed_at', picked_up: 'picked_up_at', cancelled: 'cancelled_at', no_show: 'no_show_at', refunded: 'refunded_at' };
        if (stamp[status]) patch[stamp[status]] = now;
        if (paymentStatus) patch.payment_status = paymentStatus;
        const { error } = await (supabase as any).from('public_egg_sale_bookings').update(patch).eq('id', id).eq('listing_id', listing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ['dash-bookings', listing.id] });
      toast({ title: 'Bokningarna är uppdaterade' });
    },
    onError: (error: Error) => toast({ title: 'Kunde inte uppdatera', description: error.message, variant: 'destructive' }),
  });

  const groups = useMemo(() => {
    const result: Row = Object.fromEntries(STATUS_COLUMNS.map((column) => [column.key, []]));
    for (const booking of bookings) {
      let key = booking.status || 'reserved';
      if (booking.payment_status === 'paid' && ['reserved', 'confirmed'].includes(key)) key = 'paid';
      if (result[key]) result[key].push(booking);
    }
    return result;
  }, [bookings]);

  const selectedIds = Array.from(selected);
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); next.has(id) ? next.delete(id) : next.add(id); return next; });

  const unpaidPickups = useMemo(() => (bookings as Row[]).filter((b) =>
    b.picked_up_at && b.payment_status !== 'paid' && !b.cancelled_at
  ).sort((a, b) => new Date(a.picked_up_at).getTime() - new Date(b.picked_up_at).getTime()), [bookings]);

  const sendReminder = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.functions.invoke('send-payment-reminder', { body: { booking_id: bookingId } });
      if (error) throw error;
      if (data && data.ok === false) throw new Error(data.reason || 'Påminnelsen kunde inte skickas.');
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['dash-bookings', listing.id] });
      toast({ title: 'Påminnelse skickad', description: 'Kunden får ett mejl inom kort.' });
    },
    onError: (err: Error) => toast({ title: 'Kunde inte skicka påminnelse', description: err.message, variant: 'destructive' }),
  });

  if (isLoading) return <Card><CardContent className="p-6">Laddar bokningar…</CardContent></Card>;

  return <div className="space-y-3">
    {selectedIds.length > 0 && <Card><CardContent className="flex flex-wrap items-center gap-2 p-3"><Badge>{selectedIds.length} valda</Badge><Button size="sm" variant="outline" onClick={() => update.mutate({ ids: selectedIds, status: 'packed' })}>Markera packade</Button><Button size="sm" onClick={() => update.mutate({ ids: selectedIds, status: 'picked_up' })}>Markera hämtade</Button></CardContent></Card>}
    {unpaidPickups.length > 0 && (
      <Card className="border-warning/40 bg-warning/5">
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <h3 className="font-serif text-base">Hämtat – väntar på betalning</h3>
            <Badge variant="secondary">{unpaidPickups.length}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">Påminnelser går ut automatiskt 2 dagar efter hämtning och sedan varannan dag (max 4 ggr). Du kan också skicka manuellt.</p>
          <div className="space-y-2">
            {unpaidPickups.map((b) => {
              const amount = getOrderTotal(Number(b.packs || 0), normalizeTiers(listing.price_tiers), Number(listing.price_per_pack || 0));
              const reminders = Number(b.payment_reminder_count || 0);
              const lastSent = b.payment_reminder_last_sent_at;
              const token = b.egg_sale_booking_tokens?.token;
              const url = token ? `${window.location.origin}/bestallning/${token}` : null;
              return (
                <div key={b.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{b.customer_name} <span className="text-muted-foreground font-normal">· {b.packs} kartor · {kr(amount)}</span></p>
                    <p className="text-xs text-muted-foreground">
                      Hämtad {dt(b.picked_up_at)}
                      {b.customer_email ? <> · <span>{b.customer_email}</span></> : <> · <span className="text-destructive">Ingen e-post</span></>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {reminders === 0 ? 'Ingen påminnelse skickad än.' : `${reminders} påminnelse${reminders > 1 ? 'r' : ''} skickad${reminders > 1 ? 'a' : ''}${lastSent ? ` · senast ${dt(lastSent)}` : ''}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!b.customer_email || sendReminder.isPending}
                      onClick={() => sendReminder.mutate(b.id)}
                    >
                      <BellRing className="mr-1 h-3.5 w-3.5" />Skicka påminnelse
                    </Button>
                    <Button
                      size="sm"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ ids: [b.id], status: 'picked_up', paymentStatus: 'paid' })}
                    >
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Markera som betald
                    </Button>
                    {url && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a href={url} target="_blank" rel="noreferrer" aria-label="Öppna orderlänk"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                    {b.customer_email && (
                      <Button size="icon" variant="ghost" className="h-8 w-8" asChild>
                        <a href={`mailto:${b.customer_email}`} aria-label="Mejla kunden"><Mail className="h-3.5 w-3.5" /></a>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    )}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {STATUS_COLUMNS.map((column) => <section key={column.key} className="min-h-40 rounded-2xl border bg-muted/20 p-2.5"><div className="mb-2 flex items-center justify-between"><h3 className="font-serif">{column.label}</h3><Badge variant="secondary">{groups[column.key].length}</Badge></div><div className="space-y-2">{groups[column.key].map((booking: Row) => {
        const token = booking.egg_sale_booking_tokens?.token;
        const url = token ? `${window.location.origin}/bestallning/${token}` : null;
        return <Card key={booking.id}><CardContent className="space-y-2 p-3"><div className="flex gap-2"><Checkbox checked={selected.has(booking.id)} onCheckedChange={() => toggle(booking.id)} /><div className="min-w-0"><p className="truncate text-sm font-medium">{booking.customer_name}</p><p className="text-xs text-muted-foreground">{booking.packs} kartor · {kr(getOrderTotal(Number(booking.packs || 0), normalizeTiers(listing.price_tiers), Number(listing.price_per_pack || 0)))}</p><p className="text-xs text-muted-foreground">{dt(booking.egg_sale_pickup_slots?.starts_at)}</p></div></div>{booking.customer_message && <p className="line-clamp-2 text-xs italic text-muted-foreground">”{booking.customer_message}”</p>}<BookingStatusActions bookingId={booking.id} status={column.key} busy={update.isPending} onChange={(id, status, paymentStatus) => update.mutate({ ids: [id], status, paymentStatus })} />{url && <div className="flex gap-1"><Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => navigator.clipboard.writeText(url).then(() => toast({ title: 'Orderlänken är kopierad' }))}><Copy className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="h-7 w-7" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a></Button></div>}</CardContent></Card>;
      })}</div></section>)}
    </div>
  </div>;
}

function SlotsPanel({ listing }: { listing: Row }) {
  const qc = useQueryClient();
  const [date, setDate] = useState('');
  const [from, setFrom] = useState('09:00');
  const [to, setTo] = useState('12:00');
  const [max, setMax] = useState('5');
  const { data: slots = [] } = useQuery<Row[]>({ queryKey: ['dash-slots', listing.id], queryFn: async () => { const { data, error } = await (supabase as any).from('egg_sale_pickup_slots').select('*').eq('listing_id', listing.id).order('starts_at'); if (error) throw error; return data || []; } });
  const create = useMutation({ mutationFn: async () => { const userId = await currentUserId(); const { error } = await (supabase as any).from('egg_sale_pickup_slots').insert({ listing_id: listing.id, seller_user_id: userId, starts_at: new Date(`${date}T${from}`).toISOString(), ends_at: new Date(`${date}T${to}`).toISOString(), max_bookings: Math.max(1, Number(max)) }); if (error) throw error; }, onSuccess: () => { qc.invalidateQueries({ queryKey: ['dash-slots', listing.id] }); toast({ title: 'Tiden är skapad' }); } });
  return <div className="space-y-3"><Card><CardContent className="grid gap-2 p-4 sm:grid-cols-4"><div><Label>Datum</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div><Label>Från</Label><Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} /></div><div><Label>Till</Label><Input type="time" value={to} onChange={(e) => setTo(e.target.value)} /></div><div><Label>Max bokningar</Label><Input type="number" min="1" value={max} onChange={(e) => setMax(e.target.value)} /></div><Button className="sm:col-span-4" disabled={!date || create.isPending} onClick={() => create.mutate()}><Plus className="mr-1 h-4 w-4" />Skapa tid</Button></CardContent></Card>{slots.map((slot) => <Card key={slot.id}><CardContent className="flex justify-between p-3"><span><Clock className="mr-1 inline h-4 w-4" />{dt(slot.starts_at)} · {slot.current_bookings}/{slot.max_bookings}</span><Badge variant={slot.current_bookings >= slot.max_bookings ? 'destructive' : 'secondary'}>{slot.current_bookings >= slot.max_bookings ? 'Full' : 'Ledig'}</Badge></CardContent></Card>)}</div>;
}

function WaitlistPanel({ listing }: { listing: Row }) {
  const qc = useQueryClient();
  const { data: entries = [], error: entriesError } = useQuery<Row[]>({ queryKey: ['dash-waitlist', listing.id], queryFn: async () => { const { data, error } = await (supabase as any).from('egg_sale_waitlist').select('*').eq('listing_id', listing.id).order('created_at'); if (error) throw error; return data || []; } });
  const offer = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('create_next_waitlist_offer', { p_listing_id: listing.id, p_packs: 1 });
      if (error) throw error;
      if (data && data.ok === false) {
        if (data.reason === 'empty') throw new Error('Det finns ingen i kö att erbjuda just nu.');
        throw new Error(data.reason || 'Erbjudandet kunde inte skapas.');
      }
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dash-waitlist', listing.id] }); toast({ title: 'Erbjudandet är skapat', description: 'Det gäller i 45 minuter.' }); },
    onError: (error: Error) => toast({ title: 'Kunde inte skapa erbjudande', description: error.message, variant: 'destructive' })
  });
  const hasWaiting = entries.some((entry) => !entry.status || entry.status === 'waiting');
  return <div className="space-y-3">{entriesError && <Card><CardContent className="p-4 text-sm text-destructive">Kunde inte ladda väntelistan. Försök igen om en stund.</CardContent></Card>}<Button onClick={() => offer.mutate()} disabled={offer.isPending || !hasWaiting}>{offer.isPending ? 'Skapar erbjudande…' : 'Erbjud nästa person ägg'}</Button>{entries.length === 0 ? <Card><CardContent className="p-6 text-center text-muted-foreground">Väntelistan är tom.</CardContent></Card> : entries.map((entry, index) => <Card key={entry.id}><CardContent className="flex items-start justify-between gap-3 p-4"><div><p className="font-medium">{index + 1}. {entry.customer_name ?? 'Okänd'}</p><p className="text-xs text-muted-foreground">{entry.packs_wanted ?? 0} kartor · {entry.customer_email || entry.customer_phone || 'Ingen kontaktuppgift'}</p>{entry.offer_expires_at && <p className="text-xs text-amber-700">Erbjudande till {dt(entry.offer_expires_at)}</p>}</div><Badge variant="outline">{entry.status || 'waiting'}</Badge></CardContent></Card>)}</div>;
}

function SubscriptionsPanel({ listing }: { listing: Row }) {
  const qc = useQueryClient();
  const { data: subscriptions = [], error: subsError } = useQuery<Row[]>({ queryKey: ['dash-subs', listing.id], queryFn: async () => { const { data, error } = await (supabase as any).from('egg_sale_subscriptions').select('*').eq('listing_id', listing.id).order('created_at', { ascending: false }); if (error) throw error; return data || []; } });
  const action = useMutation({
    mutationFn: async ({ id, kind }: { id: string; kind: 'pause' | 'resume' | 'cancel' | 'skip' }) => {
      if (kind === 'pause') {
        const { error } = await (supabase as any).rpc('pause_egg_subscription', { p_subscription_id: id, p_paused_until: null });
        if (error) throw error;
      } else if (kind === 'resume') {
        const { error } = await (supabase as any).rpc('resume_egg_subscription', { p_subscription_id: id });
        if (error) throw error;
      } else if (kind === 'cancel') {
        const { error } = await (supabase as any).rpc('cancel_egg_subscription', { p_subscription_id: id, p_reason: null });
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from('egg_sale_subscriptions').update({ skip_next: true, updated_at: new Date().toISOString() }).eq('id', id).eq('listing_id', listing.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dash-subs', listing.id] }),
    onError: (error: Error) => toast({ title: 'Kunde inte uppdatera abonnemanget', description: error.message, variant: 'destructive' })
  });
  return <div className="space-y-2">{subsError && <Card><CardContent className="p-4 text-sm text-destructive">Kunde inte ladda abonnemangen. Försök igen om en stund.</CardContent></Card>}{subscriptions.length === 0 ? <Card><CardContent className="p-6 text-center text-muted-foreground">Inga abonnemang ännu.</CardContent></Card> : subscriptions.map((subscription) => <Card key={subscription.id}><CardContent className="space-y-2 p-4"><div className="flex justify-between gap-2"><div><p className="font-medium">{subscription.customer_name ?? 'Okänd'}</p><p className="text-xs text-muted-foreground">{subscription.packs ?? 0} kartor · {subscription.frequency ?? '—'} · nästa {subscription.next_run_at ? dt(subscription.next_run_at) : '—'}</p>{subscription.skip_next && <p className="text-xs text-amber-700">Hoppar över nästa</p>}</div><Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>{subscription.status ?? 'okänd'}</Badge></div><div className="flex flex-wrap gap-2">{subscription.status === 'active' ? <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => action.mutate({ id: subscription.id, kind: 'pause' })}><Pause className="mr-1 h-3.5 w-3.5" />Pausa</Button> : subscription.status !== 'cancelled' && <Button size="sm" disabled={action.isPending} onClick={() => action.mutate({ id: subscription.id, kind: 'resume' })}><Play className="mr-1 h-3.5 w-3.5" />Aktivera</Button>}{subscription.status !== 'cancelled' && <><Button size="sm" variant="outline" disabled={action.isPending || !!subscription.skip_next} onClick={() => action.mutate({ id: subscription.id, kind: 'skip' })}>Hoppa över nästa</Button><Button size="sm" variant="ghost" disabled={action.isPending} onClick={() => action.mutate({ id: subscription.id, kind: 'cancel' })}>Avsluta</Button></>}</div></CardContent></Card>)}</div>;
}

function StatsPanel({ listing }: { listing: Row }) {
  const { data: bookings = [] } = useQuery<Row[]>({ queryKey: ['dash-stats-bookings', listing.id], queryFn: async () => { const { data } = await (supabase as any).from('public_egg_sale_bookings').select('status,payment_status,packs,created_at').eq('listing_id', listing.id); return data || []; } });
  const active = bookings.filter((booking) => !['cancelled', 'refunded'].includes(booking.status));
  const tiers = normalizeTiers(listing.price_tiers);
  const fallback = Number(listing.price_per_pack || 0);
  const revenue = active.filter((booking) => booking.payment_status === 'paid').reduce((sum, booking) => sum + getOrderTotal(Number(booking.packs || 0), tiers, fallback), 0);
  const eggs = active.filter((booking) => booking.status === 'picked_up').reduce((sum, booking) => sum + Number(booking.packs || 0) * Number(listing.eggs_per_pack || 0), 0);
  return <div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Bokningar</p><p className="font-serif text-3xl">{bookings.length}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Betald omsättning</p><p className="font-serif text-3xl">{kr(revenue)}</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Hämtade ägg</p><p className="font-serif text-3xl">{eggs}</p></CardContent></Card></div>;
}
