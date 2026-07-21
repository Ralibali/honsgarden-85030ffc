import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  CheckCircle2, Clock, XCircle, Receipt, Search, Package, Truck, ExternalLink, Copy,
} from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { formatSek } from '@/lib/shopCart';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type ShopOrder = Tables<'shop_orders'>;

interface OrderItem {
  product_id: string;
  variant_id?: string | null;
  name: string;
  variant_name?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price_ore: number;
}

// Exakta värden som DB tillåter för fulfillment_status
export const FULFILLMENT_VALUES = ['new', 'processing', 'packed', 'shipped', 'completed', 'canceled'] as const;
export type FulfillmentStatus = typeof FULFILLMENT_VALUES[number];

const FULFILLMENT_OPTIONS: { value: FulfillmentStatus; label: string }[] = [
  { value: 'new', label: 'Ny' },
  { value: 'processing', label: 'Bearbetas' },
  { value: 'packed', label: 'Packad' },
  { value: 'shipped', label: 'Skickad' },
  { value: 'completed', label: 'Slutförd' },
  { value: 'canceled', label: 'Avbruten' },
];

const FULFILLMENT_STYLE: Record<FulfillmentStatus, string> = {
  new: 'bg-primary/10 text-primary border-primary/20',
  processing: 'bg-accent/20 text-foreground border-accent/30',
  packed: 'bg-purple-100 text-purple-800 border-purple-200',
  shipped: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-success/15 text-success border-success/25',
  canceled: 'bg-muted text-muted-foreground border-border',
};

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  paid: { label: 'Betald', icon: CheckCircle2, className: 'bg-success/10 text-success border-success/20' },
  pending: { label: 'Väntar', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' },
  expired: { label: 'Utgången', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
  canceled: { label: 'Avbruten', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
  refunded: { label: 'Återbetald', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
};

export function orderItems(items: Tables<'shop_orders'>['items']): OrderItem[] {
  return Array.isArray(items) ? (items as unknown as OrderItem[]) : [];
}

/** Filtrera ordrar mot fritext, status och fulfillment. Renodlad för test. */
export function filterOrders(
  orders: ShopOrder[],
  query: string,
  statusFilter: string,
  fulfillmentFilter: string,
): ShopOrder[] {
  const q = query.trim().toLowerCase();
  return orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (fulfillmentFilter !== 'all' && (o.fulfillment_status ?? 'new') !== fulfillmentFilter) return false;
    if (!q) return true;
    const items = orderItems(o.items).map((i) => `${i.name} ${i.variant_name ?? ''} ${i.sku ?? ''}`).join(' ');
    return [
      o.order_number, o.customer_email, o.customer_name, o.customer_phone,
      o.stripe_session_id, o.tracking_number, items,
    ].some((v) => v && String(v).toLowerCase().includes(q));
  });
}

function formatAddress(addr: Tables<'shop_orders'>['shipping_address']): string {
  if (!addr || typeof addr !== 'object') return '';
  const a = addr as Record<string, string>;
  return [a.line1, a.line2, a.postal_code, a.city, a.country].filter(Boolean).join(', ');
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: 'Kopierat', description: label });
  } catch {
    toast({ title: 'Kunde inte kopiera', variant: 'destructive' });
  }
}

