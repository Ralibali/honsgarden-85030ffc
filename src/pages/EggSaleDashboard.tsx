import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import PlusFeatureGate from '@/components/PlusFeatureGate';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BarChart3, BookmarkPlus, Calendar, CheckCircle2, Clock, FileText, Loader2, PackageCheck, Pause, Play, Plus, Repeat, Trash2, Wallet, Users } from 'lucide-react';

type Listing = any;
type Booking = any;
type Slot = any;
type Template = any;

const kr = (n: any) => `${Math.round(Number(n || 0))} kr`;
const dt = (s: string) => new Date(s).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' });

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Inte inloggad');
  return data.user.id;
}

export default function EggSaleDashboardPage() {
  return (
    <PlusFeatureGate
      title="Säljarens kontrollrum"
      description="Hantera tidsluckor, bokningar, betalningar och mallar för dina äggförsäljningar."
      featureName="Säljardashboard"
      featureKey="eggsales"
      benefits={['Tidsluckor för avhämtning', 'Markera betald/hämtad', 'Sparade mallar för återkommande försäljning', 'Väntelista och recensioner']}
    >
      <Dashboard />
    </PlusFeatureGate>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: listings = [], isLoading } = useQuery<Listing[]>({
    queryKey: ['dashboard-listings'],
    queryFn: async () => {
      const u = await uid();
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_listings').select('*').eq('user_id', u).order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!selectedId && listings.length > 0) setSelectedId(listings[0].id);
  }, [listings, selectedId]);

  const current = listings.find((l) => l.id === selectedId) || null;

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  if (listings.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-10">
        <Card><CardContent className="p-6 text-center space-y-3">
          <FileText className="h-10 w-10 mx-auto text-muted-foreground" />
          <h1 className="font-serif text-2xl">Inga säljsidor ännu</h1>
          <p className="text-sm text-muted-foreground">Skapa en säljsida i Agdas bod först.</p>
          <Button onClick={() => navigate('/app/egg-sales')}>Till Agdas bod</Button>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto pb-12 space-y-4">
      <div>
        <Button variant="ghost" size="sm" className="gap-1 mb-1" onClick={() => navigate('/app/egg-sales')}><ArrowLeft className="h-4 w-4" /> Tillbaka</Button>
        <h1 className="font-serif text-3xl">Säljarens kontrollrum</h1>
        <p className="text-sm text-muted-foreground">Hantera bokningar, tidsluckor, betalningar och mallar.</p>
      </div>

      {listings.length > 1 && (
        <Card><CardContent className="p-3 flex flex-wrap gap-2">
          {listings.map((l) => (
            <Button key={l.id} size="sm" variant={l.id === selectedId ? 'default' : 'outline'} onClick={() => setSelectedId(l.id)}>{l.title || 'Säljsida'}</Button>
          ))}
        </CardContent></Card>
      )}

      {current && (
        <Tabs defaultValue="bookings" className="space-y-3">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="bookings"><PackageCheck className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Bokningar</span></TabsTrigger>
            <TabsTrigger value="slots"><Calendar className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Tider</span></TabsTrigger>
            <TabsTrigger value="waitlist"><Users className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Väntelista</span></TabsTrigger>
            <TabsTrigger value="subs"><Repeat className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Abonnemang</span></TabsTrigger>
            <TabsTrigger value="stats"><BarChart3 className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Statistik</span></TabsTrigger>
            <TabsTrigger value="templates"><BookmarkPlus className="h-4 w-4 sm:mr-1.5" /><span className="hidden sm:inline">Mallar</span></TabsTrigger>
          </TabsList>

          <TabsContent value="bookings"><BookingsTab listing={current} /></TabsContent>
          <TabsContent value="slots"><SlotsTab listing={current} /></TabsContent>
          <TabsContent value="waitlist"><WaitlistTab listing={current} /></TabsContent>
          <TabsContent value="subs"><SubscriptionsTab listing={current} /></TabsContent>
          <TabsContent value="stats"><StatsTab listing={current} /></TabsContent>
          <TabsContent value="templates"><TemplatesTab listing={current} onApply={() => qc.invalidateQueries({ queryKey: ['dashboard-listings'] })} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function BookingsTab({ listing }: { listing: Listing }) {
  const qc = useQueryClient();
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['dash-bookings', listing.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings').select('*').eq('listing_id', listing.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const updateBooking = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase as any).from('public_egg_sale_bookings').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Uppdaterat' });
      qc.invalidateQueries({ queryKey: ['dash-bookings', listing.id] });
    },
    onError: (e: any) => toast({ title: 'Kunde inte uppdatera', description: e.message, variant: 'destructive' }),
  });

  if (bookings.length === 0) {
    return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Inga bokningar ännu.</CardContent></Card>;
  }

  const pricePerPack = Number(listing.price_per_pack || 0);
  const active = bookings.filter((b) => b.status !== 'cancelled');
  const totalAmount = active.reduce((s, b) => s + Number(b.packs || 0) * pricePerPack, 0);
  const paidAmount = active
    .filter((b) => b.payment_status === 'paid')
    .reduce((s, b) => s + Number(b.packs || 0) * pricePerPack, 0);
  const refundedAmount = active
    .filter((b) => b.payment_status === 'refunded')
    .reduce((s, b) => s + Number(b.packs || 0) * pricePerPack, 0);
  const unpaidAmount = Math.max(0, totalAmount - paidAmount - refundedAmount);

  return (
    <div className="space-y-2">
      <Card className="bg-muted/30">
        <CardContent className="p-3 sm:p-4 grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Totalt bokat</p>
            <p className="font-serif text-base sm:text-lg">{kr(totalAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Betalt</p>
            <p className="font-serif text-base sm:text-lg text-green-700">{kr(paidAmount)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Obetalt</p>
            <p className="font-serif text-base sm:text-lg text-amber-700">{kr(unpaidAmount)}</p>
          </div>
        </CardContent>
      </Card>
      {bookings.map((b) => {
        const amount = Number(b.packs || 0) * pricePerPack;
        const isPaid = b.payment_status === 'paid';
        const isRefunded = b.payment_status === 'refunded';
        const isCancelled = b.status === 'cancelled';
        const isPickedUp = b.status === 'picked_up';
        const payLabel = isRefunded ? 'Återbetald' : isPaid ? 'Betald' : 'Obetald';
        const payClass = isRefunded
          ? 'bg-muted text-muted-foreground'
          : isPaid
          ? 'bg-green-600 text-white border-transparent'
          : 'border-amber-400 text-amber-700 bg-amber-50';
        return (
          <Card key={b.id} className={isCancelled ? 'opacity-60' : ''}>
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium">{b.customer_name} <span className="text-xs text-muted-foreground">· {b.packs} kartor · {kr(amount)}</span></p>
                  <p className="text-xs text-muted-foreground">{b.customer_phone || '–'} · {b.customer_email || '–'}</p>
                  <p className="text-xs text-muted-foreground">{dt(b.created_at)}</p>
                  {(b.pickup_person_name || b.pickup_person_phone) && (
                    <p className="text-xs text-amber-700 mt-1">📦 Hämtas av: {b.pickup_person_name || '?'} {b.pickup_person_phone && `(${b.pickup_person_phone})`}</p>
                  )}
                  {b.customer_message && <p className="text-xs italic text-muted-foreground mt-1">"{b.customer_message}"</p>}
                </div>
                <div className="flex gap-1 flex-wrap">
                  <Badge variant={isCancelled ? 'destructive' : isPickedUp ? 'default' : 'secondary'}>{b.status}</Badge>
                  <Badge variant="outline" className={payClass}>
                    <Wallet className="h-3 w-3 mr-1" />{payLabel}
                  </Badge>
                </div>
              </div>

              {!isCancelled && (
                <div className="flex gap-1.5 flex-wrap pt-1">
                  <Button size="sm" variant={isPaid ? 'outline' : 'default'} className="h-7 text-xs"
                    onClick={() => updateBooking.mutate({ id: b.id, patch: { payment_status: isPaid ? 'unpaid' : 'paid' } })}>
                    <Wallet className="h-3 w-3 mr-1" />{isPaid ? 'Markera obetald' : 'Markera betald'}
                  </Button>
                  {!isPickedUp && (
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => updateBooking.mutate({ id: b.id, patch: { status: 'picked_up' } })}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />Markera hämtad
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="h-7 text-xs text-destructive"
                    onClick={() => { if (confirm('Avboka denna bokning?')) updateBooking.mutate({ id: b.id, patch: { status: 'cancelled' } }); }}>
                    Avboka
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function SlotsTab({ listing }: { listing: Listing }) {
  const qc = useQueryClient();
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('12:00');
  const [maxBookings, setMaxBookings] = useState('5');
  const [label, setLabel] = useState('');

  const { data: slots = [] } = useQuery<Slot[]>({
    queryKey: ['dash-slots', listing.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('egg_sale_pickup_slots').select('*').eq('listing_id', listing.id).order('starts_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!date || !startTime || !endTime) throw new Error('Välj datum och tid');
      const starts = new Date(`${date}T${startTime}:00`);
      const ends = new Date(`${date}T${endTime}:00`);
      if (ends <= starts) throw new Error('Sluttid måste vara efter starttid');
      const u = await uid();
      const { error } = await (supabase as any).from('egg_sale_pickup_slots').insert({
        listing_id: listing.id, seller_user_id: u,
        starts_at: starts.toISOString(), ends_at: ends.toISOString(),
        max_bookings: Math.max(1, Number(maxBookings) || 1), label: label.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Tidslucka skapad' });
      setDate(''); setLabel('');
      qc.invalidateQueries({ queryKey: ['dash-slots', listing.id] });
    },
    onError: (e: any) => toast({ title: 'Kunde inte skapa', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('egg_sale_pickup_slots').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Borttagen' });
      qc.invalidateQueries({ queryKey: ['dash-slots', listing.id] });
    },
  });

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-serif text-lg flex items-center gap-2"><Plus className="h-4 w-4 text-primary" /> Ny tidslucka</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          <div className="col-span-2"><Label className="text-xs">Datum</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><Label className="text-xs">Från</Label><Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} /></div>
          <div><Label className="text-xs">Till</Label><Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} /></div>
          <div><Label className="text-xs">Max bokningar</Label><Input type="number" min="1" value={maxBookings} onChange={(e) => setMaxBookings(e.target.value)} /></div>
        </div>
        <Input placeholder="Etikett (valfri), t.ex. Lördagsmarknad" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="w-full"><Plus className="h-4 w-4 mr-1" /> Skapa tidslucka</Button>
      </CardContent></Card>

      {slots.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Inga tidsluckor ännu. Köpare bokar då utan specifik tid.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {slots.map((s) => {
            const full = s.current_bookings >= s.max_bookings;
            return (
              <Card key={s.id}>
                <CardContent className="p-3 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary" />
                      {dt(s.starts_at)} – {new Date(s.ends_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    {s.label && <p className="text-xs text-muted-foreground">{s.label}</p>}
                    <p className="text-xs text-muted-foreground">{s.current_bookings}/{s.max_bookings} bokade {full && <Badge variant="destructive" className="ml-1">Fullt</Badge>}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Ta bort tidslucka?')) remove.mutate(s.id); }}><Trash2 className="h-4 w-4" /></Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WaitlistTab({ listing }: { listing: Listing }) {
  const { data: entries = [] } = useQuery<any[]>({
    queryKey: ['dash-waitlist', listing.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('egg_sale_waitlist').select('*').eq('listing_id', listing.id).order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  if (entries.length === 0) {
    return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Inga personer på väntelistan.</CardContent></Card>;
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <Card key={e.id}>
          <CardContent className="p-3">
            <p className="font-medium text-sm">{e.customer_name} {e.notified_at && <Badge variant="secondary" className="ml-1">Notifierad</Badge>}</p>
            <p className="text-xs text-muted-foreground">{e.customer_email || '–'} · {e.customer_phone || '–'} · vill ha {e.packs_wanted} kartor</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function TemplatesTab({ listing, onApply }: { listing: Listing; onApply: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');

  const { data: templates = [] } = useQuery<Template[]>({
    queryKey: ['dash-templates'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('egg_sale_templates').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error('Ge mallen ett namn');
      const u = await uid();
      const snapshot = {
        title: listing.title, description: listing.description, image_url: listing.image_url,
        eggs_per_pack: listing.eggs_per_pack, price_per_pack: listing.price_per_pack,
        p6_price: listing.p6_price, p12_price: listing.p12_price, p30_price: listing.p30_price,
        pickup_info: listing.pickup_info, contact_info: listing.contact_info,
        swish_number: listing.swish_number, swish_name: listing.swish_name, swish_message: listing.swish_message,
        theme: listing.theme, sections: listing.sections, stock_packs: listing.stock_packs,
      };
      const { error } = await (supabase as any).from('egg_sale_templates').insert({ user_id: u, name: name.trim(), snapshot });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Mall sparad' }); setName('');
      qc.invalidateQueries({ queryKey: ['dash-templates'] });
    },
    onError: (e: any) => toast({ title: 'Kunde inte spara', description: e.message, variant: 'destructive' }),
  });

  const apply = useMutation({
    mutationFn: async (tpl: Template) => {
      const { error } = await (supabase as any).from('public_egg_sale_listings').update(tpl.snapshot).eq('id', listing.id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Mall tillämpad på säljsidan' }); onApply(); },
    onError: (e: any) => toast({ title: 'Kunde inte tillämpa', description: e.message, variant: 'destructive' }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('egg_sale_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dash-templates'] }),
  });

  return (
    <div className="space-y-3">
      <Card><CardContent className="p-4 space-y-3">
        <h3 className="font-serif text-lg flex items-center gap-2"><BookmarkPlus className="h-4 w-4 text-primary" /> Spara aktuell sida som mall</h3>
        <p className="text-xs text-muted-foreground">Du kan återanvända pris, text, bild och tema senare.</p>
        <div className="flex gap-2">
          <Input placeholder="Mallnamn, t.ex. 'Lördagsförsäljning'" value={name} onChange={(e) => setName(e.target.value)} />
          <Button onClick={() => save.mutate()} disabled={save.isPending}><BookmarkPlus className="h-4 w-4 mr-1" /> Spara</Button>
        </div>
      </CardContent></Card>

      {templates.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Inga sparade mallar.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-3 flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{dt(t.updated_at)}</p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => { if (confirm(`Tillämpa "${t.name}" på "${listing.title}"? Detta skriver över aktuella värden.`)) apply.mutate(t); }}>Tillämpa</Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { if (confirm('Ta bort mall?')) remove.mutate(t.id); }}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SubscriptionsTab({ listing }: { listing: Listing }) {
  const qc = useQueryClient();
  const { data: subs = [] } = useQuery<any[]>({
    queryKey: ['dash-subs', listing.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('egg_sale_subscriptions').select('*').eq('listing_id', listing.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await (supabase as any).from('egg_sale_subscriptions').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Uppdaterat' }); qc.invalidateQueries({ queryKey: ['dash-subs', listing.id] }); },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('egg_sale_subscriptions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { toast({ title: 'Borttaget' }); qc.invalidateQueries({ queryKey: ['dash-subs', listing.id] }); },
  });

  if (subs.length === 0) {
    return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground space-y-2"><Repeat className="h-8 w-8 mx-auto text-muted-foreground/50" /><p>Inga abonnemang ännu.</p><p className="text-xs">Köpare kan starta abonnemang direkt från din säljsida.</p></CardContent></Card>;
  }

  const freqLabel = (f: string) => f === 'weekly' ? 'Varje vecka' : f === 'biweekly' ? 'Varannan vecka' : 'Varje månad';

  return (
    <div className="space-y-2">
      {subs.map((s) => {
        const active = s.status === 'active';
        return (
          <Card key={s.id} className={active ? '' : 'opacity-60'}>
            <CardContent className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium">{s.customer_name} <span className="text-xs text-muted-foreground">· {s.packs} kartor · {freqLabel(s.frequency)}</span></p>
                  <p className="text-xs text-muted-foreground">{s.customer_email} · {s.customer_phone || '–'}</p>
                  <p className="text-xs text-muted-foreground">Nästa leverans: {dt(s.next_run_at)} · Skickade: {s.total_bookings}</p>
                </div>
                <Badge variant={active ? 'default' : 'secondary'}>{s.status}</Badge>
              </div>
              <div className="flex gap-1.5 flex-wrap pt-1">
                {active ? (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => update.mutate({ id: s.id, patch: { status: 'paused' } })}>
                    <Pause className="h-3 w-3 mr-1" />Pausa
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => update.mutate({ id: s.id, patch: { status: 'active' } })}>
                    <Play className="h-3 w-3 mr-1" />Återuppta
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => { if (confirm('Avsluta abonnemang?')) remove.mutate(s.id); }}>
                  <Trash2 className="h-3 w-3 mr-1" />Avsluta
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function StatsTab({ listing }: { listing: Listing }) {
  const { data: bookings = [] } = useQuery<any[]>({
    queryKey: ['dash-stats-bookings', listing.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('public_egg_sale_bookings').select('*').eq('listing_id', listing.id).neq('status', 'cancelled');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: views = [] } = useQuery<any[]>({
    queryKey: ['dash-stats-views', listing.slug],
    enabled: !!listing.slug,
    queryFn: async () => {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await (supabase as any)
        .from('page_views')
        .select('path, session_id, referrer, device_type, created_at')
        .eq('path', `/s/${listing.slug}`)
        .gte('created_at', since)
        .limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  const stats = useMemo(() => {
    const price = Number(listing.price_per_pack || 0);
    const months = new Map<string, { packs: number; revenue: number; count: number; visits: number; sessions: Set<string> }>();
    const customers = new Map<string, { name: string; packs: number; revenue: number; count: number }>();
    let totalPacks = 0, totalRevenue = 0, paidRevenue = 0;
    const now = new Date();
    const monthsBack: { key: string; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthsBack.push({ key, label: d.toLocaleDateString('sv-SE', { month: 'short', year: '2-digit' }) });
      months.set(key, { packs: 0, revenue: 0, count: 0, visits: 0, sessions: new Set() });
    }
    for (const b of bookings) {
      const d = new Date(b.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rev = Number(b.packs || 0) * price;
      totalPacks += Number(b.packs || 0);
      totalRevenue += rev;
      if (b.payment_status === 'paid') paidRevenue += rev;
      if (months.has(key)) {
        const m = months.get(key)!;
        m.packs += Number(b.packs || 0); m.revenue += rev; m.count += 1;
      }
      const cKey = (b.customer_email || b.customer_phone || b.customer_name || '').toLowerCase();
      if (cKey) {
        const c = customers.get(cKey) || { name: b.customer_name, packs: 0, revenue: 0, count: 0 };
        c.packs += Number(b.packs || 0); c.revenue += rev; c.count += 1;
        customers.set(cKey, c);
      }
    }

    const allSessions = new Set<string>();
    const referrerMap = new Map<string, number>();
    const deviceMap = new Map<string, number>();
    const last30 = Date.now() - 30 * 24 * 60 * 60 * 1000;
    let views30 = 0;
    const sessions30 = new Set<string>();
    for (const v of views) {
      const t = new Date(v.created_at).getTime();
      if (v.session_id) allSessions.add(v.session_id);
      const key = `${new Date(v.created_at).getFullYear()}-${String(new Date(v.created_at).getMonth() + 1).padStart(2, '0')}`;
      if (months.has(key)) {
        const m = months.get(key)!;
        m.visits += 1;
        if (v.session_id) m.sessions.add(v.session_id);
      }
      if (t >= last30) {
        views30 += 1;
        if (v.session_id) sessions30.add(v.session_id);
      }
      const ref = v.referrer ? new URL(v.referrer, 'http://x').hostname.replace(/^www\./, '') : 'direkt';
      referrerMap.set(ref, (referrerMap.get(ref) || 0) + 1);
      const dev = v.device_type || 'okänd';
      deviceMap.set(dev, (deviceMap.get(dev) || 0) + 1);
    }

    const monthsArr = monthsBack.map((m) => {
      const data = months.get(m.key)!;
      return { ...m, ...data, uniqueVisitors: data.sessions.size };
    });
    const maxRev = Math.max(1, ...monthsArr.map((m) => m.revenue));
    const maxVis = Math.max(1, ...monthsArr.map((m) => m.uniqueVisitors));
    const topCustomers = [...customers.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    const topRefs = [...referrerMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const devices = [...deviceMap.entries()].sort((a, b) => b[1] - a[1]);
    const totalVisits = views.length;
    const uniqueVisitors = allSessions.size;
    const conversion = uniqueVisitors > 0 ? (bookings.length / uniqueVisitors) * 100 : 0;

    return {
      monthsArr, topCustomers, totalPacks, totalRevenue, paidRevenue, maxRev, maxVis,
      avg: bookings.length > 0 ? totalRevenue / bookings.length : 0,
      totalVisits, uniqueVisitors, conversion, views30, uniqueVisitors30: sessions30.size,
      topRefs, devices,
    };
  }, [bookings, views, listing.price_per_pack]);

  const hasData = bookings.length > 0 || views.length > 0;
  if (!hasData) {
    return <Card><CardContent className="p-6 text-center text-sm text-muted-foreground"><BarChart3 className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />Ingen försäljnings- eller besöksdata ännu.</CardContent></Card>;
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Total intäkt</p><p className="text-xl font-bold text-primary tabular-nums">{kr(stats.totalRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Betalt</p><p className="text-xl font-bold text-green-600 tabular-nums">{kr(stats.paidRevenue)}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Kartor sålda</p><p className="text-xl font-bold tabular-nums">{stats.totalPacks}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Snitt/bokning</p><p className="text-xl font-bold tabular-nums">{kr(stats.avg)}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Besökare (90d)</p><p className="text-xl font-bold text-blue-600 tabular-nums">{stats.uniqueVisitors}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Sidvisningar</p><p className="text-xl font-bold tabular-nums">{stats.totalVisits}</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Senaste 30 d</p><p className="text-xl font-bold tabular-nums">{stats.uniqueVisitors30}</p><p className="text-[10px] text-muted-foreground">unika · {stats.views30} visn.</p></CardContent></Card>
        <Card><CardContent className="p-3"><p className="text-xs text-muted-foreground">Konvertering</p><p className="text-xl font-bold text-amber-600 tabular-nums">{stats.conversion.toFixed(1)}%</p><p className="text-[10px] text-muted-foreground">bokn./besökare</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="font-serif text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Intäkt &amp; besökare senaste 6 månaderna</h3>
          <div className="space-y-3">
            {stats.monthsArr.map((m) => (
              <div key={m.key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{m.label}</span>
                  <span className="font-medium tabular-nums">{kr(m.revenue)} · {m.count} bokn. · {m.uniqueVisitors} besök.</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(m.revenue / stats.maxRev) * 100}%` }} /></div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden"><div className="h-full bg-blue-500/60 transition-all" style={{ width: `${(m.uniqueVisitors / stats.maxVis) * 100}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Intäkt</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/60" /> Unika besökare</span>
          </div>
        </CardContent>
      </Card>

      {(stats.topRefs.length > 0 || stats.devices.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.topRefs.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-serif text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Varifrån besökarna kommer</h3>
                <div className="space-y-1">
                  {stats.topRefs.map(([ref, count]) => (
                    <div key={ref} className="flex justify-between text-sm py-1 border-b border-border/40 last:border-0">
                      <span className="truncate">{ref}</span>
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
          {stats.devices.length > 0 && (
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="font-serif text-base flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" /> Enheter</h3>
                <div className="space-y-1">
                  {stats.devices.map(([dev, count]) => (
                    <div key={dev} className="flex justify-between text-sm py-1 border-b border-border/40 last:border-0">
                      <span className="capitalize">{dev}</span>
                      <span className="text-muted-foreground tabular-nums">{count}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {stats.topCustomers.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-serif text-base flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Bästa kunder</h3>
            <div className="space-y-1.5">
              {stats.topCustomers.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-border/40 last:border-0">
                  <span className="font-medium">{i + 1}. {c.name}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{c.count} bokn. · {c.packs} kartor · <strong className="text-foreground">{kr(c.revenue)}</strong></span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
