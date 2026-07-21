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
import { CheckCircle2, Clock, XCircle, Receipt, Search, Package, Truck, ExternalLink } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';
import { formatSek } from '@/lib/shopCart';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

type ShopOrder = Tables<'shop_orders'>;

interface OrderItem {
  product_id: string;
  name: string;
  quantity: number;
  unit_price_ore: number;
  variant_name?: string;
}

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; className: string }> = {
  paid: { label: 'Betald', icon: CheckCircle2, className: 'bg-success/10 text-success border-success/20' },
  pending: { label: 'Väntar', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' },
  expired: { label: 'Utgången', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
  canceled: { label: 'Avbruten', icon: XCircle, className: 'bg-muted text-muted-foreground border-border' },
};

const FULFILLMENT_OPTIONS = [
  { value: 'new', label: 'Ny' },
  { value: 'processing', label: 'Bearbetas' },
  { value: 'shipped', label: 'Skickad' },
  { value: 'delivered', label: 'Levererad' },
  { value: 'refunded', label: 'Återbetald' },
];

const FULFILLMENT_STYLE: Record<string, string> = {
  new: 'bg-primary/10 text-primary border-primary/20',
  processing: 'bg-accent/20 text-foreground border-accent/30',
  shipped: 'bg-blue-100 text-blue-800 border-blue-200',
  delivered: 'bg-success/15 text-success border-success/25',
  refunded: 'bg-muted text-muted-foreground border-border',
};

function orderItems(items: Tables<'shop_orders'>['items']): OrderItem[] {
  return Array.isArray(items) ? (items as unknown as OrderItem[]) : [];
}

export default function ShopOrders({ orders, loading }: { orders: ShopOrder[]; loading: boolean }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [fulfillmentFilter, setFulfillmentFilter] = useState<string>('all');
  const [detail, setDetail] = useState<ShopOrder | null>(null);
  const [editFulfillment, setEditFulfillment] = useState<string>('new');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [adminNote, setAdminNote] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (fulfillmentFilter !== 'all' && (o.fulfillment_status ?? 'new') !== fulfillmentFilter) return false;
      if (!q) return true;
      const items = orderItems(o.items).map((i) => i.name).join(' ');
      return [
        o.order_number, o.customer_email, o.customer_name, o.customer_phone,
        o.stripe_session_id, o.tracking_number, items,
      ].some((v) => v && String(v).toLowerCase().includes(q));
    });
  }, [orders, query, statusFilter, fulfillmentFilter]);

  const updateOrder = useMutation({
    mutationFn: async (patch: { id: string; fulfillment_status: string; tracking_number: string | null; tracking_url: string | null; admin_note: string | null }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const payload: any = {
        fulfillment_status: patch.fulfillment_status,
        tracking_number: patch.tracking_number,
        tracking_url: patch.tracking_url,
        admin_note: patch.admin_note,
      };
      if (patch.fulfillment_status === 'shipped') payload.shipped_at = new Date().toISOString();
      if (patch.fulfillment_status === 'delivered') payload.completed_at = new Date().toISOString();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any).from('shop_orders').update(payload).eq('id', patch.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shop-orders'] });
      toast({ title: 'Order uppdaterad' });
      setDetail(null);
    },
    onError: (e) => toast({ title: 'Kunde inte spara', description: (e as Error).message, variant: 'destructive' }),
  });

  const openDetail = (order: ShopOrder) => {
    setDetail(order);
    setEditFulfillment(order.fulfillment_status ?? 'new');
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Sök ordernummer, kund, e-post, spårning…"
            className="pl-9 rounded-xl" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40 rounded-xl"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alla statusar</SelectItem>
            <SelectItem value="paid">Betald</SelectItem>
            <SelectItem value="pending">Väntar</SelectItem>
            <SelectItem value="expired">Utgången</SelectItem>
            <SelectItem value="canceled">Avbruten</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fulfillmentFilter} onValueChange={setFulfillmentFilter}>
          <SelectTrigger className="w-full sm:w-44 rounded-xl"><SelectValue placeholder="Leverans" /></SelectTrigger>
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
            const fs = order.fulfillment_status ?? 'new';
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
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">
              Order {detail?.order_number ? `#${detail.order_number}` : ''}
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <div className="space-y-4 py-2">
              <div className="rounded-xl bg-muted/30 p-3 text-sm space-y-1">
                <p><span className="text-muted-foreground">Kund:</span> {detail.customer_name || '–'}</p>
                <p><span className="text-muted-foreground">E-post:</span> {detail.customer_email || '–'}</p>
                <p><span className="text-muted-foreground">Telefon:</span> {detail.customer_phone || '–'}</p>
                <p><span className="text-muted-foreground">Belopp:</span> {formatSek(detail.amount_total_ore)}</p>
                {!!detail.shipping_address && (
                  <p className="text-xs pt-1"><span className="text-muted-foreground">Adress:</span>{' '}
                    {(() => {
                      const a = detail.shipping_address as Record<string, string> | null;
                      if (!a) return '–';
                      return [a.line1, a.line2, a.postal_code, a.city, a.country].filter(Boolean).join(', ');
                    })()}
                  </p>
                )}
              </div>

              <div>
                <Label>Leveransstatus</Label>
                <Select value={editFulfillment} onValueChange={setEditFulfillment}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
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
                  <Input value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)}
                    placeholder="https://…" className="rounded-xl" />
                  {trackingUrl && (
                    <a href={trackingUrl} target="_blank" rel="noreferrer"
                      className="text-xs text-primary inline-flex items-center gap-1 mt-1">
                      Öppna länk <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
              <div>
                <Label>Intern anteckning</Label>
                <Textarea value={adminNote} onChange={(e) => setAdminNote(e.target.value)}
                  rows={2} placeholder="Syns inte för kunden." className="rounded-xl" />
              </div>
            </div>
          )}
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
