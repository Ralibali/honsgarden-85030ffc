import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  AlertCircle,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  MapPin,
  Package,
  Phone,
  RefreshCcw,
  Smartphone,
  XCircle,
} from 'lucide-react';

type Booking = {
  id: string;
  reference: string;
  customer_name: string;
  customer_phone: string | null;
  customer_email: string | null;
  customer_message: string | null;
  pickup_person_name: string | null;
  pickup_person_phone: string | null;
  packs: number;
  status: string;
  payment_status: string;
  created_at: string;
  cancelled_at: string | null;
  paid_at: string | null;
  packed_at: string | null;
  picked_up_at: string | null;
};

type Listing = {
  id: string;
  slug: string | null;
  title: string | null;
  eggs_per_pack: number;
  price_per_pack: number | null;
  location: string | null;
  pickup_info: string | null;
  latitude: number | null;
  longitude: number | null;
  swish_number: string | null;
  swish_name: string | null;
  swish_message: string | null;
  seller_display_name: string | null;
};

type Slot = {
  id: string;
  starts_at: string;
  ends_at: string;
  label: string | null;
};

type AvailableSlot = Slot & {
  remaining: number;
  is_current: boolean;
};

type OrderResponse = {
  ok: boolean;
  reason?: string;
  booking?: Booking;
  listing?: Listing;
  pickup_slot?: Slot | null;
};

const STATUS_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'destructive' | 'info' | 'neutral' }> = {
  pending: { label: 'Ny bokning', tone: 'info' },
  confirmed: { label: 'Bekräftad', tone: 'info' },
  paid: { label: 'Betald', tone: 'success' },
  packed: { label: 'Packad', tone: 'info' },
  picked_up: { label: 'Hämtad', tone: 'success' },
  cancelled: { label: 'Avbokad', tone: 'destructive' },
  no_show: { label: 'Ej hämtad', tone: 'warning' },
};

const TONE_CLASS: Record<string, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-amber-100 text-amber-800 border-amber-200',
  destructive: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-muted text-muted-foreground border-border',
};

function fmtDateTime(value: string | null | undefined): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleString('sv-SE', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function fmtSlot(slot: { starts_at: string; ends_at: string; label?: string | null } | null | undefined): string {
  if (!slot) return '';
  const start = new Date(slot.starts_at);
  const end = new Date(slot.ends_at);
  const base = `${start.toLocaleString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })} – ${end.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}`;
  return slot.label ? `${base} (${slot.label})` : base;
}

function buildMapsUrl(listing: Listing): string | null {
  if (listing.latitude && listing.longitude) {
    return `https://www.google.com/maps/dir/?api=1&destination=${listing.latitude},${listing.longitude}`;
  }
  const target = [listing.location, listing.pickup_info].filter(Boolean).join(' ').trim();
  if (!target) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}`;
}

function buildAppleMapsUrl(listing: Listing): string | null {
  if (listing.latitude && listing.longitude) {
    return `https://maps.apple.com/?daddr=${listing.latitude},${listing.longitude}`;
  }
  const target = [listing.location, listing.pickup_info].filter(Boolean).join(' ').trim();
  if (!target) return null;
  return `https://maps.apple.com/?daddr=${encodeURIComponent(target)}`;
}

function buildSwishUrl(opts: { number: string; amount: number; message: string }): string {
  const params = new URLSearchParams({
    payee: opts.number.replace(/\s/g, ''),
    amount: String(Math.round(opts.amount)),
    message: opts.message.slice(0, 50),
  });
  return `https://app.swish.nu/1/p/sw/?${params.toString()}`;
}

