import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { BarChart3, BookOpenCheck, Copy, Crown, LayoutDashboard, PackageCheck, Palette, QrCode, Repeat, ShoppingBasket, Sparkles, TrendingUp, Users, Wallet } from 'lucide-react';
import { Link } from 'react-router-dom';

import EggSalesOverview from '@/components/EggSalesOverview';
import EggSalesListingsBrowser from '@/components/EggSalesListingsBrowser';
import ShareListingCard from '@/components/egg-sales/ShareListingCard';
import ManualEggSalesCard from '@/components/ManualEggSalesCard';

type Booking = any;
type Listing = any;

const PUBLIC_APP_URL = String(import.meta.env.VITE_PUBLIC_APP_URL || 'https://honsgarden.se').replace(/\/+$/, '');

function kr(value: unknown) {
  return `${Math.round(Number(value || 0))} kr`;
}

async function copyText(text: string, label = 'Texten') {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: `${label} är kopierad` });
  } catch {
    toast({ title: 'Kunde inte kopiera', description: 'Markera texten och kopiera manuellt.', variant: 'destructive' });
  }
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('Du behöver vara inloggad.');
  return data.user.id;
}

async function downloadQrPdf(listings: Listing[]) {
  const active = listings.filter((listing) => listing.is_active !== false);
  const pool = active.length > 0 ? active : listings;
  if (pool.length === 0) {
    toast({ title: 'Skapa en säljsida först', variant: 'destructive' });
    return;
  }

  try {
    const [{ jsPDF }, qrModule] = await Promise.all([import('jspdf'), import('qrcode')]);
    const QRCode = (qrModule as any).default ?? qrModule;
    const pdf = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    const cream: [number, number, number] = [250, 248, 244];
    const green: [number, number, number] = [58, 107, 53];
    const greenDark: [number, number, number] = [31, 42, 31];
    const ink: [number, number, number] = [42, 36, 30];
    const mute: [number, number, number] = [140, 128, 115];
    const line: [number, number, number] = [225, 218, 205];
    const accent: [number, number, number] = [212, 162, 70];

    for (let i = 0; i < pool.length; i += 1) {
      const listing = pool[i];
      const slug = encodeURIComponent(String(listing.slug || listing.id));
      const url = `${PUBLIC_APP_URL}/s/${slug}`;
      const dataUrl = await QRCode.toDataURL(url, {
        margin: 0,
        width: 900,
        errorCorrectionLevel: 'H',
        color: { dark: '#1f2a1f', light: '#ffffff' },
      });
      if (i > 0) pdf.addPage();

      pdf.setFillColor(...cream);
      pdf.rect(0, 0, pageW, pageH, 'F');

      const heroH = 58;
      pdf.setFillColor(...green);
      pdf.rect(0, 0, pageW, heroH, 'F');
      pdf.setFillColor(...accent);
      pdf.rect(0, heroH, pageW, 1.2, 'F');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(245, 230, 200);
      pdf.text('A G D A S   B O D', pageW / 2, 18, { align: 'center' });

      pdf.setFont('times', 'normal');
      pdf.setFontSize(30);
      pdf.setTextColor(252, 248, 240);
      pdf.text('Färska ägg', pageW / 2, 34, { align: 'center' });
      pdf.setFontSize(18);
      pdf.setFont('times', 'italic');
      pdf.text('till salu', pageW / 2, 46, { align: 'center' });

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(13);
      pdf.setTextColor(...greenDark);
      pdf.text(listing.title || 'Agdas bod', pageW / 2, heroH + 12, { align: 'center' });

      const qr = 78;
      const cardW = qr + 22;
      const cardH = qr + 22;
      const cardX = (pageW - cardW) / 2;
      const cardY = heroH + 18;

      pdf.setFillColor(225, 218, 205);
      pdf.roundedRect(cardX + 1.2, cardY + 1.6, cardW, cardH, 4, 4, 'F');
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(cardX, cardY, cardW, cardH, 4, 4, 'F');

      const bx = cardX + 5;
      const by = cardY + 5;
      const bw = cardW - 10;
      const bh = cardH - 10;
      const br = 5;
      pdf.setDrawColor(...green);
      pdf.setLineWidth(0.9);
      pdf.line(bx, by + br, bx, by);
      pdf.line(bx, by, bx + br, by);
      pdf.line(bx + bw - br, by, bx + bw, by);
      pdf.line(bx + bw, by, bx + bw, by + br);
      pdf.line(bx, by + bh - br, bx, by + bh);
      pdf.line(bx, by + bh, bx + br, by + bh);
      pdf.line(bx + bw - br, by + bh, bx + bw, by + bh);
      pdf.line(bx + bw, by + bh - br, bx + bw, by + bh);

      pdf.addImage(dataUrl, 'PNG', cardX + (cardW - qr) / 2, cardY + (cardH - qr) / 2, qr, qr);

      const ctaY = cardY + cardH + 12;
      const ctaText = 'Skanna  ·  Boka  ·  Hämta';
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      const ctaW = pdf.getTextWidth(ctaText) + 14;
      const ctaX = (pageW - ctaW) / 2;
      pdf.setFillColor(...greenDark);
      pdf.roundedRect(ctaX, ctaY, ctaW, 9, 4.5, 4.5, 'F');
      pdf.setTextColor(252, 248, 240);
      pdf.text(ctaText, pageW / 2, ctaY + 6, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(...mute);
      pdf.text(url.replace(/^https?:\/\//, ''), pageW / 2, ctaY + 16, { align: 'center' });

      const infoY = ctaY + 24;
      if (listing.pickup_info) {
        const lines = pdf.splitTextToSize(String(listing.pickup_info), pageW - 36);
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(...green);
        pdf.text('U P P H Ä M T N I N G', pageW / 2, infoY, { align: 'center' });
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(10);
        pdf.setTextColor(...ink);
        pdf.text(lines, pageW / 2, infoY + 6, { align: 'center' });
      }

      pdf.setDrawColor(...line);
      pdf.setLineWidth(0.3);
      pdf.line(20, pageH - 16, pageW - 20, pageH - 16);
      pdf.setFont('times', 'italic');
      pdf.setFontSize(9);
      pdf.setTextColor(...green);
      pdf.text('honsgarden.se', pageW / 2 - 14, pageH - 9, { align: 'center' });
      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(...mute);
      pdf.setFontSize(8);
      pdf.text('·', pageW / 2, pageH - 9, { align: 'center' });
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...greenDark);
      pdf.text('Agdas bod', pageW / 2 + 14, pageH - 9, { align: 'center' });
    }

    pdf.save('agdas-bod-qr.pdf');
    toast({ title: 'PDF nedladdad', description: `${pool.length} skylt${pool.length > 1 ? 'ar' : ''} skapade.` });
  } catch (error) {
    console.error('[EggSales] QR PDF failed', error);
    toast({ title: 'Kunde inte skapa QR-skylten', description: 'Försök igen om en stund.', variant: 'destructive' });
  }
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
    document.title = 'Agdas äggbod | Hönsgården';
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

  useEffect(() => {
    const missing = (listings as any[]).filter((listing) => listing?.id && (listing.latitude == null || listing.longitude == null));
    missing.forEach((listing) => {
      supabase.functions.invoke('geocode-egg-listings', { body: { listing_id: listing.id } }).catch(() => {});
    });
  }, [listings]);

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
    (listings as Listing[]).forEach((listing) => { map[listing.id] = listing; });
    return map;
  }, [listings]);

  const activeBookings = useMemo(() => (bookings as Booking[]).filter((booking) => booking.status !== 'cancelled'), [bookings]);
  const paidBookings = useMemo(() => activeBookings.filter((booking) => booking.status === 'paid' || booking.status === 'picked_up'), [activeBookings]);
  const pickedUpBookings = useMemo(() => activeBookings.filter((booking) => booking.status === 'picked_up'), [activeBookings]);

  const amountFor = (rows: Booking[]) => rows.reduce((sum, booking) => {
    const listing = listingById[booking.listing_id];
    return sum + Number(booking.packs || 0) * Number(listing?.price_per_pack || 0);
  }, 0);

  const weekStart = startOfWeek();
  const monthStart = startOfMonth();
  const weekBookings = activeBookings.filter((booking) => booking.created_at && new Date(booking.created_at) >= weekStart);
  const monthBookings = activeBookings.filter((booking) => booking.created_at && new Date(booking.created_at) >= monthStart);

  const customerStats = useMemo(() => {
    const map = new Map<string, { name: string; orders: number; packs: number; amount: number }>();
    activeBookings.forEach((booking) => {
      const name = String(booking.customer_name || '').trim();
      const phone = String(booking.customer_phone || '').replace(/\s+/g, '');
      const key = phone || name.toLowerCase();
      if (!key) return;
      const listing = listingById[booking.listing_id];
      const amount = Number(booking.packs || 0) * Number(listing?.price_per_pack || 0);
      const row = map.get(key) || { name: name || 'Kund', orders: 0, packs: 0, amount: 0 };
      row.orders += 1;
      row.packs += Number(booking.packs || 0);
      row.amount += amount;
      map.set(key, row);
    });
    return Array.from(map.values()).sort((a, b) => b.orders - a.orders || b.amount - a.amount);
  }, [activeBookings, listingById]);

  const regularCustomers = customerStats.filter((customer) => customer.orders >= 2 || customer.packs >= 3);
  const conversionRate = activeBookings.length > 0 ? Math.round((pickedUpBookings.length / activeBookings.length) * 100) : 0;
  const avgOrder = activeBookings.length > 0 ? amountFor(activeBookings) / activeBookings.length : 0;
  const activeListings = (listings as Listing[]).filter((listing) => listing.is_active !== false && !listing.sold_out_manually).length;

  const weeklyReport = `Agdas veckorapport\n\nBokningar denna vecka: ${weekBookings.length}\nKartor denna vecka: ${weekBookings.reduce((sum, booking) => sum + Number(booking.packs || 0), 0)}\nVärde denna vecka: ${kr(amountFor(weekBookings))}\nMånadens värde: ${kr(amountFor(monthBookings))}\nÅterkommande kunder: ${regularCustomers.length}\nAktiva säljsidor: ${activeListings}\nBekräftat värde totalt: ${kr(amountFor(paidBookings))}`;

  return (
    <div className="max-w-7xl mx-auto space-y-5 pb-8">
      <EggSalesOverview />
      <ManualEggSalesCard />
      <EggSalesListingsBrowser />

      <Card className="border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/10 shadow-sm">
        <CardContent className="p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge className="bg-primary text-primary-foreground">Agdas äggbod</Badge>
                <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Beställningar & kunder</Badge>
              </div>
              <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Håll koll på ägg, kunder och veckans försäljning.</h1>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                Agda samlar dina säljsidor, bokningar, kunder och enkla rapporter på samma plats – så att du slipper hålla allt i huvudet.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="rounded-xl gap-2">
                <Link to="/app/egg-sales/dashboard"><LayoutDashboard className="h-4 w-4" /> Kontrollrum <Badge className="ml-1 bg-warning/15 text-warning border-warning/25"><Crown className="h-3 w-3 mr-0.5" />Plus</Badge></Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl gap-2">
                <Link to="/app/egg-sales/anpassa"><Palette className="h-4 w-4" /> Designa säljsidan</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-xl gap-2">
                <Link to="/app/forsaljningsjournal"><BookOpenCheck className="h-4 w-4" /> Försäljningsjournal</Link>
              </Button>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => copyText(weeklyReport, 'Veckorapporten')}>
                <Copy className="h-4 w-4" /> Kopiera veckorapport
              </Button>
              <Button variant="outline" className="rounded-xl gap-2" onClick={() => downloadQrPdf(listings as Listing[])}>
                <QrCode className="h-4 w-4" /> QR-skylt (PDF)
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={ShoppingBasket} label="Denna vecka" value={weekBookings.length} sub={`${weekBookings.reduce((sum, booking) => sum + Number(booking.packs || 0), 0)} kartor · ${kr(amountFor(weekBookings))}`} />
            <KpiCard icon={Wallet} label="Månadens värde" value={kr(amountFor(monthBookings))} sub={`${monthBookings.length} bokningar`} />
            <KpiCard icon={Repeat} label="Stamkunder" value={regularCustomers.length} sub={`${customerStats.length} kunder totalt`} />
            <KpiCard icon={PackageCheck} label="Hämtade beställningar" value={`${conversionRate}%`} sub={`Snittorder ${kr(avgOrder)}`} />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <Card className="xl:col-span-2 border-border/60 bg-background/70 shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h2 className="font-serif text-lg text-foreground flex items-center gap-2"><Users className="h-4 w-4 text-primary" /> Kundöversikt</h2>
                    <p className="text-xs text-muted-foreground">Se vilka som bokar, vilka som återkommer och vilka beställningar som ger mest.</p>
                  </div>
                  <Badge variant="secondary">{customerStats.length} kunder</Badge>
                </div>

                {customerStats.length === 0 ? (
                  <div className="rounded-2xl border border-dashed p-5 text-center">
                    <Users className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="font-medium">Inga kunder ännu</p>
                    <p className="text-sm text-muted-foreground mt-1">När någon bokar via en säljsida bygger Agda upp kundöversikten automatiskt.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {customerStats.slice(0, 4).map((customer) => (
                      <div key={`${customer.name}-${customer.orders}-${customer.packs}`} className="rounded-2xl border bg-card p-4 space-y-3">
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
                <h2 className="font-serif text-lg text-foreground flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /> Agdas överblick</h2>
                <Insight icon={TrendingUp} title="Veckans försäljning" text={weekBookings.length > 0 ? `Denna vecka ligger på ${kr(amountFor(weekBookings))}. Följ takten och jämför vecka för vecka.` : 'När bokningar kommer in visar Agda veckans takt och värde här.'} />
                <Insight icon={BarChart3} title="Stamkunder" text={regularCustomers.length > 0 ? `Du har ${regularCustomers.length} återkommande kunder. Det är en bra grund för jämnare äggförsäljning.` : 'Kunder som bokar flera gånger markeras automatiskt som stammisar.'} />
                <Insight icon={Sparkles} title="Nästa hjälp från Agda" text="Nästa steg blir påminnelser, kundnoteringar och återkommande beställningar." />
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Dela-kort: QR + länk direkt i flödet för den första aktiva säljsidan */}
      {(() => {
        const primary = (listings as Listing[]).find((l) => l.is_active !== false) ?? (listings as Listing[])[0];
        return primary ? (
          <ShareListingCard
            slug={String(primary.slug || primary.id)}
            title={primary.title || 'Agdas äggbod'}
            publicBaseUrl={PUBLIC_APP_URL}
          />
        ) : null;
      })()}
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