export default function ShopOrders({ orders, loading }: { orders: ShopOrder[]; loading: boolean }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');
  const [detail, setDetail] = useState<ShopOrder | null>(null);
  const [editFulfillment, setEditFulfillment] = useState<FulfillmentStatus>('new');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const filtered = useMemo(
    () => filterOrders(orders, query, statusFilter, fulfillmentFilter),
    [orders, query, statusFilter, fulfillmentFilter]
  );

  const updateOrder = useMutation({
    mutationFn: async (patch: {
      id: string; fulfillment_status: FulfillmentStatus;
      tracking_number: string | null; tracking_url: string | null; admin_note: string | null;
    }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc('shop_admin_update_order_fulfillment', {
        p_order_id: patch.id,
        p_fulfillment_status: patch.fulfillment_status,
        p_tracking_number: patch.tracking_number,
        p_tracking_url: patch.tracking_url,
        p_admin_note: patch.admin_note,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
      toast({ title: 'Order uppdaterad' });
      setDetail(null);
    },
    onError: (e) => {
      const msg = (e as Error).message ?? '';
      const nice = msg.includes('invalid_tracking_url') ? 'Spårningslänken måste börja med http eller https.'
        : msg.includes('not_authorized') ? 'Du har inte behörighet.'
        : msg.includes('invalid_fulfillment_status') ? 'Ogiltig leveransstatus.'
        : msg;
      toast({ title: 'Kunde inte spara', description: nice, variant: 'destructive' });
    },
  });

  const openDetail = (order: ShopOrder) => {
    setDetail(order);
    const fs = (order.fulfillment_status ?? 'new') as FulfillmentStatus;
    setEditFulfillment(FULFILLMENT_VALUES.includes(fs) ? fs : 'new');
    setTrackingNumber(order.tracking_number ?? '');
    setTrackingUrl(order.tracking_url ?? '');
    setAdminNote(order.admin_note ?? '');
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök ordernummer, kund, e-post, spårning…"
            aria-label="Sök ordrar"
            className="pl-9 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 rounded-xl" aria-label="Betalstatus"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla statusar</SelectItem>
            <SelectItem value="paid">Betald</SelectItem>
            <SelectItem value="pending">Väntar</SelectItem>
            <SelectItem value="expired">Utgången</SelectItem>
            <SelectItem value="canceled">Avbruten</SelectItem>
            <SelectItem value="refunded">Återbetald</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
          <SelectTrigger className="w-full sm:w-44 rounded-xl" aria-label="Leveranssteg"><SelectValue placeholder="Leverans" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla leveranssteg</SelectItem>
            {FULFILLMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card className="p-10 rounded-2xl text-center">
          <Receipt className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
          <p className="font-serif text-lg">Inga ordrar matchade</p>
          <p className="text-sm text-muted-foreground mt-1">Justera filter eller invänta nästa köp.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => {
            const meta = STATUS_META[order.status] ?? STATUS_META.pending;
            const StatusIcon = meta.icon;
            const items = orderItems(order.items);
            const fs = (order.fulfillment_status ?? 'new') as FulfillmentStatus;
            return (
              <Card key={order.id} className="p-4 rounded-2xl border-border/50 hover:border-primary/25 transition-colors">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                        <StatusIcon className="h-3 w-3" /> {meta.label}
                      </Badge>
                      <Badge variant="outline" className={FULFILLMENT_STYLE[fs] ?? ''}>
                        <Package className="h-3 w-3 mr-1" />
                        {FULFILLMENT_OPTIONS.find((o) => o.value === fs)?.label ?? fs}
                      </Badge>
                      {order.order_number && (
                        <span className="text-xs font-mono text-muted-foreground">#{order.order_number}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleString('sv-SE', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {items.map((it, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="tabular-nums text-muted-foreground">{it.quantity}×</span>{' '}
                          {it.name}{it.variant_name ? ` (${it.variant_name})` : ''}
                          <span className="text-muted-foreground"> · {formatSek(it.unit_price_ore)}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="text-xs text-muted-foreground mt-1.5 flex flex-wrap gap-x-3">
                      {order.customer_name && <span>{order.customer_name}</span>}
                      {order.customer_email && <span>{order.customer_email}</span>}
                      {order.tracking_number && (
                        <span className="inline-flex items-center gap-1">
                          <Truck className="h-3 w-3" /> {order.tracking_number}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-serif text-xl">{formatSek(order.amount_total_ore)}</p>
                    <Button size="sm" variant="outline" className="mt-2 rounded-xl" onClick={() => openDetail(order)}>
                      Hantera →
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Order {detail?.order_number ? `#${detail.order_number}` : ''}
            </DialogTitle>
          </DialogHeader>
          {detail && (() => {
            const items = orderItems(detail.items);
            const subtotal = detail.subtotal_ore ?? 0;
            const shipping = detail.shipping_ore ?? 0;
            const discount = detail.discount_ore ?? 0;
            const total = detail.amount_total_ore;
            const address = formatAddress(detail.shipping_address);
            const totalsMatch = subtotal + shipping - discount === total;
            return (
              <div className="space-y-4 py-2 text-sm">
                {/* Kund */}
                <div className="rounded-xl bg-muted/30 p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{detail.customer_name || 'Namn saknas'}</p>
                      <p className="text-muted-foreground">
                        {detail.customer_email || 'e-post saknas'}
                        {detail.customer_phone ? ` · ${detail.customer_phone}` : ''}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {detail.customer_email && (
                        <Button size="icon" variant="outline" className="h-8 w-8"
                          aria-label="Kopiera e-post" title="Kopiera e-post"
                          onClick={() => copyText(detail.customer_email!, 'E-post kopierad')}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {address && (
                    <div className="flex items-start justify-between gap-2 pt-1 border-t">
                      <p className="text-xs mt-1"><span className="text-muted-foreground">Adress:</span> {address}</p>
                      <Button size="icon" variant="outline" className="h-8 w-8 shrink-0"
                        aria-label="Kopiera full adress" title="Kopiera full adress"
                        onClick={() => copyText(address, 'Adress kopierad')}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Snapshot av items */}
                <div className="rounded-xl border">
                  <div className="p-3 border-b flex items-center justify-between">
                    <p className="font-medium">Innehåll (snapshot vid köp)</p>
                    <span className="text-xs text-muted-foreground">{items.length} rader</span>
                  </div>
                  <ul className="divide-y">
                    {items.map((it, idx) => {
                      const line = it.unit_price_ore * it.quantity;
                      return (
                        <li key={idx} className="p-3 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p>
                              <span className="tabular-nums text-muted-foreground">{it.quantity}×</span>{' '}
                              {it.name}
                              {it.variant_name ? <span className="text-muted-foreground"> · {it.variant_name}</span> : null}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {it.sku ? `SKU ${it.sku} · ` : ''}Styck: {formatSek(it.unit_price_ore)}
                            </p>
                          </div>
                          <p className="font-medium tabular-nums shrink-0">{formatSek(line)}</p>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="p-3 border-t space-y-1">
                    <Row label="Delsumma" value={formatSek(subtotal)} />
                    <Row label="Frakt" value={formatSek(shipping)} />
                    {discount > 0 && <Row label="Rabatt" value={`-${formatSek(discount)}`} />}
                    <Row label="Totalt" value={formatSek(total)} bold />
                    {!totalsMatch && (
                      <p className="text-xs text-warning">
                        ⚠️ Betalt belopp matchar inte del­summa + frakt − rabatt (kan bero på Stripe-justering).
                      </p>
                    )}
                  </div>
                </div>

                {/* Metadata */}
                <div className="rounded-xl bg-muted/30 p-3 grid grid-cols-2 gap-y-1 text-xs">
                  <span className="text-muted-foreground">Betalstatus:</span>
                  <span>{detail.status}</span>
                  <span className="text-muted-foreground">Leveransstatus:</span>
                  <span>{detail.fulfillment_status ?? 'new'}</span>
                  <span className="text-muted-foreground">Skapad:</span>
                  <span>{new Date(detail.created_at).toLocaleString('sv-SE')}</span>
                  <span className="text-muted-foreground">Betald:</span>
                  <span>{detail.paid_at ? new Date(detail.paid_at).toLocaleString('sv-SE') : '–'}</span>
                  <span className="text-muted-foreground">Skickad:</span>
                  <span>{detail.shipped_at ? new Date(detail.shipped_at).toLocaleString('sv-SE') : '–'}</span>
                  <span className="text-muted-foreground">Slutförd:</span>
                  <span>{detail.completed_at ? new Date(detail.completed_at).toLocaleString('sv-SE') : '–'}</span>
                  {detail.stripe_session_id && (
                    <>
                      <span className="text-muted-foreground">Stripe session:</span>
                      <span className="font-mono truncate">{detail.stripe_session_id}</span>
                    </>
                  )}
                  {detail.payment_intent_id && (
                    <>
                      <span className="text-muted-foreground">Payment intent:</span>
                      <span className="font-mono truncate">{detail.payment_intent_id}</span>
                    </>
                  )}
                </div>

                <div>
                  <Label>Leveransstatus</Label>
                  <Select value={editFulfillment} onValueChange={(v) => setEditFulfillment(v as FulfillmentStatus)}>
                    <SelectTrigger className="rounded-xl" aria-label="Ändra leveransstatus"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FULFILLMENT_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <Label>Spårningsnummer</Label>
                    <Input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                      placeholder="Frivilligt" className="rounded-xl" />
                  </div>
                  <div>
                    <Label>Spårningslänk</Label>
                    <div className="flex gap-2">
                      <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)}
                        placeholder="https://…" className="rounded-xl" />
                      {trackingUrl && (
                        <Button size="icon" variant="outline" className="h-10 w-10"
                          aria-label="Öppna spårningslänk" title="Öppna spårningslänk"
                          onClick={() => window.open(trackingUrl, '_blank', 'noopener,noreferrer')}>
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Intern anteckning</Label>
                  <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                    rows={2} placeholder="Syns inte för kunden." className="rounded-xl" />
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" className="rounded-xl" onClick={() => setDetail(null)}>Stäng</Button>
            <Button className="rounded-xl" disabled={updateOrder.isPending}
              onClick={() => detail && updateOrder.mutate({
                id: detail.id,
                fulfillment_status: editFulfillment,
                tracking_number: trackingNumber.trim() || null,
                tracking_url: trackingUrl.trim() || null,
                admin_note: adminNote.trim() || null,
              })}>
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={bold ? 'font-serif text-base' : ''}>{value}</span>
    </div>
  );
}