function buildIcs(booking: Booking, listing: Listing, slot: Slot): string {
  const dt = (s: string) => new Date(s).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const summary = `Hämta ägg – ${listing.title ?? 'Agdas bod'}`;
  const description = [
    `Bokning ${booking.reference}`,
    `${booking.packs} förpackning${booking.packs > 1 ? 'ar' : ''}`,
    listing.pickup_info ?? '',
  ]
    .filter(Boolean)
    .join('\\n');
  const location = [listing.location, listing.pickup_info].filter(Boolean).join(', ');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Honsgarden//Agdas bod//SV',
    'BEGIN:VEVENT',
    `UID:${booking.id}@honsgarden.se`,
    `DTSTAMP:${dt(new Date().toISOString())}`,
    `DTSTART:${dt(slot.starts_at)}`,
    `DTEND:${dt(slot.ends_at)}`,
    `SUMMARY:${summary}`,
    `DESCRIPTION:${description}`,
    location ? `LOCATION:${location}` : '',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

function downloadIcs(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function StatusBadge({ status }: { status: string }) {
  const def = STATUS_LABELS[status] ?? { label: status, tone: 'neutral' as const };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${TONE_CLASS[def.tone]}`}>
      {def.label}
    </span>
  );
}

function SectionRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/40 last:border-0">
      <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={`text-sm text-foreground ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

export default function OrderPortal() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [order, setOrder] = useState<OrderResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | 'cancel' | 'reschedule' | 'reload'>(null);
  const [swishQr, setSwishQr] = useState<string | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const load = async () => {
    if (!token) {
      setErr('Ingen orderlänk hittades.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.rpc('get_order_by_token', { p_token: token });
    if (error) {
      setErr(error.message);
      setLoading(false);
      return;
    }
    const res = (data ?? { ok: false }) as OrderResponse;
    setOrder(res);
    setErr(null);
    setLoading(false);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const booking = order?.booking;
  const listing = order?.listing;
  const slot = order?.pickup_slot ?? null;

  const total = useMemo(() => {
    if (!booking || !listing?.price_per_pack) return 0;
    return Math.round(booking.packs * Number(listing.price_per_pack));
  }, [booking, listing?.price_per_pack]);

  const swishUrl = useMemo(() => {
    if (!booking || !listing?.swish_number) return null;
    return buildSwishUrl({
      number: listing.swish_number,
      amount: total,
      message: `${listing.swish_message ?? 'Äggbokning'} ${booking.reference}`,
    });
  }, [booking, listing, total]);

  useEffect(() => {
    if (!swishUrl) {
      setSwishQr(null);
      return;
    }
    QRCode.toDataURL(swishUrl, { errorCorrectionLevel: 'M', margin: 1, width: 220 })
      .then(setSwishQr)
      .catch(() => setSwishQr(null));
  }, [swishUrl]);

  const isCancelled = booking?.status === 'cancelled';
  const isPickedUp = booking?.status === 'picked_up';
  const canCancel = booking && !isCancelled && !isPickedUp;
  const canReschedule = canCancel;

  const handleCopy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${what} kopierat` });
    } catch {
      toast({ title: 'Kunde inte kopiera', variant: 'destructive' });
    }
  };

  const openReschedule = async () => {
    if (!token) return;
    setShowReschedule(true);
    setSlotsLoading(true);
    const { data, error } = await supabase.rpc('list_pickup_slots_by_token', { p_token: token });
    setSlotsLoading(false);
    if (error) {
      toast({ title: 'Kunde inte hämta tider', description: error.message, variant: 'destructive' });
      return;
    }
    const res = (data ?? {}) as { ok: boolean; slots?: AvailableSlot[] };
    setSlots(res.slots ?? []);
  };

  const pickSlot = async (slotId: string) => {
    if (!token) return;
    setBusy('reschedule');
    const { data, error } = await supabase.rpc('reschedule_order_by_token', {
      p_token: token,
      p_new_slot_id: slotId,
    });
    setBusy(null);
    if (error) {
      toast({ title: 'Kunde inte byta tid', description: error.message, variant: 'destructive' });
      return;
    }
    const res = (data ?? {}) as { ok: boolean; reason?: string };
    if (!res.ok) {
      const msg =
        res.reason === 'slot_full' ? 'Tiden hann bli fullbokad.'
          : res.reason === 'slot_past' ? 'Tiden har redan passerat.'
          : res.reason === 'slot_invalid' ? 'Tiden är inte längre aktiv.'
          : res.reason === 'not_reschedulable' ? 'Bokningen går inte att boka om.'
          : 'Något gick fel.';
      toast({ title: 'Kunde inte byta tid', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Tid uppdaterad' });
    setShowReschedule(false);
    void load();
    if (token) {
      supabase.functions
        .invoke('notify-seller-booking-change', { body: { token, event: 'modified' } })
        .catch(() => {});
    }
  };

  const cancel = async () => {
    if (!token) return;
    setBusy('cancel');
    const { data, error } = await supabase.rpc('cancel_order_by_token', { p_token: token });
    setBusy(null);
    if (error) {
      toast({ title: 'Kunde inte avboka', description: error.message, variant: 'destructive' });
      return;
    }
    const res = (data ?? {}) as { ok: boolean; reason?: string };
    if (!res.ok) {
      const msg =
        res.reason === 'already_cancelled' ? 'Bokningen var redan avbokad.'
          : res.reason === 'not_cancellable' ? 'Bokningen är redan hämtad.'
          : 'Något gick fel.';
      toast({ title: 'Avbokning misslyckades', description: msg, variant: 'destructive' });
      return;
    }
    toast({ title: 'Bokningen är avbokad' });
    setConfirmCancel(false);
    void load();
    if (token) {
      supabase.functions
        .invoke('notify-seller-booking-change', { body: { token, event: 'cancelled' } })
        .catch(() => {});
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#FAF8F4] flex items-center justify-center px-4">
        <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (err || !order || !order.ok || !booking || !listing) {
    return (
      <main className="min-h-screen bg-[#FAF8F4] px-4 py-12 flex items-center justify-center">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-3">
            <XCircle className="h-10 w-10 mx-auto text-destructive" />
            <h1 className="font-serif text-2xl">Ogiltig orderlänk</h1>
            <p className="text-sm text-muted-foreground">
              {err ?? 'Den här länken verkar inte stämma. Kontakta säljaren direkt om du har frågor om din beställning.'}
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const totalEggs = booking.packs * listing.eggs_per_pack;
  const mapsUrl = buildMapsUrl(listing);
  const appleMapsUrl = buildAppleMapsUrl(listing);
  const buyAgainHref = listing.slug ? `/s/${listing.slug}` : null;

  return (
    <main className="min-h-screen bg-[#FAF8F4] px-4 py-6 sm:py-10">
      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header */}
        <header className="space-y-2 text-center sm:text-left">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Din beställning</p>
          <h1 className="font-serif text-3xl sm:text-4xl leading-tight">{listing.title ?? 'Äggbeställning'}</h1>
          {listing.seller_display_name && (
            <p className="text-sm text-muted-foreground">
              Hos <span className="text-foreground font-medium">{listing.seller_display_name}</span>
              {listing.location ? ` · ${listing.location}` : ''}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start">
            <StatusBadge status={booking.status} />
            {booking.payment_status === 'paid' && <Badge variant="outline" className="border-green-300 text-green-700">Betald</Badge>}
            {booking.payment_status === 'refunded' && <Badge variant="outline" className="border-blue-300 text-blue-700">Återbetald</Badge>}
            <span className="text-xs text-muted-foreground">Ref {booking.reference}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => {
                setBusy('reload');
                void load().finally(() => setBusy(null));
              }}
            >
              <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${busy === 'reload' ? 'animate-spin' : ''}`} />
              Uppdatera
            </Button>
          </div>
        </header>

        {isCancelled && (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="p-4 flex gap-3 items-start">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-foreground">Bokningen är avbokad</p>
                <p className="text-muted-foreground">
                  Du behöver inte göra något mer. Vill du boka igen? {buyAgainHref && (
                    <Link to={buyAgainHref} className="text-primary underline">Gå till säljsidan</Link>
                  )}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order summary */}
        <Card>
          <CardContent className="p-5 sm:p-6 space-y-1">
            <div className="flex items-start justify-between gap-3 pb-2 mb-2 border-b border-border/40">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Att betala</p>
                <p className="font-serif text-3xl text-foreground">{total} kr</p>
                <p className="text-xs text-muted-foreground">
                  {booking.packs} × {listing.eggs_per_pack}-pack · totalt {totalEggs} ägg
                </p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Package className="h-5 w-5" />
              </div>
            </div>
            <SectionRow label="Pris per förpackning" value={listing.price_per_pack ? `${listing.price_per_pack} kr` : '—'} />
            <SectionRow label="Antal förpackningar" value={String(booking.packs)} />
            <SectionRow label="Ägg per förpackning" value={String(listing.eggs_per_pack)} />
            <SectionRow label="Totalt ägg" value={String(totalEggs)} />
            <SectionRow label="Bokat" value={fmtDateTime(booking.created_at)} />
            <SectionRow label="Referens" value={booking.reference} mono />
          </CardContent>
        </Card>

        {/* Swish */}
        {!isCancelled && listing.swish_number && (
          <Card>
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <h2 className="font-serif text-lg">Betala med Swish</h2>
              </div>
              <div className="grid sm:grid-cols-[1fr_auto] gap-4 items-start">
                <div className="space-y-1.5 text-sm">
                  <p>
                    <span className="text-muted-foreground">Belopp:</span>{' '}
                    <span className="font-medium">{total} kr</span>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Till:</span>{' '}
                    <span className="font-medium">{listing.swish_number}</span>
                    {listing.swish_name ? ` (${listing.swish_name})` : ''}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-1.5 ml-1"
                      onClick={() => handleCopy(listing.swish_number ?? '', 'Swish-nummer')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </p>
                  <p>
                    <span className="text-muted-foreground">Meddelande:</span>{' '}
                    <span className="font-medium">{listing.swish_message ?? 'Äggbokning'} {booking.reference}</span>
                  </p>
                  {swishUrl && (
                    <Button asChild className="w-full sm:w-auto mt-2">
                      <a href={swishUrl}>Öppna Swish</a>
                    </Button>
                  )}
                </div>
                {swishQr && (
                  <div className="flex flex-col items-center gap-1.5">
                    <img src={swishQr} alt="Swish QR-kod" className="rounded-lg border border-border/60 bg-white p-1.5" />
                    <span className="text-[10px] text-muted-foreground">Skanna i Swish-appen</span>
                  </div>
                )}
              </div>
              {booking.payment_status !== 'paid' && (
                <p className="text-xs text-muted-foreground">
                  Säljaren markerar betalningen som mottagen efter att Swish-meddelandet kommit fram.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Pickup */}
        <Card>
          <CardContent className="p-5 sm:p-6 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="font-serif text-lg">Upphämtning</h2>
              </div>
              {canReschedule && (
                <Button size="sm" variant="outline" onClick={openReschedule}>
                  Byt tid
                </Button>
              )}
            </div>
            {slot ? (
              <p className="text-sm">{fmtSlot(slot)}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Säljaren har inte angett någon särskild tid – följ instruktionerna nedan.</p>
            )}
            {listing.location && (
              <div className="text-sm">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Adress</span>
                <p>{listing.location}</p>
              </div>
            )}
            {listing.pickup_info && (
              <div className="text-sm">
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Säljarens instruktioner</span>
                <p className="whitespace-pre-line">{listing.pickup_info}</p>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              {mapsUrl && (
                <Button asChild size="sm" variant="outline">
                  <a href={mapsUrl} target="_blank" rel="noreferrer">
                    <MapPin className="h-4 w-4 mr-1.5" /> Google Maps
                  </a>
                </Button>
              )}
              {appleMapsUrl && (
                <Button asChild size="sm" variant="outline">
                  <a href={appleMapsUrl} target="_blank" rel="noreferrer">
                    <MapPin className="h-4 w-4 mr-1.5" /> Apple Maps
                  </a>
                </Button>
              )}
              {listing.location && (
                <Button size="sm" variant="ghost" onClick={() => handleCopy(listing.location ?? '', 'Adress')}>
                  <Copy className="h-4 w-4 mr-1.5" /> Kopiera adress
                </Button>
              )}
              {slot && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => downloadIcs(buildIcs(booking, listing, slot), `agdas-bod-${booking.reference}.ics`)}
                >
                  <Calendar className="h-4 w-4 mr-1.5" /> Lägg i kalender
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Customer details */}
        <Card>
          <CardContent className="p-5 sm:p-6 space-y-1">
            <h2 className="font-serif text-lg mb-2">Dina uppgifter</h2>
            <SectionRow label="Namn" value={booking.customer_name} />
            {booking.customer_phone && <SectionRow label="Telefon" value={booking.customer_phone} />}
            {booking.customer_email && <SectionRow label="E-post" value={booking.customer_email} />}
            {booking.pickup_person_name && (
              <SectionRow
                label="Hämtas av"
                value={`${booking.pickup_person_name}${booking.pickup_person_phone ? ` · ${booking.pickup_person_phone}` : ''}`}
              />
            )}
            {booking.customer_message && <SectionRow label="Ditt meddelande" value={booking.customer_message} />}
          </CardContent>
        </Card>

        {/* Reschedule list */}
        {showReschedule && (
          <Card className="border-primary/30">
            <CardContent className="p-5 sm:p-6 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-lg">Välj ny tid</h2>
                <Button size="sm" variant="ghost" onClick={() => setShowReschedule(false)}>Stäng</Button>
              </div>
              {slotsLoading ? (
                <div className="py-6 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : slots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">Inga lediga tider tillgängliga just nu.</p>
              ) : (
                <ul className="space-y-2">
                  {slots.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        disabled={busy === 'reschedule' || (s.remaining === 0 && !s.is_current)}
                        onClick={() => pickSlot(s.id)}
                        className="w-full text-left rounded-xl border border-border/60 px-4 py-3 hover:border-primary/50 hover:bg-primary/5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium">{fmtSlot(s)}</p>
                            <p className="text-xs text-muted-foreground">
                              {s.is_current ? 'Din nuvarande tid' : `${s.remaining} platser kvar`}
                            </p>
                          </div>
                          {s.is_current && <CheckCircle2 className="h-4 w-4 text-primary" />}
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <Card>
          <CardContent className="p-5 sm:p-6 space-y-3">
            <h2 className="font-serif text-lg">Mer</h2>
            <div className="grid sm:grid-cols-2 gap-2">
              {buyAgainHref && (
                <Button asChild variant="outline">
                  <Link to={buyAgainHref}>
                    <ExternalLink className="h-4 w-4 mr-1.5" /> Boka igen
                  </Link>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => handleCopy(`${window.location.origin}/bestallning/${token ?? ''}`, 'Orderlänk')}
              >
                <Copy className="h-4 w-4 mr-1.5" /> Kopiera orderlänk
              </Button>
            </div>
            {canCancel && (
              <div className="pt-2 border-t border-border/40">
                {confirmCancel ? (
                  <div className="space-y-2">
                    <p className="text-sm text-foreground">
                      Är du säker på att du vill avboka? Bokningen försvinner och säljaren får besked direkt.
                    </p>
                    <div className="flex gap-2">
                      <Button variant="destructive" onClick={cancel} disabled={busy === 'cancel'}>
                        {busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
                        Ja, avboka
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmCancel(false)}>Avbryt</Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirmCancel(true)}>
                    <XCircle className="h-4 w-4 mr-1.5" /> Avboka bokningen
                  </Button>
                )}
              </div>
            )}
            {listing.swish_number && !isCancelled && !isPickedUp && (
              <div className="pt-2 border-t border-border/40">
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Behöver du kontakta säljaren? Numret står i Swish-uppgifterna ovan.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {!isCancelled && (
          <EggAlertSignup
            source="order-portal"
            utmCampaign="post-order-guide"
            variant="post-order"
            ortName={listing.location ?? null}
          />
        )}

        <p className="text-center text-[11px] text-muted-foreground py-4">
          Spara denna länk – här ser du alltid din bokning. Ingen inloggning krävs.
        </p>
      </div>
    </main>
  );
}
